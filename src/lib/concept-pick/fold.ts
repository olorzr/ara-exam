/**
 * 대조용으로 글자를 접는다 (순수 함수).
 *
 * 견주는 두 글자가 **서로 다른 표현**에서 온다: `htmlToPlainText` 가 만든 평문에는 우리가
 * 넣은 구조 기호(`|` 칸 구분, 줄머리 `#`·`-`)가 있고, 편집기 문서(`textContent`)에는 없으며,
 * 모델은 그 기호를 빠뜨리거나 줄바꿈을 공백으로 바꿔 적는다.
 *
 * 세기가 **둘**인 까닭(코덱스 리뷰 2R): 한 가지로 하면 둘 중 하나가 깨진다.
 *  - `foldStrict` — 기호만 공백으로 바꾸고 **어절 경계는 지킨다.** 뜻이 프린트에 실제로
 *    적혀 있는지 보는 자리는 반드시 이쪽이다. 공백까지 지우면 '아버지가 방에' 와
 *    '아버지 가방에' 가 같아지고 '-3' 과 '3' 이 같아져, 지어낸 뜻이 그대로 등록된다.
 *  - `foldLoose` — 공백과 기호를 모두 지운다. 표의 한 행(`| 시어 | 뜻 |`)을 편집기 문서의
 *    같은 자리(`시어뜻`)와 맞추려면 이 세기가 필요하다. **자리를 찾는 데만** 쓴다.
 */

/** 접은 글자와, 그 글자가 원본 어디에서 왔는지 */
export interface FoldedText {
  text: string;
  /** `text[i]` 가 원본의 몇 번째 글자였는가 */
  map: number[];
}

/**
 * 접는 세기.
 *
 * `literal` 은 **아무것도 접지 않는다** — 글자 그대로 맞는 자리를 먼저 고르는 데 쓴다
 * (코덱스 리뷰). 접고 나면 `'가 | 나의 대비'` 와 `'가 나의 대비'` 가 같아져,
 * 힌트가 정확히 가리킨 뒤쪽 후보 대신 **앞쪽 후보가 이긴다.**
 */
export type FoldMode = 'literal' | 'strict' | 'loose';

/** 우리가 줄머리에 넣는 기호 */
const LINE_MARKS = new Set(['#', '-']);

/**
 * 이 자리의 기호가 **우리가 넣은 줄머리 표시**인가.
 *
 * ⚠️ 줄머리라는 것만으로는 모자라다(코덱스 리뷰). `foldStrict('-3')` 이 `'3'` 이 되어
 *    **`'-3'` 과 `'3'` 이 같아졌고**, 지어낸 뜻 `-3` 이 본문의 `3` 에 그대로 통과했다.
 *    우리가 넣는 줄머리는 언제나 뒤에 공백이 온다(`'- 항목'`·`'# 제목'`) — 숫자·글자가
 *    바로 붙은 `-3` 은 **원문의 부호**이므로 건드리지 않는다.
 * @param value - 원본 글자
 * @param i - 기호의 자리
 * @returns 줄머리 표시면 true
 */
function isLineMarkAt(value: string, i: number): boolean {
  const next = value[i + 1];
  return next === undefined || /\s/.test(next) || next === '|';
}

/**
 * 글자를 접으면서 원본 자리를 함께 남긴다.
 * @param value - 원본 글자
 * @param mode - 접는 세기
 * @returns 접은 글자와 자리 표
 */
export function foldWithMap(value: string, mode: FoldMode): FoldedText {
  // 글자 그대로 보는 세기 — 자리 표는 1:1 이다.
  // ⚠️ `Array.from(value, …)` 로 만들지 말 것(코덱스 리뷰). 그것은 **코드포인트**로 세는데
  //    `indexOf` 와 ProseMirror 자리는 **UTF-16 단위**라, 이모지가 하나만 섞여도 표가
  //    짧아져 `map[...]` 이 `undefined` → 끝 자리가 `NaN` 이 되고 그 후보가 통째로 밀린다.
  if (mode === 'literal') {
    return { text: value, map: Array.from({ length: value.length }, (_, i) => i) };
  }

  const out: string[] = [];
  const map: number[] = [];
  const loose = mode === 'loose';
  // 줄머리인가 — 줄이 바뀐 뒤 아직 글자가 안 나왔으면 참
  let atLineStart = true;

  for (let i = 0; i < value.length; i += 1) {
    const ch = value[i];

    if (ch === '\n') {
      atLineStart = true;
      if (!loose && out[out.length - 1] !== ' ' && out.length > 0) { out.push(' '); map.push(i); }
      continue;
    }
    if (/\s/.test(ch) || ch === '|') {
      // 칸 구분은 **공백과 같다** — 지워 버리면 두 칸의 글자가 한 낱말처럼 붙는다
      if (!loose && out[out.length - 1] !== ' ' && out.length > 0) { out.push(' '); map.push(i); }
      continue;
    }
    if (LINE_MARKS.has(ch) && (loose || (atLineStart && isLineMarkAt(value, i)))) {
      // 줄머리 기호는 우리가 넣은 것이라 원본에도 편집기에도 없다.
      // 느슨한 세기는 **자리를 찾는 데만** 쓰므로 기호를 모두 지운다
      continue;
    }

    out.push(ch);
    map.push(i);
    atLineStart = false;
  }

  // 끝에 남은 공백은 떼고 본다
  while (out.length > 0 && out[out.length - 1] === ' ') { out.pop(); map.pop(); }
  return { text: out.join(''), map };
}

/**
 * 기호만 공백으로 바꾸고 어절 경계는 지킨 글자. **뜻이 실제로 적혀 있는지** 보는 자리용.
 * @param value - 원본 글자
 * @returns 접은 글자
 */
export function foldStrict(value: string): string {
  return foldWithMap(value, 'strict').text;
}

/**
 * 공백과 기호를 모두 지운 글자. **자리를 찾는 데만** 쓴다.
 * @param value - 원본 글자
 * @returns 접은 글자
 */
export function foldLoose(value: string): string {
  return foldWithMap(value, 'loose').text;
}
