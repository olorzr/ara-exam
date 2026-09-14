'use client';

import { generateDraft } from '@/lib/ai/codex/generateDraft';
import { AiError } from '@/lib/ai/types';
import { CONCEPT_PICK_TEXT_LIMIT, CONCEPT_PICK_TIMEOUT_MS } from './constants';
import { parseConceptPicks, type ConceptPickResult } from './parse';
import { htmlToPlainText } from './plain-text';
import { buildConceptPickPrompt } from './prompt';
import { CONCEPT_PICK_SCHEMA } from './schema';

/**
 * 본문에서 빈칸으로 낼 용어를 골라 온다 (브라우저 전용).
 *
 * 이미지가 없어 한 번의 왕복이고 출력도 짧다 — 기출 읽기와 달리 묶음으로 나누지 않는다.
 */

export interface ConceptPickInput {
  /** 편집기 HTML */
  html: string;
  /** 이미 마킹된 용어 */
  existing: readonly string[];
  port: number;
  pref: { model: string | null; effort: string | null };
  signal?: AbortSignal;
}

/**
 * 추천을 받아 온다. 몇 개를 고를지는 AI 가 본문을 보고 정한다.
 * @param input - 본문·기존 마킹·연결 정보
 * @returns 고른 용어와 버린 이유
 * @throws AiError - 본문이 너무 길거나(`context_exceeded`) 읽지 못했을 때
 */
export async function runConceptPick(input: ConceptPickInput): Promise<ConceptPickResult> {
  const plain = htmlToPlainText(input.html);
  if (plain.trim() === '') throw new AiError('invalid_output', '본문이 비어 있어요.');
  // 보내 보고 실패하는 것보다 먼저 알리는 편이 낫다 — 사람이 줄이면 해결되는 문제다
  if (plain.length > CONCEPT_PICK_TEXT_LIMIT) throw new AiError('context_exceeded');

  const raw = await generateDraft({
    port: input.port,
    prompt: buildConceptPickPrompt({ plain, existing: input.existing }),
    outputSchema: CONCEPT_PICK_SCHEMA,
    model: input.pref.model,
    effort: input.pref.effort,
    signal: input.signal,
    timeoutMs: CONCEPT_PICK_TIMEOUT_MS,
  });

  const result = parseConceptPicks(raw, { plain, existing: input.existing });
  if (!result) throw new AiError('invalid_output');
  return result;
}
