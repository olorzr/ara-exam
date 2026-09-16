import { foldLoose } from '@/lib/concept-pick/fold';

/**
 * 문항 번호의 **모양**을 한곳에서 정한다 (순수 함수).
 *
 * ⚠️ **알아보는 곳과 지켜 주는 곳이 같은 범위를 봐야 한다**(코덱스 10R·13R·14R). 한쪽이
 *    알아보는 꼴(`ㄱ；`)을 다른 쪽이 못 알아보면 **맞추기는 하면서 지켜 주지는 않아**,
 *    중복 응답이 그 자리를 집어 가고 **진짜 문항이 중복으로 사라진다**. 실제로 세 라운드가
 *    같은 결함을 기호만 바꿔 가며 짚었다 — 그래서 두 정규식을 **같은 글자 목록**으로 짓는다.
 */

/** 번호를 감싸는 여는 기호 */
const LABEL_OPEN = '([{（［';

/** 번호 뒤에 붙는 기호 */
const LABEL_CLOSE = '.):;·,\\]}）］：；，、';

/** 번호로 쓰이는 한글 순서 글자 — `산. 그리고 물.` 같은 시 한 줄을 번호로 보지 않게 추린다 */
const LABEL_LETTERS = '가나다라마바사아자차카타파하ㄱ-ㅎA-Za-z';

/** 번호 한 덩이 — `11`·`3-1`·`(2)`·`문 3)`·`가`·`ㄱ`·`A`·`①` */
// ⚠️ 기호는 **여러 개 붙을 수 있다**(코덱스 15R). `(1).` 처럼 닫는 기호가 둘인 번호를
//    `LABEL_ONLY` 만 못 알아보면, 견주기는 맞으면서 그 자리를 지켜 주지는 않아
//    **중복 응답이 집어 가고 진짜 문항이 사라진다**
const LABEL_BODY = `(?:문\\s*)?[${LABEL_OPEN}]*\\s*`
  + `(?:\\d{1,3}(?:\\s*[-–.]\\s*\\d{1,3})?|[${LABEL_LETTERS}]|[\\u2460-\\u2473])`
  // `1번`·`2 번` 처럼 세는 말이 붙은 번호도 실제로 쓴다(코덱스 17R)
  + `\\s*(?:번)?\\s*[${LABEL_CLOSE}]*`;

/**
 * 줄 전체가 번호뿐인가 — 앞 줄을 번호로 인정하고, **남의 번호 자리를 지키는** 조건.
 */
export const LABEL_ONLY = new RegExp(`^${LABEL_BODY}$`);

/** 번호를 감싸거나 뒤에 붙는 기호 — 견줄 때 **양쪽 모두** 벗긴다 */
export const LABEL_MARKS = new RegExp(`[${LABEL_OPEN}${LABEL_CLOSE}]`, 'g');

/** 마지막 줄이 **번호뿐인** 경우 — `3.`·`(2)`·`3-1)` 처럼 혼자 남은 줄 */
const LABEL_ONLY_LINE = new RegExp(`(^|\\n)[ \\t]*(${LABEL_BODY})[ \\t]*$`);

/** 번호 안의 숫자 묶음 — '3-1' 은 ['3','1'] 이다 */
const DIGITS = /\d+/g;

/**
 * 번호가 놓일 만한 앞머리의 최대 길이.
 *
 * 실제 번호는 `11. `·`(1) `·`문 2) ` 처럼 길어야 여남은 글자다. 넉넉히 잡으면 글 한복판의
 * 연도(`이 작품은 1930년대에 …`)가 번호로 걸린다.
 */
const LABEL_PREFIX_MAX = 12;

/** 번호를 견줄 자리 — 시작 자리만 쓴다 */
interface LabelSpan {
  start: number;
}

/**
 * 평문의 구조 표시 — `htmlToPlainText` 가 `<li>` 자리에 `- `, 표 칸 앞에 `| ` 를 넣는다.
 */
const LIST_MARK = /^[ \t]*(?:[-*•]\s+|\|\s*)/;

/**
 * 번호에서 기호를 벗긴 알맹이.
 * @param value - 번호 또는 물음 앞머리
 * @returns 기호를 벗겨 접은 글자
 */
function labelCore(value: string): string {
  // ⚠️ 세는 말 `번` 도 함께 벗긴다(코덱스 18R). `LABEL_ONLY` 가 `A번` 을 번호로 알아보는데
  //    여기서 못 벗기면 **제 번호가 붙은 자리에도 못 앉아** 그 물음이 중복으로 사라진다
  return foldLoose(value.replace(LABEL_MARKS, '')).replace(/번$/, '');
}

/**
 * 이 앞머리가 **그 번호**인가.
 *
 * ⚠️ **숫자 묶음을 통째로 견준다**(Stop 게이트). 글자를 품고 있는지만 보면 번호 `1` 이
 *    `11` 에도 걸려, 답이 다른 **진짜 11번이 중복으로 지워진다**.
 * @param prefix - 물음 앞에 있던 짧은 글
 * @param label - 프린트에 인쇄된 번호
 * @returns 같은 번호면 true
 */
export function matchesLabel(prefix: string, label: string): boolean {
  // 번호는 줄머리에 있다 — 앞머리가 길면 번호 자리가 아니라 글의 한복판이다
  if (prefix === '' || prefix.length > LABEL_PREFIX_MAX) return false;
  // ⚠️ **번호 모양이 아니면 번호가 아니다**(코덱스 21R). 숫자 묶음만 견주면 `예시 2개:` 가
  //    2번 자리로 인정돼, 그 자리에 앉은 문항이 **진짜 2번의 답(손글씨)을 잃는다** —
  //    지켜 주는 쪽(`carriesLabel`)은 같은 앞머리를 번호로 보지 않으니 짝이 어긋난다
  if (!LABEL_ONLY.test(prefix)) return false;
  const digits = label.match(DIGITS);
  if (digits) {
    const got = prefix.match(DIGITS) ?? [];
    return digits.length === got.length && digits.every((part, i) => part === got[i]);
  }
  // 숫자가 없는 번호('가'·'ㄱ')는 글자로 견준다 — 앞머리 **끝**에 그 글자가 와야 한다.
  // ⚠️ **양쪽을 같은 규칙으로 벗긴다**(코덱스 8R). 앞머리에서만 기호를 떼면 `(가)` 번호가
  //    `(가` 와 견줘져 **어느 자리에도 못 앉고**, 그 물음이 중복으로 사라진다
  const core = labelCore(prefix);
  const want = labelCore(label);
  return core !== '' && want !== '' && core.endsWith(want);
}

/** 앞 문장이 끝난 자리 — 번호는 그 뒤에 온다 (글머리·줄머리도 그 자리로 본다) */
const SENTENCE_END = /(?:^|[.。?!？！)\]”’」』·\n])\s*$/;

/** 숫자에 붙은 점으로 끝나는가 — 소수점이지 문장 끝이 아니다 */
const DECIMAL_END = /\d\.\s*$/;

/**
 * 글 끝에 **같은 줄로 붙은 이 문항의 번호**를 뗀다.
 *
 * ⚠️ **기호가 붙은 번호만 뗀다**(코덱스 21R). 기호 없이 글 끝에 놓인 숫자는
 *    `지문 끝의 값은 1` 처럼 **문장의 값**이라, 떼면 지문이 조용히 깎인다.
 * ⚠️ **문장이 끝난 자리의 번호만 뗀다**(코덱스 22R). `주어진 수는 1.` 처럼 문장 안에 놓인
 *    숫자를 떼면 지문의 값이 사라진다.
 * ⚠️ **알맹이로 견준다**(코덱스 26R). 구두점을 뗀 `(1` 을 번호 `(1)` 과 글자로 견주면 어긋나
 *    괄호 번호가 **앞글에 남아 우리가 찍는 번호와 나란히 인쇄된다**.
 * @param text - 잘라 낸 글 (끝 공백은 이미 걷어낸 상태)
 * @param label - 프린트에 인쇄된 번호
 * @returns 번호를 뗀 글. 뗄 자리가 아니면 null
 */
export function stripSameLineLabel(text: string, label: string): string | null {
  const head = labelHeadAt(text, (token) => matchesLabel(token, label));
  return head;
}

/**
 * 글 끝에 붙은 **번호 한 덩이**를 찾아, 그 앞까지의 글을 돌려준다.
 *
 * ⚠️ **구두점을 요구하지 않는다**(코덱스 33R — 21R 의 '기호가 붙은 번호만' 을 대신한다).
 *    동그라미 번호(`①`)에는 구두점이 없어 앞글에 그대로 남아 **번호가 두 번 찍혔다**.
 *    대신 **문장이 끝난 자리**여야 한다는 조건이 값(`지문 끝의 값은 1`)을 지킨다(코덱스 22R).
 * ⚠️ 뒤에서부터 **긴 덩이를 먼저** 본다 — `문 1)`·`( 1 )` 처럼 공백이 낀 번호를 통째로 잡는다.
 * @param text - 잘라 낸 글 (끝 공백은 걷어낸 상태)
 * @param ok - 그 덩이를 번호로 받아들일지 정하는 판정
 * @returns 번호 앞까지의 글. 번호가 없으면 null
 */
function labelHeadAt(text: string, ok: (token: string) => boolean): string | null {
  for (let len = Math.min(LABEL_PREFIX_MAX, text.length); len >= 1; len -= 1) {
    const token = text.slice(text.length - len);
    if (token.trimStart() !== token) continue;
    if (!ok(token.trim())) continue;
    const head = text.slice(0, text.length - len);
    // ⚠️ **소수점은 문장 끝이 아니다**(코덱스 34R). `3.1.` 의 `1.` 을 번호로 보면
    //    **주어진 값의 소수 부분이 깎인다**
    if (SENTENCE_END.test(head) && !DECIMAL_END.test(head)) return head;
  }
  return null;
}

/**
 * 끝에 **번호만 있는 줄**이 남았으면 뗀다.
 *
 * ⚠️ **맨 숫자 한 줄은 떼지 않는다**(코덱스 14R). `다음 수를 보고 답하시오.\n5\n절댓값은?` 의
 *    `5` 는 **문제에 주어진 값**이라 떼면 풀 수 없는 문제가 된다. 이 문항의 번호와 같거나
 *    (`1` ↔ `1`), 번호 뒤에 붙는 기호를 달고 있을 때(`12)`)만 번호로 본다 — 값에는 그런
 *    기호가 붙지 않는다.
 * @param text - 잘라 낸 글
 * @param label - 프린트에 인쇄된 번호 (없으면 '')
 * @returns 번호 줄을 뗀 글
 */
export function stripLabelLine(text: string, label: string): string {
  const found = text.match(LABEL_ONLY_LINE);
  if (found === null) return text;
  // ⚠️ **이 문항의 번호일 때만 뗀다**(코덱스 33R — 14R 의 '기호가 붙어 있으면 뗀다' 를 뒤집음).
  //    기호만 보고 떼면 `다음 수를 보고 물음에 답하시오.\n(5)` 의 **주어진 값**이 사라진다.
  //    번호를 모르는 응답에서는 원본 번호가 앞글에 남을 수 있지만, 그것은 눈에 보이는 흠이다
  return matchesLabel(found[2].trim(), label) ? text.replace(LABEL_ONLY_LINE, '$1') : text;
}

/**
 * 그 자리 **바로 앞에 이 번호가 찍혀 있는가** (제 줄, 없으면 앞 줄).
 *
 * ⚠️ 같은 물음이 번호만 바꿔 여러 번 나오는 프린트에서 **어느 자리가 이 문항인지** 가리는
 *    유일한 단서다(코덱스 3R · Stop 게이트). 번호를 안 보면 모델이 한 문항을 두 번 냈을 때
 *    둘째가 **뒤 문항의 자리를 차지해** 그 문항이 사라진다.
 * @param plain - 본문 평문
 * @param span - 물음이 있는 자리
 * @param label - 프린트에 인쇄된 번호
 * @returns 물음 앞머리(또는 바로 앞 줄)에 그 번호가 있으면 true
 */
export function hasLabelBefore(plain: string, span: LabelSpan, label: string): boolean {
  if (label === '') return false;
  const lineStart = plain.lastIndexOf('\n', span.start - 1) + 1;
  const own = cleanPrefix(plain.slice(lineStart, span.start));
  // ⚠️ **앞머리의 끝에서 번호를 찾는다**(코덱스 33R). `첫 지문이다. 1. 갈래는?` 처럼 지문과
  //    번호가 한 줄에 있으면, 앞머리 전체를 번호로 견주다 **번호 없는 자리로 여겨** 중복
  //    응답이 그 자리를 집어 가고 진짜 문항이 사라진다
  if (own !== '') return labelHeadAt(own, (token) => matchesLabel(token, label)) !== null;
  // ⚠️ **번호가 앞 줄에 있을 수 있다**(코덱스 5R). `1.\n표현법은?` 처럼 줄을 나눠 인쇄한
  //    프린트에서 제 줄만 보면 번호를 못 찾아, 모델이 한 문항을 두 번 냈을 때 둘째가
  //    **뒤 문항의 자리를 차지하고** 진짜 그 문항이 사라진다
  if (lineStart === 0) return false;
  const prevStart = plain.lastIndexOf('\n', lineStart - 2) + 1;
  const prev = cleanPrefix(plain.slice(prevStart, lineStart - 1));
  // ⚠️ 앞 줄은 **번호만 있는 줄**이어야 한다(코덱스 6R). 숫자 묶음만 견주면 `예시 1개` 같은
  //    멀쩡한 글줄이 1번 자리를 차지해, 중복 응답이 **진짜 문항을 밀어낸다**
  return LABEL_ONLY.test(prev) && matchesLabel(prev, label);
}

/**
 * 앞머리에서 구조 표시(목록·표 칸)와 공백을 벗긴다.
 * @param prefix - 물음 앞의 글
 * @returns 알맹이
 */
function cleanPrefix(prefix: string): string {
  // ⚠️ **표는 칸으로 끊어 본다**(코덱스 19R). 한 행을 통째로 보면 `| 지문 | 1. 표현법은? |`
  //    의 앞머리가 `지문 | 1.` 이 되어, 번호를 **맞추기는 하면서**(`matchesLabel` 은 숫자만
  //    본다) **지켜 주지는 않아**(`LABEL_ONLY` 는 통째로 본다) 중복 응답이 그 자리를 집어 간다.
  // ⚠️ 번호가 **제 칸을 따로 쓰는** 표(`| 1 | 표현법은? |`)도 흔해서, 물음이 있는 칸이
  //    비어 있으면 **바로 앞 칸**을 본다 — 거기까지가 이 물음의 번호 자리다
  const cells = prefix.split(/[|｜]/).map((cell) => cell.replace(LIST_MARK, '').trim());
  return cells[cells.length - 1] || cells[cells.length - 2] || '';
}

/**
 * 그 자리에 **어떤 번호든 붙어 있는가**.
 *
 * ⚠️ 번호가 안 맞는 자리를 **차례로 주워 가는 것을 막는다**(코덱스 6R). 어떤 문항의 번호가
 *    원문에 없으면 차례대로 앉히는데, 그때 **뒤 문항의 번호가 붙은 자리**까지 집어 가면
 *    그 문항이 통째로 사라진다 — 남의 번호가 붙은 자리는 남겨 둔다.
 * @param plain - 본문 평문
 * @param span - 물음이 있는 자리
 * @returns 제 줄 앞머리나 바로 앞 줄이 번호면 true
 */
export function carriesLabel(plain: string, span: LabelSpan): boolean {
  const lineStart = plain.lastIndexOf('\n', span.start - 1) + 1;
  // ⚠️ **목록 표시를 벗기고 본다**(코덱스 7R). `<li>` 가 만든 `- 2.` 를 번호로 못 알아보면
  //    그 자리를 '번호 없는 자리' 로 여겨 중복 응답이 집어 가고, 진짜 2번이 사라진다
  const own = cleanPrefix(plain.slice(lineStart, span.start));
  if (own !== '') return labelHeadAt(own, (token) => LABEL_ONLY.test(token)) !== null;
  if (lineStart === 0) return false;
  const prevStart = plain.lastIndexOf('\n', lineStart - 2) + 1;
  return LABEL_ONLY.test(cleanPrefix(plain.slice(prevStart, lineStart - 1)));
}
