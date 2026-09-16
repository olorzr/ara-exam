'use client';

import { generateDraft } from '@/lib/ai/codex/generateDraft';
import { AiError } from '@/lib/ai/types';
import type { QuizReferenceText } from '@/lib/passage-quiz/reference';
import { PRINT_QA_ANSWER_TIMEOUT_MS, PRINT_QA_BUNDLE_LIMIT } from './constants';
import type { HandwrittenRange } from './handwriting';
import { parsePrintQaAnswers, type PrintQaAnswersResult } from './parse-answers';
import { buildPrintQaAnswerPrompt, type PrintQaAnswerTarget } from './prompt-answers';
import { PRINT_QA_ANSWER_SCHEMA } from './schema';

/**
 * 답이 비어 있거나 학생 필기뿐인 문항에 **모범답안**을 만들어 온다 (브라우저 전용).
 *
 * ⚠️ **프롬프트와 파서에 같은 참고자료 목록을 넘긴다.** 한쪽만 주면 모델은 자료를 보고 근거를
 *    적었는데 파서는 그 자료를 몰라 전부 '근거 없음' 으로 찍는다(또는 그 반대다) —
 *    `passage-quiz/run.ts` 와 같은 계약이다.
 */

export interface PrintQaAnswersInput {
  /** 프린트 본문 평문 — 문맥이자 근거를 찾는 첫 자리 */
  plain: string;
  targets: readonly PrintQaAnswerTarget[];
  /** 프린트에 인쇄돼 있던 작품 (없으면 생략) */
  work?: { title: string; author: string };
  /** 함께 읽힐 참고자료 (없어도 된다) */
  references?: readonly QuizReferenceText[];
  /** 프린트 평문에서의 손글씨 자리 — 학생이 적은 답을 근거로 치지 않으려고 넘긴다 */
  handwritten?: readonly HandwrittenRange[];
  port: number;
  pref: { model: string | null; effort: string | null };
  signal?: AbortSignal;
}

/**
 * 모범답안을 받아 온다.
 * @param input - 본문·물을 문항·참고자료·연결 정보
 * @returns 검증을 거친 답과 뺀 이유
 * @throws AiError - 물을 문항이 없거나 보낼 글이 너무 길거나 읽지 못했을 때
 */
export async function runPrintQaAnswers(
  input: PrintQaAnswersInput,
): Promise<PrintQaAnswersResult> {
  if (input.targets.length === 0) {
    throw new AiError('invalid_output', '모범답안을 만들 문항이 없어요.');
  }
  // 본문이 빈 참고자료는 여기서 뺀다 — 프롬프트·파서가 **같은 목록**을 봐야 한다
  const references = (input.references ?? []).filter((ref) => ref.plain.trim() !== '');
  const bundle = input.plain.length
    + references.reduce((sum, ref) => sum + ref.plain.length, 0)
    + input.targets.reduce((sum, t) => sum + t.question.length + t.lead.length, 0);
  if (bundle > PRINT_QA_BUNDLE_LIMIT) throw new AiError('context_exceeded');

  const raw = await generateDraft({
    port: input.port,
    prompt: buildPrintQaAnswerPrompt({
      plain: input.plain,
      targets: input.targets,
      work: input.work,
      references,
    }),
    outputSchema: PRINT_QA_ANSWER_SCHEMA,
    model: input.pref.model,
    effort: input.pref.effort,
    signal: input.signal,
    timeoutMs: PRINT_QA_ANSWER_TIMEOUT_MS,
  });

  const result = parsePrintQaAnswers(raw, {
    plain: input.plain,
    askedNos: input.targets.map((t) => t.no),
    references,
    handwritten: input.handwritten,
  });
  if (!result) throw new AiError('invalid_output');
  return result;
}
