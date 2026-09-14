'use client';

import { generateDraft } from '@/lib/ai/codex/generateDraft';
import { AiError } from '@/lib/ai/types';
import { htmlToPlainText } from '@/lib/concept-pick';
import { PRINT_WORDS_TEXT_LIMIT, PRINT_WORDS_TIMEOUT_MS } from './constants';
import { parsePrintWords, type PrintWordsResult } from './parse';
import { buildPrintWordsPrompt, type PrintWordsBundleMeta } from './prompt';
import { PRINT_WORDS_SCHEMA } from './schema';

/**
 * 읽어 둔 프린트 본문에서 어휘 목록을 뽑아 온다 (브라우저 전용).
 *
 * 프린트 읽기(OCR)와 **같은 턴에 묶지 않는다.** 까닭 둘:
 *   ① 목록의 '단어 등록' 버튼으로도 돌아야 하는데, 그 길에는 원본 PDF 를 다시 열 이유가 없다
 *      (이미 `ocr_html` 이 있다).
 *   ② OCR 은 쪽을 3장씩 나눠 읽으므로 단어가 배치마다 조각나 병합 규칙이 하나 더 생긴다 —
 *      완성된 본문을 한 번에 보면 그 문제가 아예 없다.
 */

export interface PrintWordsInput {
  /** 읽어 둔 프린트 본문 HTML */
  html: string;
  bundle: PrintWordsBundleMeta;
  port: number;
  pref: { model: string | null; effort: string | null };
  signal?: AbortSignal;
}

/**
 * 어휘 목록을 받아 온다.
 * @param input - 본문·프린트 정보·연결 정보
 * @returns 등록할 단어와 뺀 이유
 * @throws AiError - 본문이 비었거나 너무 길거나(`context_exceeded`) 읽지 못했을 때
 */
export async function runPrintWords(input: PrintWordsInput): Promise<PrintWordsResult> {
  const plain = htmlToPlainText(input.html);
  if (plain.trim() === '') throw new AiError('invalid_output', '읽어 둔 본문이 비어 있어요.');
  // 보내 보고 실패하는 것보다 먼저 알리는 편이 낫다
  if (plain.length > PRINT_WORDS_TEXT_LIMIT) throw new AiError('context_exceeded');

  const raw = await generateDraft({
    port: input.port,
    prompt: buildPrintWordsPrompt({ plain, bundle: input.bundle }),
    outputSchema: PRINT_WORDS_SCHEMA,
    model: input.pref.model,
    effort: input.pref.effort,
    signal: input.signal,
    timeoutMs: PRINT_WORDS_TIMEOUT_MS,
  });

  const result = parsePrintWords(raw, { plain });
  if (!result) throw new AiError('invalid_output');
  return result;
}
