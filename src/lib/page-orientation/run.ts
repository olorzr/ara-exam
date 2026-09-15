'use client';

import { generateDraft } from '@/lib/ai/codex/generateDraft';
import { AiError, isAiError } from '@/lib/ai/types';
import { encodeAt } from '@/lib/pdf/pdfBudget';
import type { OpenPdf } from '@/lib/pdf/pdfPages';
import { renderPdfPage, type PageRotation } from '@/lib/pdf/pdfRenderer';
import {
  ORIENTATION_JPEG_QUALITY, ORIENTATION_MAX_SIDE, ORIENTATION_TIMEOUT_MS,
} from './constants';
import { chunkPages } from './chunk';
import { parseOrientation } from './parse';
import { buildOrientationPrompt } from './prompt';
import { ORIENTATION_SCHEMA } from './schema';

/**
 * 스캔한 쪽들의 방향을 미리 확인한다 (브라우저 전용).
 *
 * 읽기 **전에** 한 번 돌고, 결과를 렌더 단계가 그대로 쓴다. 작은 이미지로 방향만 묻기 때문에
 * 본문 읽기에 견주면 아주 싸다.
 *
 * ⚠️ 이 단계의 실패가 읽기를 막으면 안 된다. 취소만 던지고 나머지 오류는 그 묶음을
 *    '돌리지 않음' 으로 두고 넘어간다 — 예전처럼 원본 그대로 읽는 것일 뿐이다.
 */

/** 쪽 → 방향 판정 결과 */
export interface PageOrientation {
  /** 바로 세우려고 돌릴 각도 (0 인 쪽은 넣지 않는다) */
  rotations: Map<number, PageRotation>;
  /** 글자가 없다고 본 쪽 — 안 읽혔을 때 경고할지 가리는 데 쓴다 */
  blankPages: Set<number>;
}

export interface OrientationEnv {
  port: number;
  pref: { model: string | null; effort: string | null };
  signal?: AbortSignal;
  /** 진행률 (done, total) — 쪽 단위 */
  onProgress?: (done: number, total: number) => void;
}

/**
 * 쪽들의 방향을 확인한다.
 * @param doc - 열어 둔 PDF
 * @param pages - 확인할 쪽 번호들
 * @param env - 포트·모델·취소·진행률
 * @returns 돌릴 각도와 빈 쪽 목록
 * @throws AiError - 사람이 취소했을 때만
 */
export async function probePageOrientation(
  doc: OpenPdf,
  pages: readonly number[],
  env: OrientationEnv,
): Promise<PageOrientation> {
  const rotations = new Map<number, PageRotation>();
  const blankPages = new Set<number>();

  const batches = chunkPages(pages);
  const total = batches.reduce((n, b) => n + b.length, 0);
  let done = 0;

  for (const batch of batches) {
    if (env.signal?.aborted) throw new AiError('cancelled');

    // 그리지 못한 쪽은 **묶음에서 빼고** 나머지로 묻는다 — 한 쪽 때문에 전부 포기하지 않는다.
    // ⚠️ 순번이 곧 쪽이므로 뺀 쪽은 `asked` 에서도 빠져야 답이 엉뚱한 쪽에 붙지 않는다
    const images: string[] = [];
    const asked: number[] = [];
    for (const page of batch) {
      if (env.signal?.aborted) throw new AiError('cancelled');
      try {
        // 배율 1 — 방향만 보면 되므로 읽기용(2·3배)만큼 크게 그릴 이유가 없다
        const canvas = await renderPdfPage(doc.pdf, page, 1);
        images.push(encodeAt(canvas, ORIENTATION_MAX_SIDE, ORIENTATION_JPEG_QUALITY));
        asked.push(page);
      } catch {
        // 못 그린 쪽은 '돌리지 않음' 으로 둔다. 읽기는 원본 그대로 하면 된다
      }
      // 쪽마다 메인스레드를 양보한다(renderPagesToImages 와 같은 규약)
      await new Promise((resolve) => { setTimeout(resolve, 0); });
    }

    done += batch.length;
    if (images.length === 0) {
      // ⚠️ 여기서도 취소를 본다 — 마지막 묶음이 통째로 렌더에 실패하면서 그 사이 취소되면
      //    아무 검사도 안 거치고 **정상 반환**이 되어, 부른 쪽이 취소를 못 알아챈다
      if (env.signal?.aborted) throw new AiError('cancelled');
      env.onProgress?.(done, total);
      continue;
    }

    try {
      if (env.signal?.aborted) throw new AiError('cancelled');
      const raw = await generateDraft({
        port: env.port,
        prompt: buildOrientationPrompt(asked.length),
        outputSchema: ORIENTATION_SCHEMA,
        model: env.pref.model,
        effort: env.pref.effort,
        images,
        signal: env.signal,
        timeoutMs: ORIENTATION_TIMEOUT_MS,
      });

      const judged = parseOrientation(raw, asked.length);
      asked.forEach((page, i) => {
        const { rotation, hasText } = judged[i];
        if (rotation !== 0) rotations.set(page, rotation);
        if (!hasText) blankPages.add(page);
      });
    } catch (e) {
      // 취소는 사람이 한 일이라 그대로 올린다. 나머지는 원본 그대로 읽으면 된다
      if (isAiError(e) && e.code === 'cancelled') throw e;
    }

    env.onProgress?.(done, total);
  }

  if (env.signal?.aborted) throw new AiError('cancelled');
  return { rotations, blankPages };
}
