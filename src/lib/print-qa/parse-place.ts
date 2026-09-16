import { foldStrict } from '@/lib/concept-pick/fold';
import {
  PRINT_QA_ANSWER_MAX, PRINT_QA_ANSWER_REGION_MAX, PRINT_QA_LABEL_MAX,
  PRINT_QA_MAX_ITEMS, PRINT_QA_QUESTION_MAX,
} from './constants';
import { isHandwrittenSpan } from './handwriting';
import { carriesLabel, hasLabelBefore } from './label';
import {
  locateAll, locateAllAnswers, locateAnswer,
  type FoldedPlain, type Placement, type PlacedItem, type Span,
} from './place';
import { redactAnswerInQuestion } from './redact';
import type { PrintQaSplitContext, PrintQaSplitDropped } from './parse-split';
import type { PrintQaItem } from '@/types/print-scan';

/**
 * 물음과 답을 **원문 어디에 앉힐지** 정하는 두 단계 (순수 함수).
 *
 * `parse-split.ts` 에서 떼어 둔 까닭: 앉히는 일(자리 다툼·중복·구역)과 결과를 조립하는 일은
 * 서로 다른 관심사이고, 한 파일에 두면 300줄을 넘는다.
 */

/** 문자열 필드를 다듬어 꺼낸다 */
function str(row: Record<string, unknown>, key: string): string {
  return typeof row[key] === 'string' ? (row[key] as string).trim() : '';
}

/**
 * 답이 어디서 왔는가 — 나누기 단계에서 가릴 수 있는 세 갈래.
 *
 * `ai`·`teacher` 는 여기서 나올 수 없다(그 둘은 나중에 사람·모범답안이 붙인다).
 * @param answer - 옮겨 온 답
 * @param handwritten - 손글씨 자리에서 왔는가
 * @returns 답의 출처
 */
function answerSourceOf(answer: string, handwritten: boolean): PrintQaItem['answerSource'] {
  if (answer === '') return 'none';
  return handwritten ? 'handwritten' : 'printed';
}

/** 자리까지 정해진 물음 하나 (답은 아직 안 봤다) */
interface QuestionSlot {
  label: string;
  question: string;
  answer: string;
  /** 차례대로 찾은 자리. 못 찾았거나 차례가 엉키면 null */
  at: Placement | null;
  /** 원문에 있기는 한가 (차례와 무관하게) */
  verified: boolean;
}

/**
 * 1단계 — 물음을 차례대로 원문에서 찾는다.
 *
 * ⚠️ **중복은 글자가 아니라 자리로 가린다**(코덱스 2R). 학교 프린트에는 똑같은 물음이 여러 번
 *    나오는데(각 지문마다 '(1) 표현법은?'), 글자로 가리면 둘째부터 사라진다. 차례대로 찾으면
 *    진짜 반복은 **다른 자리**에 앉고, 모델이 한 문항을 두 번 낸 것은 **자리를 못 찾는다** —
 *    그때만 글자로 가린다(번호는 빼고 본다: 같은 물음을 '1' 과 '' 로 두 번 내는 일이 있다).
 * @param entries - 응답의 items 배열
 * @param plain - 본문 평문 (번호를 보려면 접기 전 글이 필요하다)
 * @param folded - 접어 둔 본문
 * @param dropped - 뺀 내역 (여기서 채운다)
 * @returns 자리까지 정해진 물음들
 */
export function placeQuestions(
  entries: readonly unknown[],
  plain: string,
  folded: FoldedPlain,
  dropped: PrintQaSplitDropped,
): QuestionSlot[] {
  const slots: QuestionSlot[] = [];
  /** 이미 앉힌 자리 (접힌 좌표) */
  const seenAt = new Set<number>();
  /** 접힌 좌표의 읽기 머리 — 문항은 인쇄된 차례대로 온다 */
  let cursor = 0;

  for (const entry of entries) {
    if (slots.length >= PRINT_QA_MAX_ITEMS) break;
    if (!entry || typeof entry !== 'object') {
      dropped.malformed += 1;
      continue;
    }
    const row = entry as Record<string, unknown>;
    const question = str(row, 'question');
    const text = foldStrict(question);
    // 접어서 빈 물음('…' 같은 것)은 대조도 못 하고 인쇄해도 빈칸이다
    if (question === '' || question.length > PRINT_QA_QUESTION_MAX || text === '') {
      dropped.malformed += 1;
      continue;
    }

    const label = str(row, 'label').slice(0, PRINT_QA_LABEL_MAX);
    const answer = str(row, 'answer').slice(0, PRINT_QA_ANSWER_MAX);

    // ⚠️ **번호로 자리를 고른다**(코덱스 3R · Stop 게이트). 같은 물음이 번호만 바꿔 여러 번
    //    나오는 프린트에서, 번호를 안 보면 모델이 한 문항을 두 번 냈을 때 둘째가 **뒤 문항의
    //    자리를 차지해** 그 문항이 사라진다. 번호가 붙은 자리가 하나도 없으면(모델이 번호를
    //    달리 적었거나 원문에 번호가 없는 꼴) 예전처럼 차례대로 고른다
    const free = locateAll(folded, question).filter((hit) => !seenAt.has(hit.foldedStart));
    // ⚠️ 번호가 가리키는 자리는 **차례보다 세다.** 모델이 문항 차례를 바꿔 내도 번호가
    //    맞는 자리에 앉힌다 — 아직 아무도 안 앉은 자리 가운데 앞쪽을 고른다
    const mine = free.filter((hit) => hasLabelBefore(plain, hit.span, label));
    // 번호가 원문에 없으면 차례대로 앉히되, **남의 번호가 붙은 자리는 건드리지 않는다**
    // (건드리면 그 번호의 진짜 문항이 자리를 잃고 중복으로 사라진다 — 코덱스 6R)
    const pool = mine.length > 0 ? mine : free.filter((hit) => !carriesLabel(plain, hit.span));
    const at = pool.find((hit) => hit.foldedStart >= cursor) ?? pool[0] ?? null;

    if (at !== null) {
      seenAt.add(at.foldedStart);
      // 읽기 머리는 **앞으로만** 간다 — 번호로 되돌아가 앉은 문항이 머리를 물리면
      // 뒤 문항이 이미 지나온 자리를 다시 훑는다
      if (at.foldedEnd > cursor) cursor = at.foldedEnd;
    }

    slots.push({
      label,
      question,
      answer,
      at,
      // 차례가 엉켜 자리를 못 쓰더라도 **원문에 있기는 한지**는 따로 본다
      verified: at !== null || locateAll(folded, question).length > 0,
    });
  }
  // ⚠️ **중복 판정은 두 번째 기회 뒤에 한다**(코덱스 20R). 먼저 가리면 번호 붙은 자리를
  //    지키느라 둘 다 자리를 못 얻은 반복 물음에서 **뒤엣것이 중복으로 지워지고**,
  //    그 물음과 답이 앞 문항의 앞글로 딸려 간다
  return dropDuplicates(seatLeftovers(slots, plain, folded, seenAt), dropped);
}

/**
 * 자리를 끝내 못 찾은 물음 가운데 **글자가 같은 것**을 가린다.
 *
 * 자리가 다르면 진짜 반복이고(학교 프린트에는 같은 물음이 여럿이다), 자리를 못 찾은 채
 * 글자까지 같으면 모델이 한 문항을 두 번 낸 것이다.
 * @param slots - 자리를 채운 물음들
 * @param dropped - 뺀 내역 (여기서 채운다)
 * @returns 중복을 가린 물음들
 */
function dropDuplicates(slots: QuestionSlot[], dropped: PrintQaSplitDropped): QuestionSlot[] {
  // ⚠️ **앞뒤를 모두 본다**(코덱스 24R). 앞에 나온 것만 보면, 자리를 못 얻은 응답이
  //    **뒤에 앉은 진짜 문항보다 먼저 왔을 때** 살아남아 같은 물음이 두 번 인쇄된다
  const seated = new Set(
    slots.filter((slot) => slot.at !== null).map((slot) => foldStrict(slot.question)),
  );
  const seen = new Set<string>();
  const out: QuestionSlot[] = [];
  for (const slot of slots) {
    const text = foldStrict(slot.question);
    if (slot.at === null && (seen.has(text) || seated.has(text))) {
      dropped.duplicate += 1;
      continue;
    }
    seen.add(text);
    out.push(slot);
  }
  return out;
}

/**
 * 자리를 못 찾은 문항에 **두 번째 기회**를 준다.
 *
 * ⚠️ 번호 붙은 자리를 지키느라(`carriesLabel`) 번호 없는 문항이 자리를 못 얻는 일이 있다
 *    (코덱스 19R). 자리를 모르면 앞글도 답 구역도 손글씨도 못 가릴 뿐 아니라, **물음 속
 *    답을 가릴 근거(`answerInsideQuestion`)마저 사라져 답이 그대로 인쇄된다.**
 *    번호를 가진 문항이 **전부 앉은 뒤**라 남은 자리를 줘도 남의 자리를 빼앗지 않는다.
 * @param slots - 1단계 결과
 * @param plain - 본문 평문
 * @param folded - 접어 둔 본문
 * @param seenAt - 이미 앉은 자리들 (여기서 더한다)
 * @returns 자리를 채운 물음들
 */
function seatLeftovers(
  slots: QuestionSlot[],
  plain: string,
  folded: FoldedPlain,
  seenAt: Set<number>,
): QuestionSlot[] {
  return slots.map((slot) => {
    if (slot.at !== null || !slot.verified) return slot;
    const free = locateAll(folded, slot.question)
      .filter((hit) => !seenAt.has(hit.foldedStart));
    const mine = free.filter((hit) => hasLabelBefore(plain, hit.span, slot.label));
    const at = mine[0] ?? free[0];
    if (at === undefined) return slot;
    seenAt.add(at.foldedStart);
    return { ...slot, at };
  });
}

/**
 * 2단계 — 그 물음의 답을 **자기 구역 안에서** 찾는다.
 *
 * ⚠️ 구역은 `이 물음의 끝 ~ 다음 물음의 시작` 이다(코덱스 2R). 문서 전체에서 찾으면 한참 뒤
 *    문항의 답에 걸려 읽기 머리가 그리로 건너뛰고, 사이의 문항들이 통째로 차례에서 밀려나
 *    그 지문들까지 함께 사라진다.
 * ⚠️ 구역에 없으면 **문서 전체에서 한 번 더 본다** — 답을 맨 뒤에 몰아 놓은 프린트가 있다.
 *    다만 그 자리는 **문항의 끝으로 쓰지 않는다**(앞글이 통째로 어긋난다).
 * @param slot - 자리까지 정해진 물음
 * @param index - 그 물음이 몇 번째인가
 * @param sortedStarts - 자리를 찾은 물음들의 시작점 (**원문 차례**로 정렬)
 * @param folded - 접어 둔 본문
 * @param ctx - 손글씨 자리·id 앞머리
 * @param dropped - 뺀 내역 (여기서 채운다)
 * @returns 자리까지 정해진 문항
 */
export function placeAnswer(
  slot: QuestionSlot,
  index: number,
  sortedStarts: readonly number[],
  folded: FoldedPlain,
  ctx: PrintQaSplitContext,
  dropped: PrintQaSplitDropped,
): PlacedItem {
  const at = slot.at;
  // 구역의 끝 — 다음 물음과 **거리 상한** 가운데 가까운 쪽. 거리 상한이 없으면 자리를 못 찾은
  // 문항이 끼어 있을 때 구역이 그 너머까지 벌어져 **뒤 문항의 답**을 제 답으로 삼는다.
  // ⚠️ 상한은 '답이 **시작**하기까지' 의 거리라 **답 길이를 함께 더한다**(코덱스 7R)
  const nextStart = at ? sortedStarts.find((start) => start >= at.foldedEnd) : undefined;
  const reach = PRINT_QA_ANSWER_REGION_MAX + foldStrict(slot.answer).length;
  const after = at
    ? Math.min(nextStart ?? folded.text.length, at.foldedEnd + reach)
    : undefined;
  let answer = slot.answer;
  let answerSpan: Span | null = null;
  /** 제 구역에서 찾았는가 — 그때만 문항의 끝으로 쓴다 */
  let inRegion = false;

  if (answer !== '') {
    const here = at
      ? locateAnswer(ctx.plain, folded, answer, at.foldedEnd, after ?? folded.text.length)
      : null;
    const anywhere = here ?? locateAnswer(ctx.plain, folded, answer, 0);
    if (anywhere === null) {
      // 프린트에 없는 답은 모델이 **문제를 푼** 것이다. 비우고 모범답안 대상으로 넘긴다
      dropped.answerNotInText += 1;
      answer = '';
    } else {
      answerSpan = anywhere.span;
      inRegion = here !== null;
    }
  }
  if (answerSpan !== null && !inRegion) dropped.answerOutOfRegion += 1;

  // ⚠️ **찾아 둔 자리 하나로 판단하지 않는다**(Stop 게이트). 두 문항의 답이 같은 말이면
  //    문서 전체에서 찾은 자리가 **앞 문항의 답**을 가리켜, 정작 물음에 끌려 들어온 답을
  //    못 뗀다. 물음 **안쪽을 직접** 뒤진다
  const inQuestion = at !== null && answer !== ''
    ? locateAnswer(ctx.plain, folded, answer, at.foldedStart, at.foldedEnd)
    : null;
  const answerInQuestion = inQuestion !== null;
  // ⚠️ **물음 밖 어디에도 답이 없을 때만** 지운다(코덱스 11R). 따로 적힌 답이 있으면 —
  //    제 구역이든 뒤쪽 정답표든 — 물음 속의 같은 말은 `다음 수의 절댓값을 구하시오. (5)`
  //    처럼 **문제에 주어진 값**일 수 있다. 지우면 풀 수 없는 문제가 되므로 놔두고 **알린다**
  // ⚠️ **고른 자리 하나만 보지 않는다**(코덱스 12R). 뒤쪽 정답표처럼 구역 밖에 있는 답은
  //    고르는 단계에서 안 잡힐 수 있어, 물음 속의 **주어진 값**을 답으로 오인해 지운다
  const answerElsewhere = at !== null && answer !== ''
    && locateAllAnswers(ctx.plain, folded, answer).some(
      (hit) => hit.span.start < at.span.start || hit.span.end > at.span.end,
    );
  const answerInsideQuestion = answerInQuestion && !answerElsewhere;
  const redacted = redactAnswerInQuestion(slot.question, answer, { answerInsideQuestion });
  // ⚠️ 가리고도 못 가린 것이 남았으면 **지우지 말고 알린다**(코덱스 10R·13R) — 자를지 말지를
  //    글자로 정하면 멀쩡한 빈칸·지시문·그림이 함께 사라진다. `uncertain` 이 세 갈래를 담는다:
  //    답 표시가 남았다 / 걷어낸 줄 뒤가 답의 나머지일 수 있다 / 물음 안쪽 답을 끝내 못 가렸다
  if ((answerInQuestion && answerElsewhere) || redacted.uncertain) {
    dropped.answerInQuestion += 1;
  }

  // ⚠️ 손글씨는 **제 구역에서 찾은 자리**를 가장 먼저 본다(코덱스 17R). 물음 안쪽을 먼저
  //    보면 `은유, 직유 중 …?` 의 **선택지**가 답 자리로 뽑혀, 바로 뒤에 손으로 쓴 답이
  //    '인쇄된 답' 이 되고 모범답안 대상에서도 빠진다.
  //    그다음이 물음 안쪽이다(코덱스 11R) — 구역에서 못 찾았을 때 문서 전체 검색이 앞 문항의
  //    인쇄된 같은 말을 집어 오는 것을 막는다
  const forHandwriting = (inRegion ? answerSpan : null) ?? inQuestion?.span ?? answerSpan;
  const handwritten = forHandwriting !== null && forHandwriting !== undefined
    && isHandwrittenSpan(forHandwriting, ctx.handwritten);
  return {
    item: {
      id: `${ctx.seed}-${index}`,
      label: slot.label,
      lead: '',
      // ⚠️ 물음 속에 답이 섞여 있으면 **가린다**(코덱스 5R) — 안 그러면 문제지가 물음과 함께
      //    답을 찍는다. 자리는 **가리기 전 글자**로 이미 찾아 두었다
      question: redacted.question,
      answer,
      answerSource: answerSourceOf(answer, handwritten),
      studentAnswer: handwritten ? answer : '',
      evidence: '',
      evidenceSource: null,
      verified: slot.verified,
      // 앞글은 **사람이 확인해야** 학생 문제지에 실린다(기본 꺼짐)
      leadApproved: false,
    },
    start: slot.at ? slot.at.span.start : null,
    // ⚠️ 문항의 끝은 **답이 끝나는 자리**다. 답을 제 구역에서 찾았을 때만 답 끝까지 가고,
    //    모를 때는 물음 끝에서 멈춘다.
    //    ⚠️ **줄 끝까지 밀지 않는다**(코덱스 13R — Stop 게이트의 '줄 끝까지' 규칙을 뒤집음).
    //    표로 짠 프린트는 `| 1. 갈래는? | 답: 소설 | 다음 글: … |` 처럼 **한 줄이 한 행**이라,
    //    줄 끝까지 밀면 그 행에 함께 실린 **지문이 어느 문항의 앞글도 되지 못하고 사라진다**
    //    (편집 화면에도 교사용에도 안 남는다). 답 뒤에 이어지는 글은 앞글로 넘기고, 그것이
    //    답의 나머지인지 지문인지는 **사람이 승인 게이트에서 가린다**(`leadApproved`)
    end: slot.at
      ? (inRegion && answerSpan ? answerSpan.end : slot.at.span.end)
      : null,
    // 물음과 답 **사이**의 글 — 지문을 물음 뒤에 싣는 프린트에서 이 자리가 곧 지문이다
    gap: slot.at && inRegion && answerSpan && answerSpan.start > slot.at.span.end
      ? { start: slot.at.span.end, end: answerSpan.start }
      : null,
  };
}
