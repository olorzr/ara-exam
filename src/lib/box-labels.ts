/**
 * 지문·발문 안 **구역 상자**의 말머리 (`<blockquote data-box="…">`).
 *
 * 국어 시험지에는 세 종류가 나온다:
 *  - `〈보기〉`·`〈자료〉`·`〈조건〉` (번호가 붙기도 한다: 〈보기 1〉) — 테두리 상자
 *  - `(가) (나) (다)` … `(차)` — 글을 여러 편 싣고 가르는 표시
 *  - `[A] [B]` — 지문 안의 한 구간을 가리키는 표시
 *
 * ⚠️ 값은 **괄호 없이 말머리만** 담는다. 괄호는 인쇄 CSS 가 종류에 따라 붙인다
 *    (`problem-paper.css` 의 `blockquote[data-box]::before`).
 * ⚠️ 자유 문자열을 허용하면 인쇄 CSS 의 `content` 로 임의 문구가 들어가므로
 *    아래 목록만 통과시킨다. 목록을 넓히면 **인쇄 CSS 선택자도 같이** 넓혀야 한다.
 */

/** 테두리 상자로 그리는 말머리 (번호가 붙을 수 있다) */
const BOX_WORDS = ['보기', '자료', '조건'] as const;

/**
 * (가)~(차) 로 그리는 말머리.
 *
 * ⚠️ 처음엔 (마)까지였는데, 실제 시험지가 (바)·(사)까지 쓴다(2023 행당중 편지글, 2021 행당중
 *    양반전). 목록 밖 값은 정화기가 속성째 지워 **말머리 없는 맨 blockquote** 로 남았다 —
 *    인쇄물에 '(바)' 머리글이 사라지고 본문만 들여쓰기로 찍혔다(2026-09-20).
 */
const PAREN_LABELS = ['가', '나', '다', '라', '마', '바', '사', '아', '자', '차'] as const;

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

/**
 * `data-box="…"` 를 찾는다 — 값만 바꾸고 나머지 마크업은 건드리지 않는다.
 *
 * ⚠️ 따옴표 없는 값(`data-box=(가)`)도 잡는다(코덱스 리뷰 2R). HTML 로는 유효한 표기라 정화기가
 *    값 '(가)' 로 읽고 허용 목록 밖이라며 속성째 지운다 — 여기서 못 잡으면 발문 기본값
 *    (normalize-html.ts `defaultStemBoxes`)도 "이미 말머리가 있다" 고 보고 지나쳐 상자가 사라진다.
 *    따옴표 없는 값의 끝은 HTML 규칙대로 공백·`>`·따옴표·`=`·`<`·백틱 앞까지다.
 * ⚠️ **빈 값(`data-box=`·`data-box=""`)과 값 없는 속성(`data-box`)도 잡는다**(코덱스 리뷰 4R) —
 *    못 다듬는 값과 같이 속성째 지운다. 안 잡으면 발문 기본값이 "말머리가 있다" 고 보고 지나치고,
 *    정화기가 빈 값을 지워 결국 맨 상자가 된다. 끝의 lookahead 는 `data-boxes` 같은 딴 속성을 막는다.
 */
const DATA_BOX_ATTR = /\sdata-box(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]*)))?(?=[\s/>])/gi;

/**
 * 여는 태그 — 속성은 **이 안에서만** 다듬는다(코덱스 리뷰 5R).
 * 문서 전체에 위 정규식을 돌리면 본문 글자 ` data-box ` (예: 속성 이름을 설명하는 <code>)도
 * 값 없는 속성으로 보고 지운다 — 되돌릴 수 없는 본문 손실이다. 본문에는 원시 `<` 가 없고
 * 닫는 태그는 `/` 로 시작하므로 `<글자…>` 만 잡으면 속성 자리만 남는다.
 */
const OPEN_TAG_RE = /<[a-z][^<>]*>/gi;

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
  if (!/data-box/i.test(html)) return html;
  return html.replace(OPEN_TAG_RE, (tag) =>
    tag.replace(DATA_BOX_ATTR, (_match, dq, sq, bare) => {
      const label = normalizeBoxLabel(dq ?? sq ?? bare ?? '');
      return label ? ` data-box="${label}"` : '';
    }));
}

/** 편집기 '상자·구역' 선택지 — 값은 저장되는 말머리, 라벨은 인쇄 모양 그대로 */
export const BOX_LABEL_OPTIONS: { value: string; label: string }[] = [
  ...BOX_WORDS.map((w) => ({ value: w, label: `〈${w}〉` })),
  ...PAREN_LABELS.map((w) => ({ value: w, label: `(${w})` })),
  ...BRACKET_LABELS.map((w) => ({ value: w, label: `[${w}]` })),
];
