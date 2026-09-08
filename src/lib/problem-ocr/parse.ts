import { sanitizeInlineHTML, sanitizeProblemHTML } from '@/lib/sanitize-problem';
import { longestKnownPrefix, type AreaTreeNode } from '@/lib/problem-bank/area-tree';
import {
  formatGrammarPath, GRAMMAR_DEPTH_MAX, GRAMMAR_TREE, normalizeGrammarPaths,
} from '@/lib/problem-bank/grammar-tree';
import { UNIT_DEPTH_MAX } from '@/lib/problem-bank/unit-tree';
import { normalizeOcrPassageHtml, normalizeOcrStemHtml } from './normalize-html';
import type { QuestionType } from '@/types/problem-bank';
import { OCR_MAX_ITEMS_PER_BATCH, OCR_MAX_WARNINGS } from './constants';
import {
  int, isRecord, LEADING_MARKER, normalizeChoice, normalizeWork, nullableStr, parseBox,
  QUESTION_TYPES, str,
} from './parse-values';
import type { AnswerKeyDraft, AnswerKeyRow, OcrDraft, OcrItem } from './schema';
import type { DraftWarning } from './warnings';

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
 * 경고를 담는다.
 *
 * ⚠️ 메시지에 `ref` 를 적지 않는다. 'Q3' 는 **이 묶음 안에서만** 유효한 이름이라
 *    화면 어디에도 그런 이름이 없다 — 어느 문항 얘기인지 아무도 모른다.
 *    위치는 `ref`/`page`/`number` 로 **따로** 실어 보내고, 병합이 그것을 진짜 행 id 와
 *    사람이 읽는 이름('3번')으로 바꾼다.
 */
function pushWarning(warnings: DraftWarning[], warning: DraftWarning): void {
  if (warnings.length < OCR_MAX_WARNINGS) warnings.push(warning);
}

/**
 * 항목 하나를 검증한다. 못 쓰겠으면 null 을 돌려주고 경고를 남긴다.
 */
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
    ? raw.choices.slice(0, 5).map((c) => sanitizeInlineHTML(str(c, 600).replace(LEADING_MARKER, '')))
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

  return {
    kind,
    ref,
    page,
    box: parseBox(raw.box),
    passage_ref: nullableStr(raw.passage_ref, 16),
    number,
    label: nullableStr(raw.label, 40),
    // ⚠️ 작품명은 **여기서** 다듬는다. 저장 경로(save.ts)는 모델 값을 그대로 넣으므로
    //    여기서 안 하면 「동백꽃」·동백꽃·"동백꽃" 이 서로 다른 작품으로 쌓인다
    title: normalizeWork(nullableStr(raw.title, 120)),
    author: normalizeWork(nullableStr(raw.author, 60)),
    // ⚠️ 다듬기가 **정화보다 먼저**다. 정화기는 허용 목록 밖 data-box 를 되돌릴 수 없게
    //    지우므로, 순서가 바뀌면 모델이 낸 '(가)' 상자 표시가 조용히 사라진다
    html: sanitizeProblemHTML(normalizeOcrPassageHtml(str(raw.html, 6000))),
    continued: raw.continued === true,
    continues: raw.continues === true,
    question_type,
    stem_html: sanitizeProblemHTML(normalizeOcrStemHtml(str(raw.stem_html, 6000))),
    choices,
    answer,
    has_figure: raw.has_figure === true,
    work_title: normalizeWork(nullableStr(raw.work_title, 120)),
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
      item.passage_ref = null;
    }
  }

  return { items, warnings: warnings.slice(0, OCR_MAX_WARNINGS) };
}

/**
 * 정답표 응답 원문을 검증한다.
 * @param raw - 검증 전 JSON 문자열
 * @param opts - 문항 번호 상한 (원본 시험지의 마지막 번호). 넘으면 버린다
 * @returns 정답 목록. 전체 모양이 깨졌으면 null
 */
export function parseAnswerKeyDraft(
  raw: string,
  opts: { maxNumber?: number } = {},
): AnswerKeyDraft | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(parsed) || !Array.isArray(parsed.answers)) return null;

  const warnings: DraftWarning[] = Array.isArray(parsed.warnings)
    ? parsed.warnings
      .map((w) => str(w, 300)).filter(Boolean)
      .slice(0, OCR_MAX_WARNINGS)
      .map((message) => ({ message }))
    : [];

  const seen = new Set<number>();
  const answers: AnswerKeyRow[] = [];

  for (const raw of parsed.answers) {
    if (!isRecord(raw)) continue;
    const no = int(raw.no);
    if (no === null || no < 1) continue;
    if (opts.maxNumber !== undefined && no > opts.maxNumber) {
      pushWarning(warnings, { message: `정답표의 ${no}번은 이 시험지의 문항 범위를 벗어나 버렸어요.` });
      continue;
    }
    // 같은 번호가 두 번 오면 먼저 온 것을 남긴다(정답표는 보통 한 번만 인쇄된다)
    if (seen.has(no)) {
      pushWarning(warnings, { message: `정답표에 ${no}번이 두 번 나와 먼저 읽은 값을 남겼어요.` });
      continue;
    }
    const answer = normalizeChoice(str(raw.answer, 200));
    if (!answer) continue;
    seen.add(no);
    answers.push({ no, answer });
  }

  return { answers, warnings: warnings.slice(0, OCR_MAX_WARNINGS) };
}
