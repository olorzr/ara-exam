import { sanitizeInlineHTML, sanitizeProblemHTML } from '@/lib/sanitize-problem';
import { longestKnownPrefix, type AreaTreeNode } from '@/lib/problem-bank/area-tree';
import type { QuestionType } from '@/types/problem-bank';
import { OCR_MAX_ITEMS_PER_BATCH, OCR_MAX_WARNINGS } from './constants';
import type { AnswerKeyDraft, AnswerKeyRow, OcrBox, OcrDraft, OcrItem } from './schema';

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

/**
 * 정답지에 인쇄된 선택지 글자 → 저장 형식('1'~'5').
 *
 * ⚠️ 이게 없으면 실제 시험지 대부분이 깨진다. 한국 시험지는 정답을 ①~⑤ 로 찍는데,
 *    그대로 두면 아래 객관식 검사가 "1~5 가 아니네" 하고 **주관식으로 강등**해 버린다.
 */
const CHOICE_GLYPHS: Record<string, string> = {
  '①': '1', '②': '2', '③': '3', '④': '4', '⑤': '5',
  '➀': '1', '➁': '2', '➂': '3', '➃': '4', '➄': '5',
  '⑴': '1', '⑵': '2', '⑶': '3', '⑷': '4', '⑸': '5',
  '１': '1', '２': '2', '３': '3', '４': '4', '５': '5',
};

/** 선지 본문 앞에 남은 번호 표시 — 렌더가 기호를 다시 붙이므로 지운다 */
const LEADING_MARKER = /^\s*(?:[①-⑤➀-➄⑴-⑸]|\(\s*[1-5]\s*\)|[1-5１-５]\s*[.)]|[1-5]\s*번)\s*/;

const QUESTION_TYPES: readonly QuestionType[] = ['객관식', '주관식', '서술형'];

/** '①' / '(1)' / '1번' / '１' → '1'. 못 알아보면 원문 그대로 */
function normalizeChoice(answer: string): string {
  const trimmed = answer.trim();
  const direct = CHOICE_GLYPHS[trimmed];
  if (direct) return direct;
  const m = trimmed.match(/^\(?\s*([1-5])\s*\)?\s*(?:번|\.)?$/);
  return m ? m[1] : trimmed;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

function str(v: unknown, max: number): string {
  return typeof v === 'string' ? v.trim().slice(0, max) : '';
}

function nullableStr(v: unknown, max: number): string | null {
  const s = str(v, max);
  return s ? s : null;
}

function int(v: unknown): number | null {
  return typeof v === 'number' && Number.isInteger(v) && Number.isFinite(v) ? v : null;
}

/**
 * 좌표를 0~1 로 가두고 뒤집힌 값을 버린다.
 * 좌표가 없으면 크롭만 못 할 뿐 본문은 멀쩡하므로 항목을 버리지 않는다.
 */
function parseBox(v: unknown): OcrBox | null {
  if (!isRecord(v)) return null;
  const column = v.column;
  if (column !== 0 && column !== 1 && column !== 2) return null;
  const top = typeof v.top === 'number' ? v.top : NaN;
  const bottom = typeof v.bottom === 'number' ? v.bottom : NaN;
  if (!Number.isFinite(top) || !Number.isFinite(bottom)) return null;
  const t = Math.min(Math.max(top, 0), 1);
  const b = Math.min(Math.max(bottom, 0), 1);
  if (b <= t) return null;
  return { column, top: t, bottom: b };
}

/** 파서에 넘길 맥락 — 이 묶음이 무엇을 보냈는지 알아야 헛것을 걸러낼 수 있다 */
export interface ParseContext {
  /** 이 묶음에 실제로 보낸 쪽 번호들 */
  pages: number[];
  /** 영역 세트 트리. 비어 있으면 영역 검증을 건너뛴다 */
  areaTree?: AreaTreeNode[];
}

function pushWarning(warnings: string[], message: string): void {
  if (warnings.length < OCR_MAX_WARNINGS) warnings.push(message);
}

/**
 * 항목 하나를 검증한다. 못 쓰겠으면 null 을 돌려주고 경고를 남긴다.
 */
function parseItem(
  raw: unknown,
  ctx: ParseContext,
  pageSet: Set<number>,
  warnings: string[],
): OcrItem | null {
  if (!isRecord(raw)) return null;

  const kind = raw.kind === 'passage' ? 'passage' : raw.kind === 'problem' ? 'problem' : null;
  if (!kind) return null;

  const ref = str(raw.ref, 16);
  if (!ref) return null;

  const page = int(raw.page);
  // 보내지 않은 쪽을 지어냈다면 그 항목은 근거가 없다 — 버린다
  if (page === null || !pageSet.has(page)) {
    pushWarning(warnings, `${ref}: 보내지 않은 쪽(${page ?? '?'})을 가리켜 건너뛰었어요.`);
    return null;
  }

  const rawType = str(raw.question_type, 8) as QuestionType;
  let question_type: QuestionType = QUESTION_TYPES.includes(rawType) ? rawType : '객관식';

  const choices = Array.isArray(raw.choices)
    ? raw.choices
      .slice(0, 5)
      .map((c) => sanitizeInlineHTML(str(c, 600).replace(LEADING_MARKER, '')))
      .filter((c) => c.length > 0)
    : [];

  let answer = raw.answer === null || raw.answer === undefined
    ? null
    : normalizeChoice(str(raw.answer, 200));
  if (answer === '') answer = null;

  // 객관식인데 정답이 1~5 가 아니면 주관식으로 본다.
  // 그대로 두면 채점·정답표에서 선지 번호와 대조가 어긋난다.
  if (question_type === '객관식' && answer !== null && !/^[1-5]$/.test(answer)) {
    pushWarning(warnings, `${ref}: 정답 '${answer}' 이 선지 번호가 아니라 주관식으로 뒀어요.`);
    question_type = '주관식';
  }

  const score = typeof raw.score === 'number' && Number.isFinite(raw.score) && raw.score >= 0
    ? Math.min(raw.score, 100)
    : null;

  const rawArea = Array.isArray(raw.area_path)
    ? raw.area_path.map((a) => str(a, 60)).filter(Boolean)
    : [];
  const area_path = rawArea.length > 0
    ? longestKnownPrefix(ctx.areaTree ?? [], rawArea)
    : [];
  if (rawArea.length > 0 && area_path.length < rawArea.length) {
    pushWarning(warnings, `${ref}: 영역 '${rawArea.join(' > ')}' 가 분류표에 없어 일부만 남겼어요.`);
  }

  return {
    kind,
    ref,
    page,
    box: parseBox(raw.box),
    passage_ref: nullableStr(raw.passage_ref, 16),
    number: int(raw.number),
    label: nullableStr(raw.label, 40),
    title: nullableStr(raw.title, 120),
    author: nullableStr(raw.author, 60),
    html: sanitizeProblemHTML(str(raw.html, 6000)),
    continued: raw.continued === true,
    continues: raw.continues === true,
    question_type,
    stem_html: sanitizeProblemHTML(str(raw.stem_html, 6000)),
    choices,
    answer,
    score,
    has_figure: raw.has_figure === true,
    work_title: nullableStr(raw.work_title, 120),
    area_path,
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

  const warnings: string[] = Array.isArray(parsed.warnings)
    ? parsed.warnings.map((w) => str(w, 300)).filter(Boolean).slice(0, OCR_MAX_WARNINGS)
    : [];

  const pageSet = new Set(ctx.pages);
  const items: OcrItem[] = [];
  const refs = new Set<string>();

  for (const rawItem of parsed.items.slice(0, OCR_MAX_ITEMS_PER_BATCH)) {
    const item = parseItem(rawItem, ctx, pageSet, warnings);
    if (!item) continue;
    // 같은 ref 가 두 번 오면 뒤에 오는 참조가 어느 쪽을 가리키는지 알 수 없다 — 먼저 온 것을 남긴다
    if (refs.has(item.ref)) {
      pushWarning(warnings, `${item.ref}: 같은 이름이 두 번 나와 뒤엣것을 버렸어요.`);
      continue;
    }
    refs.add(item.ref);
    items.push(item);
  }

  // 지문 참조가 이 묶음 안에서 풀리지 않으면 끊어 둔다(엉뚱한 지문에 붙는 것보다 낫다).
  // 쪽 경계를 넘어간 경우는 병합(merge.ts)이 다시 이어 붙인다.
  const passageRefs = new Set(items.filter((i) => i.kind === 'passage').map((i) => i.ref));
  for (const item of items) {
    if (item.passage_ref && !passageRefs.has(item.passage_ref)) {
      pushWarning(warnings, `${item.ref}: 가리킨 지문(${item.passage_ref})을 못 찾아 지문 없이 뒀어요.`);
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

  const warnings: string[] = Array.isArray(parsed.warnings)
    ? parsed.warnings.map((w) => str(w, 300)).filter(Boolean).slice(0, OCR_MAX_WARNINGS)
    : [];

  const seen = new Set<number>();
  const answers: AnswerKeyRow[] = [];

  for (const raw of parsed.answers) {
    if (!isRecord(raw)) continue;
    const no = int(raw.no);
    if (no === null || no < 1) continue;
    if (opts.maxNumber !== undefined && no > opts.maxNumber) {
      pushWarning(warnings, `${no}번은 이 시험지의 문항 범위를 벗어나 버렸어요.`);
      continue;
    }
    // 같은 번호가 두 번 오면 먼저 온 것을 남긴다(정답표는 보통 한 번만 인쇄된다)
    if (seen.has(no)) {
      pushWarning(warnings, `${no}번 정답이 두 번 나와 먼저 읽은 값을 남겼어요.`);
      continue;
    }
    const answer = normalizeChoice(str(raw.answer, 200));
    if (!answer) continue;
    seen.add(no);
    answers.push({
      no,
      answer,
      score: typeof raw.score === 'number' && Number.isFinite(raw.score) && raw.score >= 0
        ? Math.min(raw.score, 100)
        : null,
    });
  }

  return { answers, warnings: warnings.slice(0, OCR_MAX_WARNINGS) };
}
