/**
 * 지문·발문 안 **구역 상자**의 말머리 (`<blockquote data-box="…">`).
 *
 * 국어 시험지에는 세 종류가 나온다:
 *  - `〈보기〉`·`〈자료〉`·`〈조건〉` (번호가 붙기도 한다: 〈보기 1〉) — 테두리 상자
 *  - `(가) (나) (다)` — 글을 여러 편 싣고 가르는 표시
 *  - `[A] [B]` — 지문 안의 한 구간을 가리키는 표시
 *
 * ⚠️ 값은 **괄호 없이 말머리만** 담는다. 괄호는 인쇄 CSS 가 종류에 따라 붙인다
 *    (`problem-paper.css` 의 `blockquote[data-box]::before`).
 * ⚠️ 자유 문자열을 허용하면 인쇄 CSS 의 `content` 로 임의 문구가 들어가므로
 *    아래 목록만 통과시킨다. 목록을 넓히면 **인쇄 CSS 선택자도 같이** 넓혀야 한다.
 */

/** 테두리 상자로 그리는 말머리 (번호가 붙을 수 있다) */
const BOX_WORDS = ['보기', '자료', '조건'] as const;

/** (가)~(마) 로 그리는 말머리 */
const PAREN_LABELS = ['가', '나', '다', '라', '마'] as const;

/** [A]~[E] 로 그리는 말머리 */
const BRACKET_LABELS = ['A', 'B', 'C', 'D', 'E'] as const;

/** 인쇄 모양 — CSS 선택자 묶음과 1:1 이다 */
export type BoxKind = 'box' | 'paren' | 'bracket';

/** '보기' 또는 '보기 2' */
const BOX_WORD_RE = new RegExp(`^(?:${BOX_WORDS.join('|')})(?: [1-9])?$`);

/** 감싸는 괄호류 — 시험지 표기를 그대로 받아도 되게 벗겨 낸다 */
const OUTER_BRACKETS = /^[([{<〈《「『【［（]+|[)\]}>〉》」』】］）]+$/g;

/**
 * 전각 영문·숫자 → ASCII.
 *
 * ⚠️ `String.normalize('NFKC')` 를 쓰면 안 된다 — 그건 **동그라미 문자까지** 풀어서
 *    `ⓐ` 를 `a`(→`A`)로 만든다. ⓐ·㉠ 은 구역 표시가 아니라 본문 안 기호라,
 *    상자 말머리로 승격되면 지문 한 덩어리가 통째로 상자에 들어간다.
 */
const FULLWIDTH_RE = /[\uFF21-\uFF25\uFF41-\uFF45\uFF10-\uFF19]/g;
const toAscii = (c: string): string => String.fromCharCode(c.charCodeAt(0) - 0xFEE0);

/**
 * 이 값을 `data-box` 로 써도 되는가 (정화기의 검증기).
 * @param value - 정규화된 말머리
 * @returns 허용 목록에 있으면 true
 */
export function isBoxLabel(value: string): boolean {
  return BOX_WORD_RE.test(value)
    || (PAREN_LABELS as readonly string[]).includes(value)
    || (BRACKET_LABELS as readonly string[]).includes(value);
}

/**
 * 인쇄 모양을 고른다.
 * @param value - 정규화된 말머리
 * @returns 상자 / (가) / [A] 중 하나. 허용 목록 밖이면 null
 */
export function boxKind(value: string): BoxKind | null {
  if (BOX_WORD_RE.test(value)) return 'box';
  if ((PAREN_LABELS as readonly string[]).includes(value)) return 'paren';
  if ((BRACKET_LABELS as readonly string[]).includes(value)) return 'bracket';
  return null;
}

/**
 * 시험지 표기를 허용 말머리로 다듬는다.
 *
 * `(가)` → `가`, `[A]` → `A`, `〈보기 1〉` → `보기 1`, `보기1` → `보기 1`.
 * `ⓐ`·`㉠` 은 구역 표시가 아니라 본문 기호이므로 null 이다.
 * @param raw - 모델이 낸 값
 * @returns 허용 말머리. 못 다듬으면 null
 */
export function normalizeBoxLabel(raw: string): string | null {
  let value = (raw ?? '').normalize('NFC').trim();
  value = value.replace(OUTER_BRACKETS, '').trim();
  value = value.replace(FULLWIDTH_RE, toAscii);
  // 한 글자 라벨은 사이 공백이 의미 없다: '보 기' → '보기'
  if (/^[가-힣]\s+[가-힣]$/.test(value)) value = value.replace(/\s+/g, '');
  value = value.replace(/\s+/g, ' ');
  if (/^[a-e]$/.test(value)) value = value.toUpperCase();
  // '보기1' 처럼 붙여 쓴 번호는 한 칸 띄운다(인쇄 라벨이 〈보기1〉로 나오지 않게)
  const numbered = value.match(new RegExp(`^(${BOX_WORDS.join('|')})\\s*([1-9])$`));
  if (numbered) value = `${numbered[1]} ${numbered[2]}`;
  return isBoxLabel(value) ? value : null;
}

/** `data-box="…"` 를 찾는다 — 값만 바꾸고 나머지 마크업은 건드리지 않는다 */
const DATA_BOX_ATTR = /\sdata-box\s*=\s*("([^"]*)"|'([^']*)')/g;

/**
 * HTML 안의 모든 `data-box` 값을 허용 말머리로 다듬는다.
 *
 * ⚠️ **정화(DOMPurify)보다 먼저** 불러야 한다. 정화기는 허용 목록 밖 값을 통째로
 *    지우므로(`sanitize-profile.ts` 의 `keepAttr = false`) 그 뒤에는 되돌릴 수 없다 —
 *    모델이 낸 `data-box="(가)"` 가 조용히 사라져 상자 표시가 없어진다.
 * @param html - 모델이 낸 HTML
 * @returns 값이 다듬어진 HTML (못 다듬는 값은 속성째 제거)
 */
export function normalizeBoxAttributes(html: string): string {
  if (!html.includes('data-box')) return html;
  return html.replace(DATA_BOX_ATTR, (_match, _quoted, dq, sq) => {
    const label = normalizeBoxLabel(dq ?? sq ?? '');
    return label ? ` data-box="${label}"` : '';
  });
}

/** 편집기 '상자·구역' 선택지 — 값은 저장되는 말머리, 라벨은 인쇄 모양 그대로 */
export const BOX_LABEL_OPTIONS: { value: string; label: string }[] = [
  ...BOX_WORDS.map((w) => ({ value: w, label: `〈${w}〉` })),
  ...PAREN_LABELS.map((w) => ({ value: w, label: `(${w})` })),
  ...BRACKET_LABELS.map((w) => ({ value: w, label: `[${w}]` })),
];
