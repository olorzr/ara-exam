import { sanitizeInlineHTML, sanitizeProblemHTML } from '@/lib/sanitize-problem';
import { longestKnownPrefix, type AreaTreeNode } from '@/lib/problem-bank/area-tree';
import {
  formatGrammarPath, GRAMMAR_DEPTH_MAX, GRAMMAR_TREE, normalizeGrammarPaths,
} from '@/lib/problem-bank/grammar-tree';
import { UNIT_DEPTH_MAX } from '@/lib/problem-bank/unit-tree';
import { normalizeOcrPassageHtml, normalizeOcrStemHtml } from './normalize-html';
import type { QuestionType } from '@/types/problem-bank';
import {
  OCR_HTML_MAX, OCR_MAX_FIGURES_PER_ITEM, OCR_MAX_ITEMS_PER_BATCH, OCR_MAX_WARNINGS,
} from './constants';
import {
  int, isRecord, isOverLength, LEADING_MARKER, normalizeChoice, normalizeWork, nullableStr,
  parseBox, parseFigure, QUESTION_TYPES, str,
} from './parse-values';
import type { OcrDraft, OcrFigure, OcrItem } from './schema';
import {
  reconcileFigurePlaceholders, remapFigurePlaceholders,
} from '@/lib/problem-bank/figure-placeholders';
import { normalizeLabel } from './merge-keys';
import { notationWarning, yetHangulPageWarnings } from './yet-hangul-pages';
import { finalizeYetHangul } from '@/lib/yet-hangul';
import { pushDraftWarning as pushWarning, type DraftWarning } from './warnings';

/**
 * AI 출력(JSON 문자열) → 검증된 초안.
 *
 * ⚠️ 검증기는 **관대하지 않다.** 여기서 나온 값이 그대로 DB 에 들어가고 문제지로 인쇄된다.
 *    모양이 이상한 항목은 버리고 경고로 알린다 — 조용히 통과시키면
 *    "읽었다는데 내용이 이상한" 문항이 아카이브에 쌓인다.
 *
 * 원칙은 **구조는 엄격, 항목은 관대**다.
 *  - 전체 모양(`{ items: [...] }`)이 깨졌으면 `null` — 호출부가 "형식 오류"로 처리한다.
 *  - 항목 하나가 이상하면 그것만 버리고 나머지는 살린다(한 묶음을 통째로 잃지 않는다).
 *
 * 이 함수가 **정화(sanitize)의 첫 관문**이다. AI 출력은 신뢰 경계 밖이라
 * DB 로 가기 전에 여기서 반드시 한 번 거른다.
 */

/** 파서에 넘길 맥락 — 이 묶음이 무엇을 보냈는지 알아야 헛것을 걸러낼 수 있다 */
export interface ParseContext {
  /** 이 묶음에 실제로 보낸 쪽 번호들 */
  pages: number[];
  /** 영역 세트 트리. 비어 있으면 영역 검증을 건너뛴다 */
  areaTree?: AreaTreeNode[];
  /** 교과서 단원 트리. 비어 있으면 단원 검증을 건너뛴다 */
  unitTree?: AreaTreeNode[];
}

/**
 * 본문의 그림 자리표시자를 **살아남은 그림에 맞춘다.**
 *
 * 두 단계다: ① 버린 그림 때문에 밀린 번호를 옮겨 붙이고, ② 그러고도 남거나 모자란
 * 번호를 실제 개수에 맞춘다. ①을 건너뛰면 1번 자리에 2번 그림이 그려진다.
 * @param html - 정화까지 끝난 본문
 * @param mapping - 옛 번호 → 새 번호 (`null` 은 버린 것)
 * @param count - 살아남은 그림 수
 * @returns 맞춰진 본문
 */
function fitFigures(html: string, mapping: readonly (number | null)[], count: number): string {
  return reconcileFigurePlaceholders(remapFigurePlaceholders(html, mapping), count);
}

/**
 * 항목 하나를 검증한다. 못 쓰겠으면 null 을 돌려주고 경고를 남긴다.
 */
/**
 * 작품명 출처를 짚는 경고.
 *
 * **지문**과 **지문 없는 단독 문항** 두 곳에서 부른다 — 딸린 지문이 있는 문항은 그 이름을
 * 지문에서 물려받으므로(sql/20 트리거) 지문 쪽에서 이미 짚었고, 문항마다 또 붙이면 같은 말이
 * 문항 수만큼 늘어 경고 상한을 먹는다.
 *
 * ⚠️ `'printed'` 라고 **말했을 때만** 넘어간다. null·빠뜨림·모르는 값을 인쇄로 넘기면
 *    제목은 있는데 출처가 없는 응답이 **경고 없이** 인쇄된 이름으로 확정된다(코덱스 리뷰 3R).
 * @param warnings - 담을 목록
 * @param at - 이 항목을 가리키는 정보
 * @param workName - 다듬은 작품명. 없으면 짚을 것도 없다
 * @param source - 모델이 밝힌 출처
 */
function pushWorkSourceWarning(
  warnings: DraftWarning[],
  at: Omit<DraftWarning, 'message'>,
  workName: string | null,
  source: 'printed' | 'inferred' | null,
): void {
  if (!workName || source === 'printed') return;
  pushWarning(warnings, {
    ...at,
    message: source === 'inferred'
      ? `작품명을 본문으로 알아봤어요(${workName}). 맞는지 확인해 주세요.`
      : `작품명(${workName})이 인쇄된 것인지 알 수 없어요. 원본과 맞춰 주세요.`,
  });
}

function parseItem(
  raw: unknown,
  ctx: ParseContext,
  pageSet: Set<number>,
  warnings: DraftWarning[],
): OcrItem | null {
  if (!isRecord(raw)) return null;

  const kind: 'passage' | 'problem' | null = raw.kind === 'passage'
    ? 'passage'
    : raw.kind === 'problem' ? 'problem' : null;
  if (!kind) return null;

  const ref = str(raw.ref, 16);
  if (!ref) return null;

  const page = int(raw.page);
  // 보내지 않은 쪽을 지어냈다면 그 항목은 근거가 없다 — 버린다.
  // 버린 항목에는 행이 안 생기므로 ref 를 싣지 않는다(가리킬 카드가 없다)
  if (page === null || !pageSet.has(page)) {
    pushWarning(warnings, {
      message: `보내지 않은 쪽(${page ?? '?'})을 가리킨 항목이 있어 건너뛰었어요.`,
    });
    return null;
  }

  const number = int(raw.number);
  /** 이 항목을 가리키는 정보 — 병합이 여기에 행 id 를 붙인다 */
  const at: Omit<DraftWarning, 'message'> = { ref, kind, page, number };

  const rawType = str(raw.question_type, 8) as QuestionType;
  let question_type: QuestionType = QUESTION_TYPES.includes(rawType) ? rawType : '객관식';

  // ⚠️ 빈 선지를 걸러내며 압축하면 안 된다 — 정답은 **자리 번호**라 뒤 선지가 당겨지면
  //    정답이 다른 선지를 가리킨다(['A','','C','D','E'] + 정답 '3' → 3번이 D 가 된다).
  //    가운데 빈 자리는 그대로 두고 뒤쪽만 잘라 낸 뒤 경고한다(코덱스 리뷰 13R).
  const rawChoices = Array.isArray(raw.choices)
    // 선지는 `normalizeOcrPassageHtml` 을 안 타므로 옛한글을 여기서 굳힌다(정화 뒤다)
    ? raw.choices.slice(0, 5)
      .map((c) => finalizeYetHangul(sanitizeInlineHTML(str(c, 600).replace(LEADING_MARKER, ''))))
    : [];
  let lastChoice = rawChoices.length - 1;
  while (lastChoice >= 0 && rawChoices[lastChoice] === '') lastChoice -= 1;
  const choices = rawChoices.slice(0, lastChoice + 1);
  const blankChoices = choices
    .map((c, i) => (c === '' ? i + 1 : 0))
    .filter((n) => n > 0);
  if (blankChoices.length > 0) {
    pushWarning(warnings, {
      ...at,
      message: `${blankChoices.join(', ')}번 선지를 읽지 못했어요. 검수에서 채워 주세요.`,
    });
  }

  let answer = raw.answer === null || raw.answer === undefined
    ? null
    : normalizeChoice(str(raw.answer, 200));
  if (answer === '') answer = null;

  // 객관식인데 정답이 1~5 가 아니면 주관식으로 본다.
  // 그대로 두면 채점·정답표에서 선지 번호와 대조가 어긋난다.
  if (question_type === '객관식' && answer !== null && !/^[1-5]$/.test(answer)) {
    pushWarning(warnings, {
      ...at,
      message: `정답 '${answer}' 이 선지 번호가 아니라 주관식으로 뒀어요.`,
    });
    question_type = '주관식';
  }

  const rawArea = Array.isArray(raw.area_path)
    ? raw.area_path.map((a) => str(a, 60)).filter(Boolean)
    : [];
  const area_path = rawArea.length > 0
    ? longestKnownPrefix(ctx.areaTree ?? [], rawArea)
    : [];
  if (rawArea.length > 0 && area_path.length < rawArea.length) {
    pushWarning(warnings, {
      ...at,
      message: `영역 '${rawArea.join(' > ')}' 가 분류표에 없어 일부만 남겼어요.`,
    });
  }

  const rawUnit = Array.isArray(raw.unit_path)
    ? raw.unit_path.map((u) => str(u, 80)).filter(Boolean)
    : [];
  // ⚠️ 상한(2)을 반드시 넘긴다 — 트리를 못 읽은 환경에서는 검증 없이 통과하는데,
  //    3단이 그대로 들어가면 DB 의 cardinality CHECK 에 걸려 저장이 통째로 실패한다
  const unit_path = rawUnit.length > 0
    ? longestKnownPrefix(ctx.unitTree ?? [], rawUnit, UNIT_DEPTH_MAX)
    : [];
  if (rawUnit.length > 0 && unit_path.length < rawUnit.length) {
    pushWarning(warnings, {
      ...at,
      message: `단원 '${rawUnit.join(' > ')}' 가 교과서 단원표에 없어 일부만 남겼어요.`,
    });
  }

  // 문법은 경로가 **여러 개**라 하나씩 검증한다. 마스터가 코드 상수라 트리가 늘 있고,
  // 그래서 area/unit 과 달리 '트리를 못 읽어 통과' 하는 길이 없다
  // ⚠️ 작품명은 **여기서** 다듬는다. 저장 경로(save.ts)는 모델 값을 그대로 넣으므로
  //    여기서 안 하면 「동백꽃」·동백꽃·"동백꽃" 이 서로 다른 작품으로 쌓인다
  const title = normalizeWork(nullableStr(raw.title, 120));
  const work_title = normalizeWork(nullableStr(raw.work_title, 120));
  const passage_ref = nullableStr(raw.passage_ref, 16);
  // ⚠️ **'printed' 라고 말했을 때만 인쇄된 것으로 친다**(코덱스 리뷰 3R). null·빠뜨림·모르는
  //    값을 인쇄로 넘기면, 제목은 있는데 출처가 없는 응답이 **경고 없이** 인쇄된 이름으로
  //    확정된다 — 문턱을 내린 대가로 얻어야 할 안전장치가 그 자리에서 사라진다
  const titleSource = raw.title_source === 'printed' || raw.title_source === 'inferred'
    ? raw.title_source
    : null;
  // ⚠️ **알아본 작품명은 우리가 짚는다** — 모델에게 경고까지 적으라고 하면 적을 때도 있고
  //    안 적을 때도 있어, 인쇄된 이름과 알아낸 이름을 화면에서 구별할 수 없다(코덱스 리뷰 2R).
  //    딸린 지문이 있는 문항은 건너뛴다(지문 쪽에서 짚었다) — 그 참조가 끝내 안 풀려
  //    **단독 문항이 되는 경우**는 아래 `parseOcrDraft` 가 보충한다(코덱스 리뷰 4R)
  if (kind === 'passage' || !passage_ref) {
    pushWorkSourceWarning(warnings, at, kind === 'passage' ? title : work_title, titleSource);
  }

  const rawGrammar = Array.isArray(raw.grammar_paths) ? raw.grammar_paths : [];
  const kept: string[] = [];
  const dropped: string[] = [];
  for (const entry of rawGrammar) {
    const path = Array.isArray(entry) ? entry.map((g) => str(g, 60)).filter(Boolean) : [];
    if (path.length === 0) continue;
    const known = longestKnownPrefix(GRAMMAR_TREE, path, GRAMMAR_DEPTH_MAX);
    if (known.length === 0) dropped.push(path.join(' > '));
    else kept.push(formatGrammarPath(known));
  }
  const grammar_paths = normalizeGrammarPaths(kept);
  if (dropped.length > 0) {
    pushWarning(warnings, {
      ...at,
      message: `문법 분류 '${dropped.join("', '")}' 가 분류표에 없어 뺐어요.`,
    });
  }

  // ⚠️ 길이를 **자르기 전에** 잰다. 예전에는 6,000자에서 말없이 잘라내어, 쪽을 넘어가는
  //    긴 지문의 뒷부분이 사라지고도 아무 표시가 없었다 — 선생님은 AI 가 안 읽은 줄 알았다
  if (isOverLength(raw.html, OCR_HTML_MAX) || isOverLength(raw.stem_html, OCR_HTML_MAX)) {
    pushWarning(warnings, {
      ...at,
      message: '본문이 너무 길어 뒷부분이 잘렸어요. 원본과 대조해 이어 붙여 주세요.',
    });
  }

  // 그림 좌표. 못 알아본 것은 버리되 **자리표시자 번호를 옮겨 붙인다** —
  // 그냥 버리면 뒤엣것이 앞으로 당겨져 1번 자리에 2번 그림이 그려진다
  const rawFigures = (Array.isArray(raw.figures) ? raw.figures : [])
    .slice(0, OCR_MAX_FIGURES_PER_ITEM);
  const figures: OcrFigure[] = [];
  const figureMap = rawFigures.map((entry) => {
    // 그림마다 **자기 쪽**을 쓴다 — 쪽을 넘어가는 지문을 한 항목으로 내면 다음 쪽 그림이
    // 시작 쪽에서 잘려 엉뚱한 자리가 들어간다(업로드는 성공하므로 아무도 못 알아챈다)
    const box = parseFigure(entry, pageSet, page);
    // push 가 돌려주는 새 길이가 곧 새 1-based 번호다
    return box ? figures.push(box) : null;
  });
  if (figures.length < rawFigures.length) {
    pushWarning(warnings, {
      ...at,
      message: '그림 위치를 못 읽어 그 그림이 빠졌어요. 검수에서 직접 잘라 넣어 주세요.',
    });
  }

  return {
    kind,
    ref,
    page,
    box: parseBox(raw.box),
    passage_ref,
    number,
    // 머리글은 **여기서** 다듬는다 — 중복 판정 키(merge-keys)와 같은 글자를 써야
    // 겹쳐 읽은 같은 지문이 표기 차이로 둘로 갈라지지 않는다
    label: normalizeLabel(nullableStr(raw.label, 40)) || null,
    title,
    author: normalizeWork(nullableStr(raw.author, 60)),
    // 이름이 없으면 출처도 없다 — 문항은 work_title 이 그 자리다
    title_source: (kind === 'passage' ? title : work_title) ? titleSource : null,
    // ⚠️ 다듬기가 **정화보다 먼저**다. 정화기는 허용 목록 밖 data-box 를 되돌릴 수 없게
    //    지우므로, 순서가 바뀌면 모델이 낸 '(가)' 상자 표시가 조용히 사라진다
    // ⚠️ 자리표시자를 **실제 그림 수에 맞춘다.** 모델이 한쪽만 내는 일이 흔한데,
    //    어긋난 채 저장하면 없는 그림을 찾다 빈칸이 되거나 잘라 둔 그림이 안 나온다
    html: fitFigures(
      finalizeYetHangul(sanitizeProblemHTML(normalizeOcrPassageHtml(str(raw.html, OCR_HTML_MAX)))),
      kind === 'passage' ? figureMap : [],
      kind === 'passage' ? figures.length : 0,
    ),
    continued: raw.continued === true,
    continues: raw.continues === true,
    question_type,
    stem_html: fitFigures(
      finalizeYetHangul(sanitizeProblemHTML(normalizeOcrStemHtml(str(raw.stem_html, OCR_HTML_MAX)))),
      kind === 'problem' ? figureMap : [],
      kind === 'problem' ? figures.length : 0,
    ),
    choices,
    answer,
    has_figure: raw.has_figure === true || figures.length > 0,
    figures,
    work_title,
    area_path,
    unit_path,
    grammar_paths,
  };
}

/**
 * OCR 응답 원문을 검증된 초안으로 바꾼다.
 * @param raw - `generateDraft` 가 돌려준 검증 전 JSON 문자열
 * @param ctx - 이 묶음의 맥락(보낸 쪽, 영역 트리)
 * @returns 초안. 전체 모양이 깨졌으면 null
 */
export function parseOcrDraft(raw: string, ctx: ParseContext): OcrDraft | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(parsed) || !Array.isArray(parsed.items)) return null;

  // 모델이 스스로 적은 경고 — 어느 항목인지는 모델 말 안에만 있다(프롬프트가 쪽·번호를
  // 함께 적으라고 시킨다). 우리가 붙일 수 있는 위치 정보는 없으므로 메시지만 담는다
  const warnings: DraftWarning[] = Array.isArray(parsed.warnings)
    ? parsed.warnings
      .map((w) => str(w, 300)).filter(Boolean)
      .slice(0, OCR_MAX_WARNINGS)
      .map((message) => ({ message }))
    : [];

  const pageSet = new Set(ctx.pages);
  const items: OcrItem[] = [];
  const refs = new Set<string>();

  for (const rawItem of parsed.items.slice(0, OCR_MAX_ITEMS_PER_BATCH)) {
    // ⚠️ 항목별 경고는 **따로 받는다.** 곧바로 본 목록에 넣으면, 그 항목이 아래에서
    //    중복으로 버려질 때 경고에 남은 ref 가 **살아남은 다른 항목**으로 풀려
    //    엉뚱한 카드에 "선지가 비었어요" 가 붙는다(코덱스 리뷰 P2).
    const itemWarnings: DraftWarning[] = [];
    const item = parseItem(rawItem, ctx, pageSet, itemWarnings);
    if (!item) {
      for (const w of itemWarnings) pushWarning(warnings, w);
      continue;
    }

    // 같은 ref 가 두 번 오면 뒤에 오는 참조가 어느 쪽을 가리키는지 알 수 없다 — 먼저 온 것을 남긴다
    if (refs.has(item.ref)) {
      pushWarning(warnings, {
        message: '같은 항목을 두 번 읽어 뒤엣것을 버렸어요.',
        page: item.page,
      });
      // 버린 쪽의 경고는 **ref 를 떼고** 남긴다 — 남은 항목을 가리키면 거짓이 되지만,
      // 통째로 지우면 그 읽기에서만 보인 문제가 조용히 사라진다
      for (const w of itemWarnings) pushWarning(warnings, { ...w, ref: undefined });
      continue;
    }

    for (const w of itemWarnings) pushWarning(warnings, w);
    // 못 바꾼 `⟦ ⟧` 는 **여기서** 넣는다 — 끝에 몰면 경고 상한에 밀려 잘린다
    const notation = notationWarning(item);
    if (notation) pushWarning(warnings, notation);
    refs.add(item.ref);
    items.push(item);
  }

  // 지문 참조가 이 묶음 안에서 풀리지 않으면 끊어 둔다(엉뚱한 지문에 붙는 것보다 낫다).
  // 쪽 경계를 넘어간 경우는 병합(merge.ts)이 다시 이어 붙인다.
  const passageRefs = new Set(items.filter((i) => i.kind === 'passage').map((i) => i.ref));
  for (const item of items) {
    if (item.passage_ref && !passageRefs.has(item.passage_ref)) {
      pushWarning(warnings, {
        ref: item.ref,
        kind: item.kind,
        page: item.page,
        number: item.number,
        message: '딸린 지문을 이 묶음에서 못 찾아 지문 없이 뒀어요.',
      });
      // ⚠️ 이제 **단독 문항**이 됐다 — 물려받을 지문이 없으므로 작품명 출처를 여기서 짚는다.
      //    참조가 있다는 이유로 위에서 건너뛰었는데 여기서도 안 하면, 그 작품명만 아무 확인
      //    없이 들어간다(코덱스 리뷰 4R)
      // ⚠️ **문항일 때만**이다(코덱스 리뷰 5R). 지문은 위에서 참조와 상관없이 이미 짚었으므로,
      //    참조가 딸린 지문(모델의 실수다)까지 여기서 또 짚으면 같은 경고가 두 번 담겨
      //    묶음 경고 상한(20)을 헛되이 먹는다
      if (item.kind === 'problem') {
        pushWorkSourceWarning(
          warnings,
          { ref: item.ref, kind: item.kind, page: item.page, number: item.number },
          item.work_title,
          item.title_source,
        );
      }
      item.passage_ref = null;
    }
  }

  // 옛한글은 비슷한 다른 자모로 읽어도 화면에서는 그럴듯해 보인다 — 살아남은 항목에서 모은다.
  // 쪽 경고는 ref 가 없어 `resolveDraftWarning` 이 쪽 대상으로 풀고, 겹쳐 읽은 묶음이 낸
  // 같은 경고는 병합의 `dedupeWarnings` 가 하나로 합친다
  for (const warning of yetHangulPageWarnings(items)) pushWarning(warnings, warning);

  return { items, warnings: warnings.slice(0, OCR_MAX_WARNINGS) };
}
