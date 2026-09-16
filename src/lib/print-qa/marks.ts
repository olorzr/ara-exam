/**
 * 답 표시(`답:`·`정답:`·`→`)의 **모양**을 한곳에서 정한다 (순수 함수).
 *
 * ⚠️ **낱말 한복판의 '답' 은 답 표시가 아니다**(코덱스 14R). `대답: 학교에 갑니다.` 는
 *    높임 표현을 묻는 **대화 자료**인데, 글자만 견주면 `답:` 이 걸려 그 대화가 통째로
 *    잘렸다(경고도 없이). 표시는 낱말의 시작이어야 한다.
 * ⚠️ 자르는 쪽(`redact.ts`)과 **남았는지 보는 쪽**(`hasAnswerMarkLeft`)이 같은 규칙을 봐야
 *    한다 — 한쪽만 느슨하면 못 자른 것을 못 알리거나, 멀쩡한 대화에 경고가 붙는다.
 */

/**
 * 답 표시의 말 — `답`·`정답`, **자모로 갈린 꼴(NFD)까지**.
 *
 * ⚠️ 맥에서 복사해 온 글은 `답` 이 `ᄃ`+`ᅡ`+`ᆸ` 으로 갈려 온다(코덱스 31R). 합친 꼴만
 *    보면 **프린트가 답이라고 밝혀 둔 답이 그대로 인쇄되고 경고도 안 뜬다.**
 */
const ANSWER_WORD = '(?:(?:정|\u110C\u1165\u11BC)?(?:답|\u1103\u1161\u11B8))';

/** 답 표시 자리 */
export const ANSWER_MARK = new RegExp(`${ANSWER_WORD}[ \\t]*[:：]`);

/** 답 표시 말 한 덩이 — 부르는 쪽이 줄머리 판정에 쓴다 */
export const ANSWER_MARK_SOURCE = ANSWER_MARK.source;

/** 화살표 답 표시 — 글자로 그린 `->`·`=>` 도 실제로 쓰인다 */
export const ARROW_MARK = /(?:[→⇒]|-+>|=+>)/;

/** 한 줄에서 표시를 모두 훑을 때 쓴다 */
export const ANSWER_MARK_ALL = new RegExp(ANSWER_MARK.source, 'g');

/** 화살표를 모두 훑을 때 쓴다 */
export const ARROW_MARK_ALL = new RegExp(ARROW_MARK.source, 'g');

/**
 * 낱말을 이루는 글자 — 이것이 앞에 있으면 표시가 아니라 낱말의 일부다.
 *
 * ⚠️ **자모로 갈린 한글(NFD)도 넣는다**(코덱스 25R). 맥에서 복사해 온 글은 `대` 가
 *    `ᄃ`+`ᅢ` 로 갈려 오는데, 그 자모를 빼면 `대답:` 의 '답:' 이 표시로 잡혀 **대화 자료가
 *    잘린다** — `redact-scan.ts` 의 같은 목록과 짝이다.
 */
const WORD_CHAR = /[\w가-힣\u3131-\u318E\u1100-\u11FF\uA960-\uA97F\uD7B0-\uD7FF]/;

/** 여닫는 글자가 다른 여는 기호 — 뒤에 답이 이어진다는 뜻이라 걷어낸다 */
const OPEN_MARKS = '‘“「『《〈(（[［';

/**
 * 글 끝의 **여는** 따옴표·괄호를 걷어낸다 — 표시를 찾기 전에 본다.
 *
 * ⚠️ **닫는 따옴표는 걷지 않는다**(코덱스 28R·29R). 걷으면 `표기는 "답:"` 에서 그 안의
 *    `답:` 이 꼬리 표시로 보여 **인용된 자료가 잘린다** — 닫는 따옴표로 끝난다는 것은
 *    그 표시가 **인용 안에 있다**는 뜻이다.
 * ⚠️ 같은 글자로 여닫는 따옴표(`'`·`"`)는 **짝수면 닫는 것**으로 본다(코덱스 29R) —
 *    `답: "` 는 하나뿐이라 여는 것이고, `"답:"` 은 둘이라 닫는 것이다.
 * @param text - 한 줄 또는 잘라 온 글
 * @returns 여는 기호를 걷어낸 글
 */
function openTail(text: string): string {
  let out = text.replace(/\s+$/, '');
  for (;;) {
    const ch = out[out.length - 1];
    if (ch === undefined) return out;
    const symmetric = ch === '"' || ch === "'";
    // ⚠️ **짝은 그 줄에서만 센다**(코덱스 38R). 글 전체로 세면 앞줄의 아포스트로피(`Don't`)
    //    하나가 짝을 뒤집어, **인용된 자료의 닫는 따옴표**를 여는 것으로 보고 걷어낸다
    const line = out.slice(out.lastIndexOf('\n') + 1);
    const odd = symmetric && line.split(ch).length % 2 === 0;
    if (!OPEN_MARKS.includes(ch) && !odd) return out;
    out = out.slice(0, -1).replace(/\s+$/, '');
  }
}

/** 글 끝에 덩그러니 남은 표시 — 앞글로 넘길 때 떼어 낸다 */
const TRAILING_MARK = new RegExp(`(?:${ANSWER_MARK.source}|[→⇒]|-+>|=+>)[ \\t]*$`);

/**
 * 그 자리의 `답:` 이 **답 표시인가** — 낱말 한복판이면 아니다.
 * @param line - 한 줄
 * @param at - 표시가 시작하는 자리
 * @returns 답 표시면 true
 */
export function isAnswerMark(line: string, at: number): boolean {
  const before = line[at - 1];
  return before === undefined || !WORD_CHAR.test(before);
}

/**
 * 그 글에 **답 표시가 남아 있는가**.
 *
 * ⚠️ 마지막 안전망이다. 못 가린 것은 지우지 말고 알린다 — 선생님이 문제지를 한 번 보면
 *    5초에 끝날 판단을 기계가 틀리게 내리지 않게 한다.
 * @param text - 가리고 난 물음
 * @returns 답 표시가 남아 있으면 true
 */
export function hasAnswerMarkLeft(text: string): boolean {
  if (ARROW_MARK.test(text)) return true;
  return text.split('\n').some((line) => (
    [...line.matchAll(ANSWER_MARK_ALL)].some((found) => isAnswerMark(line, found.index ?? 0))
  ));
}

/**
 * 글 끝에 남은 답 표시를 뗀다 — 답은 다음 조각에 있고 표시만 이쪽에 남은 자리다.
 * @param text - 잘라 온 글
 * @param arrows - 화살표 표시도 뗄 것인가 (문맥을 이미 확인한 자리에서만 true)
 * @returns 표시를 뗀 글
 */
export function stripTrailingMark(text: string, arrows = false): string {
  const mark = trailingMark(text);
  // ⚠️ **표시가 없으면 글을 건드리지 않는다**(코덱스 27R). 표시를 찾기 전에 걷어내는 따옴표는
  //    **찾았을 때만** 함께 걷는 것이다 — 아니면 `그는 “봄이다”` 의 닫는 따옴표가 사라진다.
  // ⚠️ **화살표는 부르는 쪽이 허락해야 뗀다**(`arrows`). 앞글에서는 `얼음 →` 이 그림의 일부라
  //    떼면 자료가 깎이고, 자르기에서는 이미 문맥을 확인한 뒤라 떼도 된다
  if (mark === null || (mark.arrow && !arrows)) return text.replace(/\s+$/, '');
  return openTail(text).slice(0, mark.at).replace(/\s+$/, '');
}

/** 글 끝에 있는 답 표시의 자리 */
export interface TrailingMark {
  /** 표시가 시작하는 자리 */
  at: number;
  /** 화살표 표시인가 — 화살표는 글 속에서도 쓰여 쓰는 쪽이 한 번 더 가려야 한다 */
  arrow: boolean;
}

/**
 * 그 글이 **답 표시로 끝나는가**, 끝난다면 어디서부터인가.
 *
 * ⚠️ **'무엇이 바뀌었나' 로 판정하면 안 된다**(코덱스 23R). `stripTrailingMark` 는 여는
 *    따옴표도 걷어내므로, 바뀐 것만 보고 표시가 있다고 여기면 `"시"` 로 끝나는 **선택지 줄**이
 *    답 표시로 둔갑해 그 아래 줄이 지워진다.
 * @param text - 한 줄 또는 잘라 온 글
 * @returns 표시 자리. 표시로 끝나지 않으면 null
 */
export function trailingMark(text: string): TrailingMark | null {
  // ⚠️ 여는 따옴표·괄호는 걷어내고 본다(코덱스 21R) — `답: “` 로 끝나는 조각이 앞글에 남는다
  const out = openTail(text);
  const found = out.match(TRAILING_MARK);
  if (found === null) return null;
  const at = out.length - found[0].length;
  const word = new RegExp(`^${ANSWER_WORD}`).test(found[0]);
  // ⚠️ **여기에도 낱말 경계가 필요하다**(코덱스 16R). 없으면 대화 자료의 마지막 줄 `대답:`
  //    에서 '답:' 만 떼어 **`대` 한 글자가 남는다** — 알아보는 쪽과 떼는 쪽이 어긋난 자리다
  if (word && !isAnswerMark(out, at)) return null;
  return { at, arrow: !word };
}

/**
 * 그 글에 답 표시가 **몇 번** 나오는가 (문답 프린트인지 어림잡는 데 쓴다).
 * @param text - 프린트 본문 평문
 * @returns 답 표시의 수
 */
export function countAnswerMarks(text: string): number {
  return text.split('\n').reduce((sum, line) => (
    sum + [...line.matchAll(ANSWER_MARK_ALL)].filter(
      (found) => isAnswerMark(line, found.index ?? 0),
    ).length
  ), 0);
}
