'use client';

import { useCallback, useRef, useState } from 'react';
import { toast } from 'sonner';
import { aiErrorMessage } from '@/lib/ai/errors';
import { isAiError } from '@/lib/ai/types';
import { getCodexModelPref } from '@/lib/ai/localModelPref';
import { getCodexPort } from '@/lib/ai/localPort';
import { signProblemFile } from '@/lib/problem-bank/storage';
import { readPassageContinuation } from '@/lib/problem-ocr/continue-passage';
import type { OcrSourceMeta } from '@/lib/problem-ocr/prompt';
import type { ProblemSource } from '@/types/problem-bank';
import { ocrStillEnabled } from './useProblemOcr';

/**
 * 검수 화면에서 지문의 **뒷부분만** 다음 쪽에서 다시 읽어 오는 훅.
 *
 * 이미 아카이브에 들어간 지문이 잘려 있을 때, 시험지를 통째로 다시 읽지 않고
 * 그 쪽 한 장만 보낸다(ChatGPT 1회).
 *
 * ⚠️ 읽어 온 글을 **저장하지 않는다.** 편집기에 이어 붙여 보여 주고 저장은 사람이 누른다.
 */

/** 출처 행에서 프롬프트에 실을 메타만 추린다 */
function toOcrMeta(source: ProblemSource): OcrSourceMeta {
  return {
    source_type: source.source_type,
    title: source.title,
    school_name: source.school_name,
    year: source.year,
    grade: source.grade,
    semester: source.semester,
    exam_type: source.exam_type,
    publisher: source.publisher,
    textbook: source.textbook,
  };
}

export interface ContinuationRead {
  html: string;
  continues: boolean;
  warnings: string[];
}

export function usePassageContinuation(source: ProblemSource | null) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const cancel = useCallback(() => abortRef.current?.abort(), []);

  /**
   * 한 쪽을 다시 읽어 이어지는 본문을 가져온다.
   * @param passageId - 어느 지문의 뒤를 잇는가 (진행 표시에만 쓴다)
   * @param page - 읽을 쪽
   * @param soFarHtml - 지금까지의 본문 — 끝부분을 단서로 보낸다
   * @returns 읽어 온 본문. 실패하면 null
   */
  const read = useCallback(async (
    passageId: string,
    page: number,
    soFarHtml: string,
  ): Promise<ContinuationRead | null> => {
    if (!source || abortRef.current) return null;
    if (!source.file_path) {
      toast.error('원본 PDF 가 없어요. 업로드가 실패한 출처예요.');
      return null;
    }
    // 킬스위치는 시작 직전에 다시 본다 — 탭을 열어 둔 사이 껐을 수 있다
    if (!(await ocrStillEnabled())) {
      toast.error(aiErrorMessage('feature_disabled'));
      return null;
    }

    const url = await signProblemFile(source.file_path);
    if (!url) {
      toast.error('원본 PDF 를 열지 못했어요.');
      return null;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    setBusyId(passageId);
    try {
      const result = await readPassageContinuation({
        file: { kind: 'url', url },
        meta: toOcrMeta(source),
        page,
        soFarHtml,
        port: getCodexPort(),
        pref: getCodexModelPref(),
        signal: controller.signal,
      });
      if (!result.html) {
        // 못 찾은 것도 결과다 — 모델이 남긴 까닭까지 그대로 보여 준다
        toast.info(result.warnings[0] ?? `${page}쪽 머리에 이어지는 글이 안 보여요.`);
        return result;
      }
      toast.success(`${page}쪽에서 이어지는 글을 읽었어요. 확인하고 저장해 주세요.`);
      return result;
    } catch (e) {
      if (isAiError(e)) {
        if (e.code !== 'cancelled') toast.error(aiErrorMessage(e.code));
      } else {
        toast.error(e instanceof Error ? e.message : '읽지 못했어요.');
      }
      return null;
    } finally {
      abortRef.current = null;
      setBusyId(null);
    }
  }, [source]);

  return { busyId, read, cancel };
}
