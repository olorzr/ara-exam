import { foldStrict } from '@/lib/concept-pick/fold';
import {
  ANSWER_MARK, ANSWER_MARK_ALL, ANSWER_MARK_SOURCE, ARROW_MARK, ARROW_MARK_ALL, isAnswerMark,
  trailingMark,
} from './marks';
import {
  answerOccurrences, BLANK_SLOT, insideQuoted, isDiagramLine, quotedRanges, type TextSpan,
} from './redact-scan';

/**
 * 답 표시(`답:`·`→`) 뒤의 답을 **그 줄에서** 걷어내는 일 (순수 함수).
 *
 * `redact.ts` 에서 떼어 둔 까닭: 표시를 보고 자르는 일과 답의 자리를 빈칸으로 바꾸는 일은
 * **틀리는 방식이 다르고**(앞은 뒤따르는 과제를, 뒤는 선택지를 지운다) 한 파일에 두면
 * 300줄을 넘는다.
 *
 * ⚠️ 잘라 내는 범위는 **그 표시가 든 표 칸 안**, 그리고 답을 아는 경우 **그 답까지**다.
 *    줄 끝까지 자르면 옆 칸의 지문과 뒤따르는 과제가 함께 사라진다(코덱스 17R·19R).
 */

/**
 * 물음·지시문이 끝난 모양.
 *
 * 화살표를 답으로 볼지 가르고, 표시 뒤가 **답인지 지시문인지**(`답: 한 단어로 쓰시오.`)도 가린다.
 *
 * ⚠️ `~할 것.` 꼴도 담는다(코덱스 20R). 학습지의 지시문은 `한 문장으로 서술할 것.` 처럼
 *    적히는 일이 흔한데, 빠뜨리면 **답을 모르는 문항에서 그 지시문이 통째로 잘린다**.
 */
const QUESTION_END = /(?:[?？]|(?:시오|하라|하세요|세요|쓰라|보자|할 ?것|쓸 ?것|들 ?것)[.。]?)\s*$/;

/**
 * 그 글이 **물음·지시문으로 끝나는가**.
 *
 * ⚠️ **자모로 갈린 글(NFD)은 합쳐서 본다**(코덱스 33R). 맥에서 복사해 온 글은 `쓰시오` 가
 *    자모로 갈려 와, 합친 꼴만 보면 **지시문이 답으로 몰려 통째로 잘린다**. 배점 꼬리표도
 *    같은 까닭으로 합친 뒤에 뗀다. 여기서는 **판정만** 하므로 글자를 바꿔도 안전하다.
 * @param text - 한 줄 또는 표시 뒤의 글
 * @returns 지시문으로 끝나면 true
 */
function endsLikeQuestion(text: string): boolean {
  return QUESTION_END.test(text.normalize('NFC').trimEnd().replace(SCORE_TAIL, ''));
}

/**
 * 끝에 붙은 배점 꼬리표 — `(2점)`·`[3점]`.
 *
 * ⚠️ 지시문 끝을 볼 때는 **없는 셈 친다**(코덱스 13R). 안 그러면
 *    `갈래는? 답: 소설. 그 갈래의 특징 두 가지를 쓰시오. (2점)` 이 지시문으로 안 읽혀
 *    **둘째 과제와 배점이 통째로 잘린다**.
 */
const SCORE_TAIL = /[([{（［〔]\s*(?:배점\s*)?\d+(?:\.\d+)?\s*점\s*[)\]}）］〕]\s*$/;

/**
 * 문장이 끝나고 **또 글이 이어지는가** — 답 하나는 그렇게 생기지 않았다.
 *
 * `답: 소설. 그 특징을 서술할 것.` 처럼 답 뒤에 과제가 붙은 꼴을 가린다(코덱스 19R).
 *
 * ⚠️ **공백을 요구하지 않는다**(코덱스 27R). 스캔 글에는 `소설.다음 글을 읽고…` 처럼 마침표
 *    뒤 공백이 빠진 줄이 흔한데, 공백을 요구하면 그 **둘째 과제가 통째로 잘린다**.
 * ⚠️ 빼는 것은 **소수점뿐이다**(코덱스 28R). '뒤에 숫자가 오면 경계가 아니다' 로 하면
 *    `소설.1번 보기와 비교하기` 의 과제가 사라진다 — 자릿수 **사이**의 점만 가린다.
 */
const MULTI_SENTENCE = /[.。!?！？][ \t]*\S/;

/** 자릿수 사이의 점 — 문장 경계가 아니다 */
const DECIMAL_DOT = /(\d)\.(?=\d)/g;

/** 표 칸 경계 — 반각·전각 둘 다 쓰인다(코덱스 25R) */
const CELL_MARK = /[|｜]/;

/** 표시만 덩그러니 있는 줄 — 답을 걷어낸 뒤 남는다 (표시 모양은 `marks.ts` 한 벌) */
const MARK_ONLY_LINE = new RegExp(`^[ \\t]*(?:${ANSWER_MARK_SOURCE}|[→⇒]|-+>|=+>)[ \\t]*$`);

/** 줄에서 답을 걷어낸 결과 */
export interface CutResult {
  text: string;
  /** 걷어낸 줄 **다음 줄**이 답의 나머지일 수 있는가 */
  uncertain: boolean;
}

/**
 * 그 줄이 **답의 일부인가** — 우리가 따로 받아 둔 답과 글자가 같은가.
 *
 * ⚠️ 두 줄로 적은 답의 뒷줄을 가려내는 유일한 단서다(코덱스 17R). 말끝만 보면
 *    `상대방의 말을 끝까지 들으세요.` 같은 **답**이 지시문으로 보여 그대로 인쇄된다.
 * @param line - 한 줄
 * @param answer - 그 문항의 답
 * @returns 답 안에 그 줄이 통째로 들어 있으면 true
 */
function partOfAnswer(line: string, answer: string): boolean {
  const piece = foldStrict(line);
  if (piece === '' || answer === '') return false;
  // ⚠️ **줄끼리 견주는 것이 먼저다**(코덱스 18R). 글자 수로 가르면 `답: 가\n나` 처럼
  //    **한 음절짜리 답의 둘째 줄**이 그대로 문제지에 남는다
  if (answer.split('\n').some((row) => foldStrict(row) === piece)) return true;
  return piece.length > 1 && foldStrict(answer).includes(piece);
}

/**
 * 그 **줄**이 답을 걷어낼 수 있는 줄인가 (표시 뒤의 글은 `tailIsAnswer` 가 본다).
 * @param line - 한 줄
 * @param at - 표시가 시작하는 자리 (줄 안에서의 자리)
 * @param arrow - 화살표 표시인가
 * @param quoted - 그 표시가 인용 안에 있는가
 * @returns 걷어내도 되는 줄이면 true
 */
function cuttable(line: string, at: number, arrow: boolean, quoted: boolean): boolean {
  // ⚠️ 낱말 한복판의 '답' 은 표시가 아니다(코덱스 14R) — `대답: 학교에 갑니다.` 는 자료다
  if (!arrow && !isAnswerMark(line, at)) return false;
  // 인용 안의 표시는 물음이 그 표시 자체를 묻고 있는 것이다
  if (quoted) return false;
  // ⚠️ 빈칸이 **줄 어디에 있든** 아직 안 쓴 답이다(코덱스 12R) — `______ (답: 명사)` 의
  //    '답: 명사' 는 답이 아니라 **답의 꼴을 알려 주는 안내**다
  if (BLANK_SLOT.test(line)) return false;
  // ⚠️ 화살표가 여럿인 줄은 **그림**이다 — 표시 종류와 무관하게 건드리지 않는다(코덱스 12R)
  if (isDiagramLine(line)) return false;
  // 화살표는 글 속에서도 쓰인다 — **물음이 끝난 자리**에 온 것만 답으로 본다
  return !arrow || endsLikeQuestion(line.slice(0, at));
}

/**
 * 표시 뒤의 글이 **답인가** — 그 표시가 든 **표 칸 안까지만** 본다.
 *
 * ⚠️ 줄 끝까지 보면 안 된다(코덱스 19R). `답: 한 단어로 쓰시오. | 정답: 소설` 에서 줄 전체를
 *    보면 끝이 지시문이 아니라(`소설`) **지시문이 든 앞 칸까지 답으로 몰려 지워진다**.
 * ⚠️ **여러 문장이면 답이 아니다**(코덱스 19R). `답: 소설. 그 특징을 서술할 것.` 처럼 답 뒤에
 *    과제가 이어지는 꼴이 흔한데, 말끝을 아무리 모아도 국어의 지시문 어미를 다 담을 수 없다 —
 *    답을 아는 경우에는 **그 자리까지만** 자르고(`answerEnd`), 모르면 지우지 않고 알린다.
 * @param tail - 표시부터 칸 끝까지의 글
 * @param arrow - 화살표 표시인가
 * @param known - 그 글 안에서 **우리가 받아 둔 답**을 찾았는가
 * @returns 답이면 true
 */
function tailIsAnswer(tail: string, arrow: boolean, known: boolean): boolean {
  const after = tail.replace(arrow ? ARROW_MARK : ANSWER_MARK, '').trimEnd();
  // 표시 뒤에 글이 없으면 걷어낼 답이 없다 (다음 줄이 답인지 지시문인지는 못 가린다)
  if (after.trim() === '') return false;
  // ⚠️ **답이 표시 바로 뒤에 있으면 더 볼 것이 없다**(코덱스 20R). 그 자리까지만 자르므로
  //    뒤에 무엇이 이어지든 다치지 않는다 — `답: 은유. 그 특징을 쓰시오.` 에서 예전에는
  //    지시문 때문에 자르기를 포기했고, 그 바람에 빈칸 만들기가 **선택지**를 지웠다
  if (known) return true;
  // 표시 뒤가 **지시문**이면 답이 아니다 (`답: 한 단어로 쓰시오.`) — 배점은 떼고 본다
  if (endsLikeQuestion(after)) return false;
  return !MULTI_SENTENCE.test(after.normalize('NFC').replace(DECIMAL_DOT, '$1'));
}

/**
 * 걷어낸 줄 **뒤에 답의 나머지가 남았을 수 있는가**.
 *
 * ⚠️ 두 줄로 적은 답(`답: 상대를 존중하고\n상대의 처지를 배려한다.`)은 앞줄만 걷어내면
 *    **뒷줄이 그대로 문제지에 찍힌다**(코덱스 13R). 답을 아는 경우에는 그 줄을 이미 걷어냈고,
 *    남은 줄이 지시문이면 새 과제이므로 조용히 넘어간다(그것까지 경고하면 경고가 모든 문항에
 *    붙는다). **답을 모르면 언제나 알린다**(코덱스 29R).
 * @param lines - 걷어낸 뒤의 줄들
 * @param at - 걷어낸 줄의 자리
 * @param answer - 그 문항의 답 (없으면 '')
 * @returns 알려야 하면 true
 */
function tailUncertain(lines: readonly string[], at: number, answer: string): boolean {
  const next = lines.slice(at + 1).find((line) => line.trim() !== '');
  if (next === undefined) return false;
  // ⚠️ **답을 모르면 말끝로 가리지 않는다**(코덱스 29R). 국어 서술형 답은 `~세요.`·`~마라.`
  //    처럼 지시문과 **말끝이 같다** — `답: …마라.\n상대방의 말을 끝까지 들으세요.` 의 둘째
  //    문장이 답인데 지시문으로 보여 조용히 인쇄됐다. 답을 알 때는 그 줄을 이미 걷어냈다
  if (answer === '') return true;
  return !endsLikeQuestion(next);
}
/**
 * 답 표시 뒤를 그 줄에서 걷어낸다 — **표 칸 경계에서 멈춘다**.
 *
 * ⚠️ 평문의 한 줄이 곧 **표 한 행**일 수 있다(코덱스 17R). `답: 소설 | 다음 글: 봄이 왔다.`
 *    에서 줄 끝까지 자르면 옆 칸의 **지문이 함께 사라진다** — 그 자리는 이미 이 문항의
 *    구역이라 앞글로도 안 남는다.
 * @param line - 한 줄
 * @param at - 표시가 시작하는 자리
 * @returns 답만 걷어낸 줄
 */
function cutAt(line: string, cuts: readonly TextSpan[]): string {
  const merged: TextSpan[] = [];
  for (const span of [...cuts].sort((a, b) => a.start - b.start)) {
    const last = merged[merged.length - 1];
    if (last !== undefined && span.start <= last.end) last.end = Math.max(last.end, span.end);
    else merged.push({ ...span });
  }
  let out = line;
  for (const span of [...merged].reverse()) out = out.slice(0, span.start) + out.slice(span.end);
  // 잘라 낸 자리에서만 공백이 겹친다 — 그 자리만 다듬는다
  return out.replace(/[ \t]{2,}/g, ' ').trim();
}

/**
 * 그 줄에서 **걷어낼 답의 구간들**을 찾는다.
 *
 * ⚠️ **첫 답에서 멈추지 않는다**(코덱스 18R). 표로 짠 줄에는 답이 둘일 수 있는데
 *    (`답: 소설 | 다시 쓴 정답: 소설`) 하나만 걷으면 **뒤의 답이 문제지에 그대로 찍힌다**.
 * ⚠️ 구간의 끝은 **표 칸 경계(`|`)** 이거나, 답을 아는 경우 **그 답이 끝나는 자리**다 —
 *    줄 끝까지 지우면 옆 칸의 지문이나 뒤따르는 과제가 함께 사라진다.
 * @param line - 한 줄
 * @param lineStart - 그 줄이 글 전체에서 시작하는 자리
 * @param quoted - 글 전체의 인용 구간들
 * @param answer - 그 문항의 답 (없으면 '')
 * @returns 걷어낼 구간들 (없으면 빈 배열)
 */
function answerRanges(
  line: string,
  lineStart: number,
  quoted: readonly TextSpan[],
  answer: string,
): TextSpan[] {
  const out: TextSpan[] = [];
  for (const [mark, arrow] of [[ANSWER_MARK_ALL, false], [ARROW_MARK_ALL, true]] as const) {
    // ⚠️ **첫 표시만 보고 그만두지 않는다** — 앞에 인용된 표시가 있으면 거기서 멈춰
    //    뒤의 진짜 답이 문제지에 남는다
    for (const found of line.matchAll(mark)) {
      const at = found.index ?? 0;
      const cell = line.slice(at).search(CELL_MARK);
      const stop = cell < 0 ? line.length : at + cell;
      const tail = line.slice(at, stop);
      const hit = answer === ''
        ? null
        : adjacentAnswer(tail, (found[0] ?? '').length, answer);
      if (!cuttable(line, at, arrow, insideQuoted(quoted, lineStart + at))) continue;
      if (!tailIsAnswer(tail, arrow, hit !== null)) continue;
      out.push({ start: at, end: answerEnd(line, at, stop, hit) });
    }
  }
  return out;
}

/**
 * 걷어낼 구간의 끝 — 답을 알면 **그 답이 끝나는 자리**, 모르면 칸의 끝.
 * @param line - 한 줄
 * @param at - 표시가 시작하는 자리
 * @param stop - 표 칸(또는 줄)이 끝나는 자리
 * @param hits - 표시 뒤에서 찾은 답의 자리들 (칸 안에서의 자리)
 * @returns 걷어낼 구간의 끝
 */
function answerEnd(line: string, at: number, stop: number, hit: TextSpan | null): number {
  if (hit === null) return stop;
  let end = at + hit.end;
  // 답 바로 뒤의 마침표·쉼표까지 함께 걷는다 — 남기면 `갈래는? . 그 특징을…` 이 된다
  while (end < stop && /[.,。、·]/.test(line[end])) end += 1;
  return Math.min(end, stop);
}

/**
 * 표시 **바로 뒤**에 놓인 답의 자리.
 *
 * ⚠️ **마지막 자리를 쓰면 안 된다**(코덱스 20R). `답: 소설. 다음 보기에서 소설, 시를 비교할 것.`
 *    에서 뒤쪽 `소설` 까지 지우면 **비교 과제가 잘린다**. 답은 표시 바로 뒤에 적히므로,
 *    사이에 공백·따옴표 말고 다른 글자가 있으면 그 자리는 답이 아니다.
 * @param tail - 표시부터 칸 끝까지의 글
 * @param markLength - 표시 글자의 길이
 * @param answer - 그 문항의 답
 * @returns 답의 자리 (칸 안에서의 자리). 바로 뒤에 없으면 null
 */
function adjacentAnswer(tail: string, markLength: number, answer: string): TextSpan | null {
  // ⚠️ **표시 글자 뒤에서부터 찾는다**(코덱스 21R). `정답: 정답` 처럼 답이 표시와 같은 말이면
  //    표시 안의 글자가 먼저 잡혀 **표시만 지우고 진짜 답을 남긴다**
  const hit = answerOccurrences(tail, answer).find((span) => span.start >= markLength);
  if (hit === undefined) return null;
  const gap = tail.slice(markLength, hit.start);
  return /^[\s'"‘’“”「『《〈(（[［]*$/.test(gap) ? hit : null;
}

/**
 * 표시 뒤의 답을 **그 줄에서만** 걷어낸다.
 *
 * ⚠️ 물음 끝까지 자르지 않는다(코덱스 12R) — 뒤에 이어지는 과제가 사라진다.
 * @param question - 물음
 * @returns 답을 걷어낸 물음과, 뒷줄이 답의 나머지일 수 있는지
 */
export function cutMarkedAnswers(question: string, answer: string): CutResult {
  // ⚠️ 인용 구간은 **글 전체에서** 구한다(코덱스 15R). 줄마다 새로 구하면 여러 줄에 걸친
  //    대화 인용(`“질문: …\n답: …”`)의 아랫줄이 인용 밖으로 보여 **그 자료가 잘린다**
  const quoted = quotedRanges(question);
  const lines = question.split('\n');
  /** 줄 끝까지 잘라 낸 줄들 — 그 다음 줄만 답의 나머지일 수 있다 */
  const openRows: number[] = [];
  let base = 0;
  const cut = lines.map((line, index) => {
    const lineStart = base;
    base += line.length + 1;
    const ranges = answerRanges(line, lineStart, quoted, answer);
    if (ranges.length > 0) {
      // ⚠️ **줄 끝까지 잘라 냈을 때만** 다음 줄을 답의 나머지로 본다(코덱스 27R).
      //    `답: 소설 | 다음 보기` 처럼 뒤에 다른 칸이 남아 있으면 그 줄에서 답이 끝난 것이라,
      //    다음 줄은 답이 아니라 **문제가 보여 주는 낱말**이다
      if (ranges.some((span) => span.end >= line.length)) openRows.push(index);
      return cutAt(line, ranges);
    }
    // ⚠️ 걷어낸 답의 **나머지 줄**도 함께 걷는다(코덱스 17R). 우리가 받아 둔 답과 글자가
    //    같은 줄이라야 하므로 멀쩡한 지시문은 걸리지 않는다
    return openRows.includes(index - 1) && partOfAnswer(line, answer)
      ? (openRows.push(index), '')
      : line;
  });
  return {
    // 잘라 내며 빈 줄이 된 자리는 뗀다 — 원래 있던 빈 줄(문단 사이)은 그대로 둔다
    text: cut.filter((line, index) => line !== '' || lines[index] === '').join('\n'),
    uncertain: openRows.some((index) => tailUncertain(cut, index, answer)),
  };
}

/**
 * 걷어낸 자리에 남은 **표시만 있는 줄**과 겹친 빈 줄을 정리한다.
 *
 * ⚠️ 자르기와 떼기가 **둘 다 끝난 뒤에** 한 번 돈다(코덱스 15R). 자르기 안에서만 돌면
 *    `갈래는?\n답:\n소설` 에서 답 줄을 나중에 떼고 난 `답:` 이 그대로 남는다.
 * @param text - 가리고 난 물음
 * @returns 정리한 물음
 */
export function tidyLines(text: string): string {
  const out = text.split('\n');
  const quoted = quotedRanges(text);
  // ⚠️ **표시인지 한 번 더 본다**(코덱스 26R). 무턱대고 떼면 `…\n얼음\n→` 처럼 **그림의
  //    화살표**나 인용 안의 표시가 사라진다 — 자르기와 같은 규칙으로 판정한다
  while (out.length > 1 && MARK_ONLY_LINE.test(out[out.length - 1])) {
    const at = out.length - 1;
    const base = out.slice(0, at).reduce((n, row) => n + row.length + 1, 0);
    if (!endsWithMark(out[at], out[at - 1] ?? '', (i) => insideQuoted(quoted, base + i))) break;
    out.pop();
  }
  return out.filter((line, i, rows) => line !== '' || rows[i - 1] !== '').join('\n');
}

/**
 * 그 줄이 **물음·지시문으로 끝나는가** (배점 꼬리표는 떼고 본다).
 * @param line - 한 줄
 * @returns 지시문으로 끝나면 true
 */
export function endsLikeTask(line: string): boolean {
  return endsLikeQuestion(line);
}

/**
 * 그 줄이 **답 표시로 끝나는가** — 답은 다음 줄에 적혀 있다.
 * @param line - 한 줄
 * @returns 답 표시로 끝나면 true
 */
export function endsWithMark(
  line: string,
  before: string,
  quotedAt: (at: number) => boolean,
): boolean {
  const mark = trailingMark(line);
  if (mark === null) return false;
  // ⚠️ 인용 안의 표시는 물음이 그 표시 자체를 묻고 있는 것이다(코덱스 24R·25R·26R) —
  //    `“정답:”` 을 답 표시로 보면 그 줄과 아래 줄이 통째로 사라진다. 표시만 있는 줄도
  //    **똑같이** 본다: 대화 인용은 `"질문: …\n답:\n소설"` 처럼 여러 줄에 걸친다
  if (quotedAt(mark.at)) return false;
  if (!mark.arrow) return true;
  // ⚠️ 화살표는 글 속에서도 쓰인다(코덱스 23R·24R) — `소설 →` 로 끝나는 **자료 줄**이나
  //    `얼음\n→\n물` 의 그림 화살표를 표시로 보면 그 둘레가 지워진다. 제 줄이 표시뿐이면
  //    **앞 줄**이 물음으로 끝나야 한다
  const head = line.slice(0, mark.at).trimEnd();
  return endsLikeQuestion(head === '' ? before : head);
}
