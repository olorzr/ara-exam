'use client';

import { generateDraft } from '@/lib/ai/codex/generateDraft';
import { AiError } from '@/lib/ai/types';
import { PRINT_QA_SPLIT_TIMEOUT_MS, PRINT_QA_TEXT_LIMIT } from './constants';
import { readPlainWithHandwriting } from './handwriting';
import { parsePrintQaSplit, type PrintQaSplitResult } from './parse-split';
import { buildPrintQaSplitPrompt, type PrintQaBundleMeta } from './prompt-split';
import { PRINT_QA_SPLIT_SCHEMA } from './schema';

/**
 * 읽어 둔 프린트 본문을 **물음과 답으로 가른다** (브라우저 전용).
 *
 * 프린트 읽기(OCR)와 같은 턴에 묶지 않는 까닭은 `print-words` 와 같다:
 *   ① 이미 읽어 둔 프린트에서도 눌러 돌려야 하는데 그 길에는 원본 PDF 를 다시 열 이유가 없다.
 *   ② OCR 은 쪽을 3장씩 나눠 읽으므로 쪽 경계에 걸친 문항이 조각난다 — 완성된 본문을 한 번에
 *      보면 그 문제가 아예 없다.
 *
 * ⚠️ 이미지를 보내지 않는다. 손글씨인지 아닌지는 **OCR 이 남긴 `<em>` 자리**로 가리므로
 *    (`handwriting.ts`) 원본 그림이 필요 없다 — 그림까지 보내면 값도 시간도 몇 배가 된다.
 * ⚠️ 모델에게 보내는 평문과 파서가 대조하는 평문은 **같은 한 번의 변환**에서 나와야 한다.
 *    따로 만들면 손글씨 자리 좌표가 평문과 어긋난다.
 */

export interface PrintQaSplitInput {
  /** 읽어 둔 프린트 본문 HTML */
  html: string;
  bundle: PrintQaBundleMeta;
  /** 그 묶음이 손글씨를 옮겨 읽었는가 */
  includeHandwriting: boolean;
  /** 문항 id 앞머리 — 실행마다 달라야 옛 목록의 id 와 섞이지 않는다 */
  seed: string;
  port: number;
  pref: { model: string | null; effort: string | null };
  signal?: AbortSignal;
}

/**
 * 문답으로 나눠 온다.
 * @param input - 본문·프린트 정보·연결 정보
 * @returns 검증을 거친 문답과 뺀 이유
 * @throws AiError - 본문이 비었거나 너무 길거나(`context_exceeded`) 읽지 못했을 때
 */
export async function runPrintQaSplit(input: PrintQaSplitInput): Promise<PrintQaSplitResult> {
  // 평문과 손글씨 자리를 **한 번에** 얻는다 — 따로 구하면 좌표가 어긋나 엉뚱한 답이
  // 손글씨로 분류된다(`handwriting.ts`)
  const { plain, ranges } = readPlainWithHandwriting(input.html, input.includeHandwriting);
  if (plain.trim() === '') throw new AiError('invalid_output', '읽어 둔 본문이 비어 있어요.');
  // 보내 보고 실패하는 것보다 먼저 알리는 편이 낫다 — 사람이 줄이면 해결되는 문제다
  if (plain.length > PRINT_QA_TEXT_LIMIT) throw new AiError('context_exceeded');

  const raw = await generateDraft({
    port: input.port,
    prompt: buildPrintQaSplitPrompt({ plain, bundle: input.bundle }),
    outputSchema: PRINT_QA_SPLIT_SCHEMA,
    model: input.pref.model,
    effort: input.pref.effort,
    signal: input.signal,
    timeoutMs: PRINT_QA_SPLIT_TIMEOUT_MS,
  });

  const result = parsePrintQaSplit(raw, { plain, handwritten: ranges, seed: input.seed });
  if (!result) throw new AiError('invalid_output');
  return result;
}
