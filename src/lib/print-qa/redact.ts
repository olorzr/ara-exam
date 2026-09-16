import { foldStrict } from '@/lib/concept-pick/fold';
import { hasAnswerMarkLeft, stripTrailingMark } from './marks';
import { cutMarkedAnswers, endsWithMark, tidyLines } from './redact-cut';
import {
  answerOccurrences, answerSpan, BLANK_SLOT, hasFilledParens, insideQuoted, isDiagramLine,
  parenAround, quotedRanges,
} from './redact-scan';

/**
 * 물음 안에 섞여 들어온 **답만** 가린다 (순수 함수).
 *
 * ⚠️ 모델이 `1. 갈래는? 답: 소설` 한 줄을 통째로 `question` 으로 내는 일이 있다. 그러면
 *    `answer` 를 따로 받아 두어도 **문제지가 물음과 함께 답을 찍는다** — 문제지에서 답을
 *    감추는 장치(`showAnswers`)는 답 줄만 가리지 물음 속까지 보지 않는다.
 *
 * ⚠️⚠️ **오려 내는 범위는 '답 그 자체' 다**(코덱스 12R — 앞선 '표시부터 끝까지' 규칙을 뒤집음).
 *    표시를 만나면 물음 끝까지 잘라 버렸더니 `갈래는? 답: 소설\n그 갈래의 특징 두 가지를
 *    쓰시오.` 에서 **둘째 과제가 통째로 사라졌다.** 이제 둘만 한다:
 *      ① 답의 **자리를 알면 그 자리만** 빈칸으로 바꾼다(가장 안전하다).
 *      ② 표시 뒤의 답은 **그 줄에서만** 걷어낸다 — 다음 줄은 건드리지 않는다.
 *
 * ⚠️⚠️ **가릴지 말지를 글자로 정할 수 없을 때는 지우지 않고 `uncertain` 으로 알린다.**
 *    지우다가 빈칸·지시문·그림이 사라지는 쪽이 더 나쁘다는 것이 열세 라운드의 결론이다.
 *    알리는 자리가 셋이다(코덱스 13R):
 *      ① 답 표시가 아직 남아 있다(`hasAnswerMarkLeft`)
 *      ② 표시 뒤를 걷어냈는데 **다음 줄이 지시문이 아니다** — 그 줄이 답의 나머지일 수 있다
 *      ③ 원문에서 물음 안쪽에 있던 답을 **끝내 못 가렸다**(인용·그림이라 손대지 않았다)
 */




/** 학생이 채우던 빈 괄호 — 인쇄물에서 눈에 보이게 넓혀 둔다 */
const BLANK = '(　　　)';

/** 원문에서 알아낸 사실 — 글자만으로는 못 가리는 것을 여기서 받는다 */
export interface RedactOptions {
  /**
   * 원문에서 답을 찾은 자리가 **물음 안쪽뿐**이었는가.
   *
   * 물음 밖 어디에도 같은 말이 없을 때만 참이다 — 따로 적힌 답이 있으면 물음 속의 같은 말은
   * `다음 수의 절댓값을 구하시오. (5)` 처럼 **문제에 주어진 값**일 수 있어 건드리지 않는다.
   */
  answerInsideQuestion?: boolean;
}

/** 가린 결과 */
export interface RedactResult {
  /** 답을 가린 물음 */
  question: string;
  /**
   * 기계가 **가리지 못한 것이 남았는가** — 사람이 문제지를 한 번 봐야 한다.
   *
   * 부르는 쪽이 `dropped.answerInQuestion` 으로 세어 선생님에게 알린다.
   */
  uncertain: boolean;
}


/**
 * 물음 안의 **답 그 자리만** 빈칸으로 바꾼다.
 *
 * 자리를 고르는 규칙은 `redact-scan.ts` 의 `answerSpan` 에 있다 — 인용·그림은 건드리지 않고,
 * 글자 그대로 맞는 자리를 먼저 본다.
 * @param question - 물음
 * @param answer - 다듬어 둔 답
 * @returns 그 자리를 빈칸으로 바꾼 물음 (마땅한 자리가 없으면 그대로)
 */
function blankAnswerSpan(question: string, answer: string): string {
  const span = answerSpan(question, answer);
  if (span === null) return question;
  // 괄호가 감싸고 있으면 괄호까지 함께 빈칸으로 — 빈칸이 두 겹이 되지 않게 한다
  const wrap = parenAround(question, span) ?? span;
  return question.slice(0, wrap.start) + BLANK + question.slice(wrap.end);
}

/**
 * 물음 **끝 줄이 답 그 자체**면 그 줄을 뗀다.
 *
 * ⚠️ 그림 줄은 떼지 않는다 — 모델이 `→ 얼음 → 물 → 수증기` 를 답으로도 내면 문제를 못 쓰게 된다.
 * @param question - 물음
 * @param answer - 다듬어 둔 답
 * @returns 답 줄을 뗀 물음
 */
function dropAnswerOnlyLine(question: string, answer: string): string {
  const lines = question.split('\n');
  if (lines.some(isDiagramLine)) return question;
  // ⚠️ **접는 세기는 `foldStrict`** 다(코덱스 14R). 느슨하게 접으면 공백이 사라져
  //    `아버지 가방에` 와 `아버지가 방에` 가 같은 말이 된다 — 띄어쓰기를 묻는 문항의
  //    **선택지가 둘 다 지워졌다**. 똑같을 때만 뗀다
  const wanted = foldStrict(answer);
  if (wanted === '') return question;

  let cut = lines.length;
  for (let i = lines.length - 1; i >= 1; i -= 1) {
    const tail = foldStrict(lines.slice(i, cut).join(' '));
    if (tail.length > wanted.length) break;
    if (tail === wanted) cut = i;
  }
  // 같은 답을 두 번 적어 둔 줄도 함께 뗀다
  while (cut > 1 && foldStrict(lines[cut - 1]) === wanted) cut -= 1;
  if (cut >= lines.length) return question;
  // ⚠️⚠️ **앞 줄이 답 표시로 끝날 때만 뗀다**(코덱스 22R — 15R 의 '물음·지시문으로 끝나도
  //    뗀다' 를 뒤집음). `다음 수의 절댓값을 구하시오.\n5` 의 `5` 는 **문제에 주어진 값**인데
  //    지시문 뒤라는 이유로 떼어 **풀 수 없는 문제**를 만들었다. 우리가 지우는 것은 프린트가
  //    `답:`·`→` 로 답이라고 밝혀 둔 것뿐이고, 나머지는 남기고 `uncertain` 으로 알린다
  // ⚠️ 빈칸이 있는 줄은 **아직 안 쓴 답**이다(코덱스 26R) — 자르기와 같은 것을 본다.
  //    `다음 빈칸을 채우시오. ____ 답:\n명사` 의 빈칸과 답 꼴 안내가 함께 사라지던 자리다
  if (BLANK_SLOT.test(lines[cut - 1])) return question;
  // 인용 판정은 **글 전체** 기준이다 — 여러 줄에 걸친 대화 인용을 한 줄만 보면 놓친다
  const quoted = quotedRanges(question);
  const base = lines.slice(0, cut - 1).reduce((n, row) => n + row.length + 1, 0);
  const prevLine = lines[cut - 1];
  const okay = endsWithMark(prevLine, lines[cut - 2] ?? '', (at) => insideQuoted(quoted, base + at));
  if (!okay) return question;
  const kept = lines.slice(0, cut);
  // 답을 뗀 자리에 덩그러니 남는 표시(`갈래는? →`)도 함께 걷는다 — 표시인 것은 이미 봤다
  kept[kept.length - 1] = stripTrailingMark(kept[kept.length - 1], true);
  return kept.join('\n');
}

/**
 * 가리고 난 물음에 **답이 아직 그대로 있는가**.
 *
 * ⚠️ **낱말로 서 있는 자리만 센다**(코덱스 13R·15R). 느슨하게 보면 `‘아버지 가방에’` 가
 *    답 `아버지가 방에` 와 같아지고, 선택지 `은유와` 의 앞토막이 답 `은유` 로 보인다 —
 *    멀쩡히 가린 문항마다 경고가 붙어 **경고 전체를 안 믿게 된다**.
 * @param question - 가리고 난 물음
 * @param answer - 다듬어 둔 답
 * @returns 답이 남아 있으면 true
 */
function answerLeft(question: string, answer: string): boolean {
  return answerOccurrences(question, answer).length > 0;
}

/**
 * 물음에서 답을 가린다.
 * @param question - 모델이 옮겨 온 물음
 * @param answer - 그 문항의 답 (비어 있어도 표시 기반 가리기는 돈다)
 * @param options - 원문에서 본 사실
 * @returns 답을 가린 물음과, 사람이 확인해야 하는지
 */
export function redactAnswerInQuestion(
  question: string,
  answer: string,
  options: RedactOptions = {},
): RedactResult {
  const trimmed = answer.trim();
  const inside = options.answerInsideQuestion === true && trimmed !== '';
  // ⚠️ **표시부터 본다**(코덱스 15R — 앞선 차례를 뒤집음). 빈칸을 먼저 넣으면 그 빈칸이
  //    '아직 안 쓴 답' 으로 보여 **같은 줄의 진짜 답(`답: 은유`)을 자르지 못하고**,
  //    엉뚱하게 선택지가 빈칸이 된 문제지가 나간다
  const cut = cutMarkedAnswers(question, trimmed);
  let out = cut.text;
  // ⚠️ **표시로 이미 걷어냈으면 더 손대지 않는다**(코덱스 16R). 프린트가 `답:` 으로 답을
  //    밝혀 두었다면 그것이 답이고, 물음에 남은 같은 말은 **선택지나 물음의 글**이다 —
  //    `은유, 직유 중 표현법을 고르시오. 답: 은유` 에서 고를 것을 지우던 자리다
  if (inside && cut.text === question && answerLeft(out, trimmed)) {
    const dropped = dropAnswerOnlyLine(out, trimmed);
    out = dropped === out ? blankAnswerSpan(out, trimmed) : dropped;
  }
  const text = tidyLines(out).trimEnd();
  return {
    question: text,
    uncertain: cut.uncertain
      || hasAnswerMarkLeft(text)
      // 원문이 '이 답은 물음 안쪽에 있다' 고 말했는데 끝내 못 가렸으면 알린다
      || (inside && answerLeft(text, trimmed))
      // ⚠️ 답을 모르면 견줄 것이 없다 — **채워진 괄호**가 있으면 그것만으로 알린다(코덱스 30R)
      || (trimmed === '' && hasFilledParens(text)),
  };
}
