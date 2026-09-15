'use client';

import { generateDraft } from '@/lib/ai/codex/generateDraft';
import { AiError } from '@/lib/ai/types';
import { PASSAGE_QUIZ_TEXT_LIMIT, PASSAGE_QUIZ_TIMEOUT_MS } from './constants';
import { parsePassageQuiz, type PassageQuizResult } from './parse';
import { buildPassageQuizPrompt } from './prompt';
import { PASSAGE_QUIZ_SCHEMA, type PassageQuizCounts } from './schema';

/**
 * 지문으로 O,X·단답형을 만들어 온다 (브라우저 전용).
 *
 * 이미지가 없어 한 번의 왕복이고 출력도 짧다 — 기출 읽기와 달리 묶음으로 나누지 않는다.
 * 들어오는 글은 이미 평문이다(붙여넣기이거나 `htmlToPlainText` 를 거친 값).
 */

export interface PassageQuizInput {
  /** 지문 평문 */
  text: string;
  title: string;
  author: string;
  counts: PassageQuizCounts;
  port: number;
  pref: { model: string | null; effort: string | null };
  signal?: AbortSignal;
}

/**
 * 문항을 만들어 온다.
 * @param input - 지문·개수·연결 정보
 * @returns 검증을 거친 문항과 버린 이유
 * @throws AiError - 지문이 비었거나 너무 길거나(`context_exceeded`) 읽지 못했을 때
 */
export async function runPassageQuiz(input: PassageQuizInput): Promise<PassageQuizResult> {
  const plain = input.text.replace(/\r\n?/g, '\n');
  if (plain.trim() === '') throw new AiError('invalid_output', '지문이 비어 있어요.');
  // 보내 보고 실패하는 것보다 먼저 알리는 편이 낫다 — 사람이 줄이면 해결되는 문제다
  if (plain.length > PASSAGE_QUIZ_TEXT_LIMIT) throw new AiError('context_exceeded');

  const raw = await generateDraft({
    port: input.port,
    prompt: buildPassageQuizPrompt({
      plain, title: input.title, author: input.author, counts: input.counts,
    }),
    outputSchema: PASSAGE_QUIZ_SCHEMA,
    model: input.pref.model,
    effort: input.pref.effort,
    signal: input.signal,
    timeoutMs: PASSAGE_QUIZ_TIMEOUT_MS,
  });

  const result = parsePassageQuiz(raw, { plain, counts: input.counts });
  if (!result) throw new AiError('invalid_output');
  return result;
}
