import { foldStrict } from '@/lib/concept-pick/fold';
import type { QuizReferenceText } from '@/lib/passage-quiz/reference';
import { PRINT_QA_ANSWER_MAX, PRINT_QA_EVIDENCE_MAX } from './constants';
import type { HandwrittenRange } from './handwriting';
import { existsOutsideHandwriting, foldPlain } from './place';

/**
 * 모범답안 응답을 검증한다 (순수 함수).
 *
 * ⚠️ **근거를 못 찾아도 답은 버리지 않는다**(사용자 결정 2026-09-16 — O,X·단답형과 다른 대접).
 *    그쪽은 답이 지문에 **글자 그대로** 있어야 하는 문항이지만, 서술형 모범답안은 자료를
 *    **종합해서** 쓰는 것이 보통이라 근거 대조로 버리면 빈 문항만 남는다. 대신 `source` 를
 *    `null` 로 두어 화면과 교사용이 **'근거 없음' 을 반드시 찍게** 한다 — 선생님은 그 답만
 *    눈으로 확인하면 된다.
 *
 * ⚠️ 근거를 찾는 차례는 **프린트 본문 → 참고자료** 다. 프린트에 실린 지문이 본문 안에 있어
 *    대개 여기서 걸리고, 양쪽에 있는 구절은 프린트(`''`)로 적어 주는 편이 낫다 —
 *    선생님이 손에 든 것이 그 프린트다.
 *
 * ⚠️ 대조는 **`foldStrict`** 로 한다. 공백까지 지우면 '아버지가 방에' 와 '아버지 가방에' 가
 *    같아져 지어낸 근거가 그대로 통과한다.
 */

/** 검증을 통과한 답 하나 */
export interface PrintQaGeneratedAnswer {
  /** 이번 요청에서 매긴 일련번호 */
  no: number;
  answer: string;
  /** 근거 구절. 없으면 '' */
  evidence: string;
  /** 근거를 찾은 곳. `''` 는 프린트, 그 밖은 자료 이름, `null` 은 **어디에도 없음** */
  source: string | null;
}

/** 왜 적게 왔는지 */
export interface PrintQaAnswersDropped {
  /** 모양이 안 맞는다(빈 답·길이 초과·번호 없음) */
  malformed: number;
  /** 물어보지 않은 번호가 왔다 */
  unknownNo: number;
  /** 같은 번호가 두 번 왔다 */
  duplicate: number;
}

export interface PrintQaAnswersResult {
  answers: PrintQaGeneratedAnswer[];
  dropped: PrintQaAnswersDropped;
  /** 근거를 어디에서도 못 찾은 답의 수 — 사람에게 "확인해 달라" 고 말할 재료다 */
  withoutEvidence: number;
}

export interface PrintQaAnswersContext {
  /** 프린트 본문 평문 — 근거를 찾는 첫 자리 */
  plain: string;
  /** 물어본 일련번호들 */
  askedNos: readonly number[];
  /** 함께 보낸 참고자료 (프롬프트에 실은 것과 **같은 목록**이어야 한다) */
  references?: readonly QuizReferenceText[];
  /**
   * 프린트 평문에서의 손글씨 자리들.
   *
   * ⚠️ 그 자리에만 있는 구절은 **근거로 치지 않는다** — 학생이 연필로 적은(틀렸을 수도 있는)
   *    답을 'AI 가 프린트에서 찾은 근거' 로 내보이게 된다(코덱스 3R).
   */
  handwritten?: readonly HandwrittenRange[];
}

/**
 * 응답 JSON 을 검증해 답 목록으로.
 * @param raw - 검증 전 JSON 문자열
 * @param ctx - 본문 평문·물어본 번호·참고자료
 * @returns 답과 뺀 이유. 모양이 깨졌으면 null (빈 배열은 정상이다)
 */
export function parsePrintQaAnswers(
  raw: string,
  ctx: PrintQaAnswersContext,
): PrintQaAnswersResult | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object') return null;

  const value = parsed as Record<string, unknown>;
  if (!Array.isArray(value.answers)) return null;

  // 프린트가 **먼저다**. 빈 본문은 아예 빼 둔다 — 접으면 빈 글자가 되어 무엇에든 들어 있다고
  // 판정된다(`passage-quiz/parse.ts` 와 같은 함정)
  const printed = foldPlain(ctx.plain);
  const handwritten = ctx.handwritten ?? [];
  /** 프린트에 **인쇄된 글로** 있는가 (손글씨 자리는 빼고 본다) */
  const inPrint = (folded: string): boolean => (
    printed.text !== '' && existsOutsideHandwriting(printed, folded, handwritten)
  );
  /** 이 프린트에서 **손글씨 자리에만** 있는 말인가 */
  const handwrittenOnly = (folded: string): boolean => (
    handwritten.length > 0 && printed.text.includes(folded) && !inPrint(folded)
  );
  const references = (ctx.references ?? [])
    .filter((ref) => ref.plain.trim() !== '')
    .map((ref) => ({ label: ref.label, folded: foldStrict(ref.plain) }))
    .filter((src) => src.folded !== '');

  /**
   * 이 구절이 어디에 글자 그대로 있는가 — **프린트가 먼저다**.
   * @param folded - 접어 둔 구절
   * @returns 찾은 자료의 이름(프린트면 ''). 어디에도 없으면 null
   */
  const findSource = (folded: string): string | null => {
    if (inPrint(folded)) return '';
    // ⚠️ 이 프린트에서 **손글씨 자리에만** 있는 말은 어느 자료에서 찾았든 근거로 치지 않는다
    //    (코덱스 4R). 같은 프린트가 참고자료로 붙어 있으면 그 본문에는 손글씨 표시가 없어
    //    (`quiz-references/bodies.ts` 가 평문으로 만든다) 아이 답이 근거로 되살아난다
    if (handwrittenOnly(folded)) return null;
    return references.find((src) => src.folded.includes(folded))?.label ?? null;
  };

  const asked = new Set(ctx.askedNos);
  const seen = new Set<number>();
  const answers: PrintQaGeneratedAnswer[] = [];
  const dropped: PrintQaAnswersDropped = { malformed: 0, unknownNo: 0, duplicate: 0 };
  let withoutEvidence = 0;

  for (const entry of value.answers) {
    if (answers.length >= asked.size) break;
    if (!entry || typeof entry !== 'object') {
      dropped.malformed += 1;
      continue;
    }
    const row = entry as Record<string, unknown>;
    const no = typeof row.no === 'number' && Number.isInteger(row.no) ? row.no : null;
    const answer = typeof row.answer === 'string' ? row.answer.trim() : '';
    if (no === null || answer === '' || answer.length > PRINT_QA_ANSWER_MAX) {
      dropped.malformed += 1;
      continue;
    }
    // 물어보지 않은 번호는 어디에 붙일지 알 수 없다 — 아무 데나 붙이면 엉뚱한 답이 실린다
    if (!asked.has(no)) {
      dropped.unknownNo += 1;
      continue;
    }
    if (seen.has(no)) {
      dropped.duplicate += 1;
      continue;
    }
    seen.add(no);

    const evidence = (typeof row.evidence === 'string' ? row.evidence.trim() : '')
      .slice(0, PRINT_QA_EVIDENCE_MAX);
    const folded = foldStrict(evidence);
    // ⚠️ 접은 뒤에도 비었는지 본다. '|' 나 '#' 는 접으면 빈 글자가 되는데,
    //    빈 글자는 **무엇에든 들어 있어** 대조를 그냥 통과한다
    const source = folded === '' ? null : findSource(folded);
    if (source === null) withoutEvidence += 1;

    answers.push({
      no,
      answer,
      // 어디에도 없는 구절은 **근거로 싣지 않는다** — 찾을 수 없는 말을 인쇄하면
      // 선생님이 원문을 뒤지다 시간만 버린다. '근거 없음' 으로만 알린다
      evidence: source === null ? '' : evidence,
      source,
    });
  }

  return { answers, dropped, withoutEvidence };
}

/**
 * 뺀 것들의 총수.
 * @param dropped - 뺀 내역
 * @returns 합계
 */
export function answersDroppedTotal(dropped: PrintQaAnswersDropped): number {
  return dropped.malformed + dropped.unknownNo + dropped.duplicate;
}
