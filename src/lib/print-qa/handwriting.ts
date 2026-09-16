import { htmlToPlainText } from '@/lib/concept-pick/plain-text';

/**
 * 읽어 둔 본문을 평문으로 옮기면서 **손글씨 자리를 함께 표시한다** (순수 함수).
 *
 * 손글씨의 근거는 하나뿐이다: 프린트를 읽을 때 '손글씨 포함' 을 켜면 OCR 이 손으로 쓴 글을
 * **`<em>` 으로 감싸** 옮긴다(`print-scan/prompt.ts` 의 `HANDWRITING_ON`).
 *
 * ⚠️ **모델에게 묻지 않는다.** 물어서 받으면 그 말을 믿게 되는데 확인할 길이 없다 —
 *    학생 답이 '선생님이 인쇄한 답' 으로 들어가면 모범답안 대상에서 빠지고, 검증 없이
 *    교사용에 찍힌다.
 * ⚠️ **'손글씨 포함' 이 꺼진 묶음에서는 아예 보지 않는다.** 그때 `<em>` 은 인쇄된 기울임이고
 *    (프린트에는 드물지만 있다), 손으로 쓴 답은 애초에 옮겨지지 않아 답이 비어 있다.
 *
 * ⚠️ **글자가 아니라 자리로 가린다**(코덱스 리뷰). 답 글자를 `<em>` 조각들과 견주기만 하면,
 *    3번에 **인쇄돼 있는** '은유' 가 7번에 손으로 쓴 `<em>은유</em>` 때문에 손글씨로 뒤바뀐다 —
 *    그러면 선생님이 인쇄해 둔 답이 모범답안 대상에 끼어 AI 답으로 덮인다.
 *    그래서 평문으로 옮길 때 손글씨 구간의 **시작·끝 자리**를 함께 얻어 둔다.
 * ⚠️ 태그를 직접 걷어내지 않고 `htmlToPlainText` 에 **통째로 맡긴다.** 직접 걷으면
 *    `&nbsp;`·`<br>` 이 본문과 다르게 풀려(`<em>관심&nbsp;표현</em>`) 멀쩡한 손글씨가
 *    인쇄된 답으로 분류된다.
 */

/**
 * 손글씨 구간의 시작·끝을 잠시 끼워 넣는 글자 (사용자 영역 문자).
 *
 * 태그가 아니라 **글자**여야 한다 — `htmlToPlainText` 가 태그는 전부 지우지만 이 글자는
 * 그대로 통과시키므로, 평문이 만들어진 **뒤에** 자리를 셀 수 있다.
 */
const OPEN = '';
const CLOSE = '';

/** 표시 글자 — 원본에 있을 리 없지만 들어와도 먼저 지운다 */
const SENTINELS = /[]/g;

/**
 * `<em>` 여는·닫는 태그.
 *
 * ⚠️ **짝을 정규식으로 잡지 않는다**(코덱스 2R). `<em>메모 <em>강조</em> 은유</em>` 처럼 겹쳐
 *    있으면 게으른 짝짓기가 **첫 `</em>` 에서 멈춰** 뒤쪽 '은유' 가 손글씨에서 빠진다 —
 *    그 답은 '인쇄된 답' 이 되어 모범답안 대상에서 사라진다. 깊이를 세어 바깥 짝만 표시한다.
 */
const EM_TAG = /<(\/?)em\b[^>]*>/gi;

/** 표시 글자에 붙은 공백 — 표시가 공백 **안쪽**으로 들어가야 원래 평문과 같아진다 */
const OPEN_PADDED = /\uE000(\s+)/g;
const CLOSE_PADDED = /(\s+)\uE001/g;

/** 속이 빈 표시 짝 */
const EMPTY_PAIR = /\uE000\s*\uE001/g;

/** 글 끝에 남은 표시·공백 — 표시 때문에 없던 꼬리가 생기면 안 된다 */
const TRAILING = /[\s\uE000\uE001]+$/;

/**
 * 속에 **겹친 `<em>` 이 없는** 한 덩어리. 빈 강조를 벗겨 내는 데만 쓴다.
 */
const EM_INNERMOST = /<em\b[^>]*>((?:(?!<\/?em\b)[\s\S])*?)<\/em>/gi;

/**
 * 보이는 글자가 없는 `<em>` 은 **감싸기 전에 벗긴다**.
 *
 * `<em>&nbsp;<br></em>` 처럼 공백뿐인 강조에 표시를 두면, 원래 **빈 줄이라 지워졌을 줄**이
 * 표시 글자 때문에 살아남아 평문에 없던 빈 줄이 생긴다.
 * @param html - 원본 HTML
 * @returns 빈 강조를 벗긴 HTML
 */
function unwrapBlankEm(html: string): string {
  return html.replace(EM_INNERMOST, (match, inner: string) => (
    htmlToPlainText(inner).trim() === '' ? inner : match
  ));
}

/**
 * `<em>` 바깥 짝만 표시 글자로 감싼다 (깊이를 센다).
 *
 * 태그 자체는 버린다 — `htmlToPlainText` 가 어차피 지운다.
 * @param html - 원본 HTML
 * @returns 표시 글자가 끼워진 HTML
 */
function markEmSpans(html: string): string {
  let out = '';
  let last = 0;
  let depth = 0;
  for (const match of html.matchAll(EM_TAG)) {
    const at = match.index ?? 0;
    out += html.slice(last, at);
    if (match[1] !== '/') {
      if (depth === 0) out += OPEN;
      depth += 1;
    } else if (depth > 0) {
      depth -= 1;
      if (depth === 0) out += CLOSE;
    }
    last = at + match[0].length;
  }
  out += html.slice(last);
  // 닫히지 않은 `<em>`(깨진 HTML)은 글 끝에서 닫는다
  if (depth > 0) out += CLOSE;
  // ⚠️ 표시를 공백 **안쪽**으로 밀어 넣는다(코덱스 2R). 공백 바깥에 두면 `htmlToPlainText` 의
  //    공백 줄이기가 표시 글자에 막혀 '가 나 다' 가 '가  나  다' 가 된다 — 평문이
  //    손글씨를 안 읽은 묶음과 달라진다
  return tidyMarks(out);
}

/**
 * 표시 글자를 공백 안쪽으로 밀고, 빈 짝과 글 끝의 찌꺼기를 없앤다.
 *
 * HTML 단계와 평문 단계에서 **두 번** 돌린다 — `&nbsp;`·`<br>` 은 평문이 되고 나서야
 * 공백으로 보이기 때문이다.
 * @param text - 표시가 끼워진 글
 * @returns 다듬은 글
 */
function tidyMarks(text: string): string {
  return text
    .replace(OPEN_PADDED, `$1${OPEN}`)
    .replace(CLOSE_PADDED, `${CLOSE}$1`)
    .replace(EMPTY_PAIR, '')
    .replace(TRAILING, '');
}

/**
 * 평문이 된 뒤의 다듬기 — 표시를 옮긴 **자리에 남는 공백까지 접는다**.
 *
 * ⚠️ `htmlToPlainText` 의 공백 줄이기는 표시를 옮기기 **전에** 끝났다(코덱스 3R). `&nbsp;` 는
 *    그때까지 공백이 아니어서 `가 <em>&nbsp;나&nbsp;</em> 다` 의 표시가 제자리에 남아 있다가,
 *    옮기고 나면 공백이 겹쳐 '가  나  다' 가 된다 — 다시 한 번 접어야 원래 평문과 같아진다.
 * @param text - 표시가 끼워진 평문
 * @returns 다듬은 평문
 */
function tidyPlain(text: string): string {
  return tidyMarks(text)
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .join('\n')
    .replace(TRAILING, '');
}

/** 평문에서의 손글씨 구간 */
export interface HandwrittenRange {
  start: number;
  end: number;
}

/** 평문과 그 안의 손글씨 자리들 */
export interface PlainWithHandwriting {
  plain: string;
  ranges: HandwrittenRange[];
}

/**
 * 본문 HTML 을 평문으로 옮기고 손글씨 자리를 함께 돌려준다.
 * @param html - 읽어 둔 프린트 본문 HTML
 * @param includeHandwriting - 그 묶음이 손글씨를 옮겨 읽었는가 (아니면 자리를 찾지 않는다)
 * @returns 평문과 손글씨 구간들 (구간은 평문 좌표다)
 */
export function readPlainWithHandwriting(
  html: string,
  includeHandwriting: boolean,
): PlainWithHandwriting {
  const clean = html.replace(SENTINELS, '');
  const source = includeHandwriting ? markEmSpans(unwrapBlankEm(clean)) : clean;
  const marked = includeHandwriting ? tidyPlain(htmlToPlainText(source)) : htmlToPlainText(source);
  const plain = marked.replace(SENTINELS, '');
  const ranges: HandwrittenRange[] = [];
  let removed = 0;
  let open: number | null = null;

  for (let i = 0; i < marked.length; i += 1) {
    const ch = marked[i];
    if (ch !== OPEN && ch !== CLOSE) continue;
    // 표시 글자를 뺀 평문에서의 자리
    const at = i - removed;
    removed += 1;
    if (ch === OPEN) {
      if (open === null) open = at;
      continue;
    }
    if (open !== null && at > open) ranges.push({ start: open, end: at });
    open = null;
  }
  // 닫히지 않은 구간(깨진 HTML)은 글 끝까지로 본다
  if (open !== null && plain.length > open) ranges.push({ start: open, end: plain.length });

  return { plain, ranges };
}

/**
 * 이 자리가 손글씨 구간과 겹치는가.
 * @param span - 평문에서의 자리
 * @param ranges - `readPlainWithHandwriting` 이 찾아 둔 손글씨 구간들
 * @returns 겹치면 true
 */
export function isHandwrittenSpan(
  span: HandwrittenRange,
  ranges: readonly HandwrittenRange[],
): boolean {
  return ranges.some((range) => range.start < span.end && span.start < range.end);
}
