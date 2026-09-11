import type { QuestionType } from '@/types/problem-bank';
import { normalizeWorkTitle } from '@/lib/problem-bank/work-title';
import type { OcrBox, OcrFigure } from './schema';

/**
 * OCR 응답의 **값 하나하나**를 검증·정규화하는 도구들 (순수 함수).
 *
 * 항목 조립(`parse.ts`)에서 떼어 둔 이유는 결이 달라서다 — 여기 있는 것들은
 * "이 값이 쓸 만한가"만 보고, 저기서는 "이 항목을 살릴까 버릴까"를 정한다.
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
export const LEADING_MARKER = /^\s*(?:[①-⑤➀-➄⑴-⑸]|\(\s*[1-5]\s*\)|[1-5１-５]\s*[.)]|[1-5]\s*번)\s*/;

export const QUESTION_TYPES: readonly QuestionType[] = ['객관식', '주관식', '서술형'];

/** '①' / '(1)' / '1번' / '１' → '1'. 못 알아보면 원문 그대로 */
export function normalizeChoice(answer: string): string {
  const trimmed = answer.trim();
  const direct = CHOICE_GLYPHS[trimmed];
  if (direct) return direct;
  const m = trimmed.match(/^\(?\s*([1-5])\s*\)?\s*(?:번|\.)?$/);
  return m ? m[1] : trimmed;
}

export function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

export function str(v: unknown, max: number): string {
  return typeof v === 'string' ? v.trim().slice(0, max) : '';
}

/**
 * 이 값이 상한을 넘어 **잘릴** 참인가.
 *
 * `str()` 은 조용히 `slice` 하므로, 호출부는 자르기 전에 이걸로 물어보고 경고를 남긴다.
 * 긴 지문의 뒷부분이 말없이 사라지던 경로가 여기였다.
 * @param v - 검사할 값
 * @param max - 상한(글자)
 * @returns 넘으면 true
 */
export function isOverLength(v: unknown, max: number): boolean {
  return typeof v === 'string' && v.trim().length > max;
}

export function nullableStr(v: unknown, max: number): string | null {
  const s = str(v, max);
  return s ? s : null;
}

/** 작품명·지은이를 표준 표기로 — 다듬고 나서 비면 null 로 되돌린다 */
export function normalizeWork(value: string | null): string | null {
  if (value === null) return null;
  const normalized = normalizeWorkTitle(value);
  return normalized ? normalized : null;
}

export function int(v: unknown): number | null {
  return typeof v === 'number' && Number.isInteger(v) && Number.isFinite(v) ? v : null;
}

/**
 * 좌표를 0~1 로 가두고 뒤집힌 값을 버린다.
 * 좌표가 없으면 크롭만 못 할 뿐 본문은 멀쩡하므로 항목을 버리지 않는다.
 */
/**
 * 그림 자리를 검증한다 — 좌표에 **쪽 번호**가 붙는다.
 *
 * 쪽이 없거나 이 묶음이 안 본 쪽이면 **항목의 쪽으로 떨어뜨린다**(대개 맞고, 틀려도
 * 잘라 낸 그림을 사람이 검수에서 보고 고칠 수 있다).
 * @param v - 모델이 낸 값
 * @param pages - 이 묶음이 실제로 본 쪽
 * @param fallbackPage - 쪽을 못 믿을 때 쓸 항목의 쪽
 * @returns 검증된 자리. 좌표가 이상하면 null
 */
export function parseFigure(
  v: unknown,
  pages: ReadonlySet<number>,
  fallbackPage: number,
): OcrFigure | null {
  const box = parseBox(v);
  if (!box) return null;
  const page = isRecord(v) ? int(v.page) : null;
  return { ...box, page: page !== null && pages.has(page) ? page : fallbackPage };
}

export function parseBox(v: unknown): OcrBox | null {
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
