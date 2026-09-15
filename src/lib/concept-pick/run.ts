'use client';

import { generateDraft } from '@/lib/ai/codex/generateDraft';
import { AiError } from '@/lib/ai/types';
import { chunkPlainText } from './chunk';
import {
  CONCEPT_PICK_CHUNK_CHARS, CONCEPT_PICK_TEXT_LIMIT, CONCEPT_PICK_TIMEOUT_MS,
} from './constants';
import { parseConceptPicks, type ConceptPickDropped, type ConceptPickResult } from './parse';
import { htmlToPlainText } from './plain-text';
import { buildConceptPickPrompt } from './prompt';
import { CONCEPT_PICK_SCHEMA } from './schema';

/**
 * 본문에서 빈칸으로 낼 용어를 골라 온다 (브라우저 전용).
 *
 * 본문을 **묶음으로 나눠 묶음마다 한 번씩** 묻는다. 선생님 기준대로 뚫으면 시험지 한 장에
 * 수백 개가 되는데, 한 응답에 담으면 스키마 상한에 잘려 **뒤쪽 본문이 통째로 빈칸 없이** 남는다.
 *
 * ⚠️ 묶음 하나가 끝날 때마다 `onChunk` 로 올린다 — 부르는 쪽이 **받는 즉시 마킹**하므로
 *    중간에 취소해도 거기까지는 남는다. 다 모아서 한 번에 돌려주면 취소가 곧 전부 잃는 일이 된다.
 */

export interface ConceptPickInput {
  /** 편집기 HTML */
  html: string;
  /** 이미 마킹된 용어 */
  existing: readonly string[];
  port: number;
  pref: { model: string | null; effort: string | null };
  signal?: AbortSignal;
  /** 묶음 하나가 끝날 때마다 (1부터 세는 번호) */
  onChunk?: (result: ConceptPickResult, index: number, total: number) => void;
}

/** 묶음별 결과를 하나로 */
function merge(results: readonly ConceptPickResult[]): ConceptPickResult {
  const dropped: ConceptPickDropped = { notInText: 0, duplicate: 0, malformed: 0 };
  for (const r of results) {
    dropped.notInText += r.dropped.notInText;
    dropped.duplicate += r.dropped.duplicate;
    dropped.malformed += r.dropped.malformed;
  }
  return { picks: results.flatMap((r) => r.picks), dropped };
}

/**
 * 추천을 받아 온다. 몇 개를 고를지는 본문 길이에 따라 AI 가 정한다(프롬프트의 밀도 규칙).
 * @param input - 본문·기존 마킹·연결 정보·묶음 콜백
 * @returns 모든 묶음의 추천과 버린 이유를 합친 것
 * @throws AiError - 본문이 너무 길거나(`context_exceeded`) 읽지 못했을 때, 취소됐을 때(`cancelled`)
 */
export async function runConceptPick(input: ConceptPickInput): Promise<ConceptPickResult> {
  const plain = htmlToPlainText(input.html);
  if (plain.trim() === '') throw new AiError('invalid_output', '본문이 비어 있어요.');
  // 보내 보고 실패하는 것보다 먼저 알리는 편이 낫다 — 사람이 줄이면 해결되는 문제다
  if (plain.length > CONCEPT_PICK_TEXT_LIMIT) throw new AiError('context_exceeded');

  const chunks = chunkPlainText(plain, CONCEPT_PICK_CHUNK_CHARS);
  const results: ConceptPickResult[] = [];
  // 앞 묶음에서 고른 것을 계속 넘긴다 — 안 그러면 같은 말이 묶음마다 다시 온다
  const taken: string[] = [...input.existing];

  for (const [i, chunk] of chunks.entries()) {
    const raw = await generateDraft({
      port: input.port,
      prompt: buildConceptPickPrompt({
        plain: chunk,
        existing: taken,
        chunk: { index: i + 1, total: chunks.length },
      }),
      outputSchema: CONCEPT_PICK_SCHEMA,
      model: input.pref.model,
      effort: input.pref.effort,
      signal: input.signal,
      timeoutMs: CONCEPT_PICK_TIMEOUT_MS,
    });

    // ⚠️ '본문에 있는가' 는 **이 묶음** 안에서 본다 — 모델이 본 것이 그것뿐이다.
    //    본문 전체로 견주면 다른 묶음에서 주워 온 말이 통과한다
    const result = parseConceptPicks(raw, { plain: chunk, existing: taken });
    if (!result) throw new AiError('invalid_output');

    // ⚠️ **못 붙인 추천도 여기 남긴다**(코덱스 리뷰 2R). `addMarkByText` 는 문서 전체에서
    //    찾으므로 한 번 못 붙인 말은 다음 묶음에서도 못 붙인다 — 다시 받아 봐야 '자리를 못 찾은
    //    용어' 목록만 같은 이름으로 불어난다. 그래서 파서의 `existing`('이미 마킹된 것')보다
    //    한 발 넓은 '이번 실행에서 이미 다룬 것' 으로 쓴다
    for (const pick of result.picks) taken.push(pick.text);
    results.push(result);
    input.onChunk?.(result, i + 1, chunks.length);
  }

  return merge(results);
}
