import { foldStrict, foldWithMap } from '@/lib/concept-pick/fold';
import { LABEL_ONLY } from './label';

/**
 * 물음 안에서 **무엇이 어디에 있는지** 훑는 일 (순수 함수).
 *
 * `redact.ts` 에서 떼어 둔 까닭: 자리를 찾는 일과 지우는 일은 **틀리는 방식이 다르다** —
 * 자리를 잘못 찾으면 엉뚱한 곳을 지우고(코덱스 13R: 인용된 물음이 지워지고 정작 답은 남았다),
 * 지우는 규칙이 틀리면 지울 것을 못 지운다. 한 파일에 두면 300줄을 넘기도 한다.
 */

/** 글 안의 한 구간 */
export interface TextSpan {
  start: number;
  end: number;
}

/** 인용 부호 짝 — 여는 글자 → 닫는 글자 */
const QUOTE_PAIRS = new Map<string, string>([
  ['「', '」'], ['『', '』'], ['《', '》'], ['〈', '〉'],
  ['‘', '’'], ['“', '”'], ["'", "'"], ['"', '"'],
]);

/** 한 줄 안의 화살표 세기 — 여럿이면 답이 아니라 **그림**이다 */
const ARROWS = /[→⇒]|-+>|=+>/g;

/**
 * 빈칸을 그리는 자리 — 줄 어디에든 있으면 **아직 안 쓴 답**이다.
 *
 * 자르는 쪽과 빈칸으로 바꾸는 쪽이 **같은 것을 봐야 한다**(코덱스 17R) — 한쪽만 지키면
 * `답: ______ (답: 명사)` 의 답 꼴 안내를 다른 쪽이 지운다.
 */
export const BLANK_SLOT = /[_]{2,}|[-–—]{2,}|[(（][ \t　]*[)）]|[(（][_\-–—\s]+[)）]/;

/** 줄머리의 목록·표 칸 표시 — 번호 앞에 붙는다 */
const LIST_MARK = /^[ \t]*(?:[-*•]\s*|[|｜]\s*)/;

/** 줄 끝에 붙는 구두점만 남았는가 — `① 은유.` 의 마침표까지 선택지다(코덱스 18R) */
const TRAILING_PUNCT = /^[.,。、·;:：；！!?？…\s]*$/;

/**
 * 인용으로 묶인 구간들을 찾는다.
 * @param text - 물음
 * @returns 인용 구간들 (여는 글자부터 닫는 글자까지)
 */
export function quotedRanges(text: string): TextSpan[] {
  const out: TextSpan[] = [];
  let i = 0;
  while (i < text.length) {
    const close = QUOTE_PAIRS.get(text[i]);
    const end = close === undefined ? -1 : text.indexOf(close, i + 1);
    // ⚠️ **아포스트로피(`'`)만 한 줄 안에서 짝으로 본다**(코덱스 15R·25R). 줄을 넘겨
    //    짝지으면 글 속의 아포스트로피 하나가 저 아래 따옴표와 묶여 그 사이의 **진짜 답
    //    표시가 전부 '인용' 이 되고** 답이 문제지에 남는다. 큰따옴표와 여닫는 글자가 다른
    //    따옴표(「」·“”)는 **대화 자료처럼 여러 줄에 걸치는 것이 정상**이라 그대로 짝짓는다
    const sameLine = end >= 0 && !text.slice(i, end).includes('\n');
    if (end < 0 || (text[i] === "'" && !sameLine)) {
      i += 1;
      continue;
    }
    out.push({ start: i, end });
    i = end + 1;
  }
  return out;
}

/**
 * 그 자리가 **인용 안쪽**인가 — 인용된 말은 물음이 그것 자체를 묻고 있는 것이다.
 * @param quoted - 인용 구간들
 * @param at - 글 안의 자리
 * @returns 인용 안이면 true
 */
export function insideQuoted(quoted: readonly TextSpan[], at: number): boolean {
  return quoted.some((range) => range.start <= at && at < range.end);
}

/**
 * 한 줄이 **그림**인가 — 화살표가 여럿이면 답이 아니다.
 * @param line - 한 줄
 * @returns 그림이면 true
 */
export function isDiagramLine(line: string): boolean {
  return (line.match(ARROWS) ?? []).length > 1;
}

/**
 * 그 구간이 걸쳐 있는 줄들.
 * @param text - 물음
 * @param span - 구간
 * @returns 그 구간이 닿는 줄들
 */
export function linesAround(text: string, span: TextSpan): string[] {
  const start = text.lastIndexOf('\n', Math.max(span.start - 1, 0)) + 1;
  const end = text.indexOf('\n', Math.max(span.end - 1, 0));
  return text.slice(start, end < 0 ? text.length : end).split('\n');
}

/**
 * 그 구간이 **줄 하나를 통째로** 차지하는가.
 *
 * ⚠️ 그런 줄이 답인지 **선택지**인지는 글자로 가릴 수 없다(코덱스 14R). 끝 줄에 적힌 답은
 *    `dropAnswerOnlyLine` 이 이미 뗐으므로, 여기까지 온 '한 줄짜리 답' 은 가운데 줄이다 —
 *    `올바르게 띄어 쓴 문장을 고르시오.\n아버지가 방에\n아버지 가방에` 에서 빈칸으로 바꾸면
 *    **고를 것이 사라진다.** 손대지 않고 부르는 쪽이 알린다.
 * @param text - 물음
 * @param span - 답이 있는 자리
 * @returns 줄 전체면 true
 */
function coversWholeLine(text: string, span: TextSpan): boolean {
  const lineStart = text.lastIndexOf('\n', Math.max(span.start - 1, 0)) + 1;
  const lineEnd = text.indexOf('\n', span.end);
  const before = text.slice(lineStart, span.start).replace(LIST_MARK, '').trim();
  const after = text.slice(span.end, lineEnd < 0 ? text.length : lineEnd);
  // ⚠️ **번호가 붙은 줄도 줄 하나다**(코덱스 17R). `① 은유` 를 빈칸으로 바꾸면 고를 것이
  //    사라지는데, 앞머리의 `①` 때문에 '줄 전체' 로 안 보여 그대로 지워졌다
  return (before === '' || LABEL_ONLY.test(before)) && TRAILING_PUNCT.test(after);
}

/**
 * 그 구간을 **괄호가 감싸고 있으면** 괄호까지 포함한 구간.
 *
 * 괄호에 채워 넣은 답이 가장 확실한 답이다 — 빈칸으로 되돌릴 때 괄호를 함께 지워야
 * 빈칸이 두 겹(`((　　　))`)이 되지 않는다.
 * @param text - 물음
 * @param span - 답이 있는 자리
 * @returns 괄호까지 넓힌 구간. 감싸고 있지 않으면 null
 */
export function parenAround(text: string, span: TextSpan): TextSpan | null {
  let open = span.start - 1;
  while (open >= 0 && /\s/.test(text[open])) open -= 1;
  let close = span.end;
  while (close < text.length && /\s/.test(text[close])) close += 1;
  const wrapped = open >= 0 && '(（'.includes(text[open])
    && close < text.length && ')）'.includes(text[close]);
  return wrapped ? { start: open, end: close + 1 } : null;
}

/**
 * 낱말을 이루는 글자 — 답이 낱말 **한복판**에 묻혀 있으면 그것은 답이 아니라 물음의 글이다.
 *
 * ⚠️ **자모도 넣는다**(코덱스 19R). 국어 문항은 `(ㄱㄴ)` 처럼 자음으로 보기를 적는데,
 *    자모를 빼면 답 `ㄱ` 이 `ㄱㄴ` 한복판에서 잡혀 **보기가 빈칸이 된다**.
 */
const WORD_CHAR = /[\w가-힣\u3131-\u318E\u1100-\u11FF\uA960-\uA97F\uD7B0-\uD7FF]/;

/**
 * 그 자리가 **낱말 경계에 서 있는가**.
 *
 * 물음 안에서도(빈칸 만들기), 원문에서도(답의 자리 찾기) 같은 규칙을 쓴다.
 *
 * ⚠️ `은유와 직유 중 이 시의 표현법은?` 에서 답 `은유` 는 선택지 `은유와` 의 앞토막이다
 *    (코덱스 15R). 경계를 안 보면 그것을 빈칸으로 바꿔 **고를 것을 지워** 버린다.
 * @param text - 물음
 * @param span - 답이 있는 자리
 * @returns 낱말 하나로 서 있으면 true
 */
export function standsAlone(text: string, span: TextSpan): boolean {
  const before = text[span.start - 1];
  const after = text[span.end];
  return (before === undefined || !WORD_CHAR.test(before))
    && (after === undefined || !WORD_CHAR.test(after));
}

/**
 * 물음 안에서 답이 **낱말로 서 있는 자리**를 모두 찾는다.
 *
 * 가릴 자리를 고르는 데도, 가리고 난 뒤 **답이 남았는지 보는 데도** 같은 목록을 쓴다 —
 * 두 곳이 다른 기준을 쓰면 못 가린 것을 못 알리거나, 멀쩡한 물음마다 경고가 붙는다.
 *
 * ⚠️ **접는 세기는 `foldStrict` 하나다**(코덱스 15R — 13R 의 '느슨한 세기로 한 번 더' 를
 *    뒤집음). 공백을 지우고 보면 `아버지 가방에` 와 `아버지가 방에` 가 같은 말이 되는데,
 *    **띄어쓰기를 묻는 문항에서는 그 둘이 서로 답과 오답이다.** 띄어쓰기가 다르면 가리지
 *    않고 `uncertain` 으로 알린다 — 지우는 쪽이 늘 더 비싸다.
 * @param question - 물음
 * @param answer - 다듬어 둔 답
 * @returns 자리들 (없으면 빈 배열)
 */
export function answerOccurrences(question: string, answer: string): TextSpan[] {
  const target = foldStrict(answer);
  if (target === '') return [];
  const folded = foldWithMap(question, 'strict');
  const hits: TextSpan[] = [];
  for (let at = folded.text.indexOf(target); at >= 0;
    at = folded.text.indexOf(target, at + 1)) {
    const span = {
      start: folded.map[at],
      end: folded.map[at + target.length - 1] + 1,
    };
    if (standsAlone(question, span)) hits.push(span);
  }
  return hits;
}

/**
 * 괄호가 여러 겹이면 **가장 바깥까지** 넓힌 구간.
 *
 * ⚠️ 한 겹만 넓히면 `((소설))` 이 혼자 놓인 **선택지 줄**이 '줄 전체' 로 안 보여 빈칸이 된다
 *    (코덱스 34R).
 * @param text - 물음
 * @param span - 답이 있는 자리
 * @returns 괄호를 모두 넓힌 구간 (괄호가 없으면 그대로)
 */
function outerParens(text: string, span: TextSpan): TextSpan {
  let out = span;
  for (;;) {
    const wrap = parenAround(text, out);
    if (wrap === null) return out;
    out = wrap;
  }
}

/**
 * 물음 안에서 **가려도 되는 답의 자리**를 고른다.
 *
 * ⚠️ **글자 그대로 맞는 자리를 먼저 본다**(코덱스 13R). 느슨하게 접어 첫 자리를 집으면
 *    `‘아버지 가방에’를 올바르게 띄어 쓰면? (아버지가 방에)` 에서 **인용된 물음거리**가
 *    빈칸이 되고 괄호 속 **진짜 답은 그대로 남는다** — 가리려던 것과 정반대가 된다.
 * ⚠️ **인용 안쪽·그림 줄·줄 전체는 건드리지 않는다.** 인용은 물음이 묻고 있는 말이고, 화살표가
 *    여럿인 줄은 학생이 들여다봐야 할 그림이다(코덱스 13R — 줄 떼기에만 있던 그림 보호가
 *    빈칸 만들기에는 없어서, 떼기가 거부한 그림을 빈칸 만들기가 지웠다).
 * @param question - 물음
 * @param answer - 다듬어 둔 답
 * @returns 가릴 자리. 마땅한 자리가 없으면 null (그때는 **지우지 말고 알린다**)
 */
export function answerSpan(question: string, answer: string): TextSpan | null {
  const quoted = quotedRanges(question);
  const hits = answerOccurrences(question, answer).filter((span) => (
    !insideQuoted(quoted, span.start)
    && !linesAround(question, span).some(isDiagramLine)
    // ⚠️ 빈칸이 있는 줄은 **아직 안 쓴 답**이다(코덱스 17R) — 자르는 쪽과 같은 것을 본다
    && !linesAround(question, span).some((line) => BLANK_SLOT.test(line))
    // ⚠️ **괄호까지 넓혀 놓고 본다**(코덱스 23R). 안쪽 낱말만 보면 `(소설)` 이 혼자 놓인
    //    **선택지 줄**이 '줄 전체' 로 안 보여 그대로 빈칸이 된다
    && !coversWholeLine(question, outerParens(question, span))
  ));
  // ⚠️⚠️ **괄호에 채워 넣은 답만 빈칸으로 바꾼다**(코덱스 22R — 앞선 '그 밖에는 뒤쪽 자리'
  //    규칙을 뒤집음). 괄호가 없는 낱말이 답인지 **고를 말**인지는 글자로 가릴 수 없어서,
  //    `다음 중 표현법을 고르시오. 은유, 직유` 의 선택지가 빈칸이 됐다. 우리가 지우는 것은
  //    **프린트가 답이라고 밝혀 둔 것**뿐이다 — 표시(`답:`)는 자르기가, 괄호는 여기가 맡는다
  const wrapped = hits.filter((span) => parenAround(question, span) !== null);
  const last = wrapped[wrapped.length - 1];
  // 괄호가 여러 겹이면 바깥까지 함께 빈칸으로 — `((　　　))` 이 남지 않게 한다
  return last === undefined ? null : outerParens(question, last);
}

/** 괄호 속이 통째로 빈칸인가 — 아직 안 쓴 답란 */
const BLANK_ONLY = /^[_\-–—\s　]*$/;

/** 괄호 속이 배점 꼬리표인가 */
const SCORE_INNER = /^(?:배점\s*)?\d+(?:\.\d+)?\s*점$/;

/**
 * 물음에 **채워진 괄호**가 있는가 — 답을 모를 때 사람에게 알리는 단서다.
 *
 * ⚠️ 답이 비어 있으면 빈칸으로 바꿀 것도, 견줄 것도 없어 **아무 말도 못 하고 있었다**
 *    (코덱스 30R). 괄호는 이 프린트가 답을 밝히는 두 꼴 가운데 하나이므로, 채워져 있으면
 *    **지우지는 않되 알린다.** 번호(`(가)`·`(1)`)·배점(`(2점)`)·빈 답란은 뺀다.
 * @param text - 가리고 난 물음
 * @returns 채워진 괄호가 있으면 true
 */
export function hasFilledParens(text: string): boolean {
  const open: number[] = [];
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === '(' || ch === '（') open.push(i);
    else if ((ch === ')' || ch === '）') && open.length > 0) {
      // ⚠️ **겹친 괄호도 본다**(코덱스 33R). 안쪽만 보면 `(은유(ㄱ))` 에서 번호 `(ㄱ)` 만
      //    보고 **채워진 바깥 괄호를 지나친다**
      const inner = text.slice((open.pop() ?? 0) + 1, i).trim();
      // ⚠️ **빈 답란은 속이 온통 빈칸일 때뿐이다**(코덱스 34R). 안쪽 어딘가에 빈칸이 있다고
      //    넘기면 `(소설(__))` 처럼 **채워진 답이 든 괄호**를 지나친다
      if (inner === '' || BLANK_ONLY.test(inner)) continue;
      if (LABEL_ONLY.test(inner) || SCORE_INNER.test(inner)) continue;
      return true;
    }
  }
  return false;
}
