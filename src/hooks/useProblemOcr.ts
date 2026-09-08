'use client';

import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { aiErrorMessage } from '@/lib/ai/errors';
import { isAiError } from '@/lib/ai/types';
import { runProblemOcr, type OcrRunInput, type OcrRunProgress } from '@/lib/problem-ocr/run';

/** 단계별 한글 이름 — 진행률 문구가 화면마다 달라지지 않게 한 곳에 둔다 */
const PHASE_LABEL: Record<OcrRunProgress['phase'], string> = {
  ocr: '문제 읽는 중',
  'answer-key': '정답표 읽는 중',
  crop: '문항 이미지 자르는 중',
  save: '저장하는 중',
};

/**
 * OCR 실행 상태를 들고 있는 훅.
 *
 * 취소는 `AbortSignal` 로 끝까지 전달된다 — 진행 중인 turn 은 `turn/interrupt` 로 끊고,
 * 이미 읽은 묶음은 버리지 않는다.
 */
export function useProblemOcr() {
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<OcrRunProgress | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  // 화면이 사라지면 진행 중인 생성을 끊는다.
  // useEffect 가 아니라 useLayoutEffect 인 이유: 느슨한 정리는 늦게 실행돼
  // 이미 끝난 생성이 슬쩍 통과할 수 있다(ara-system 선례).
  useLayoutEffect(() => () => abortRef.current?.abort(), []);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const start = useCallback(async (input: OcrRunInput): Promise<boolean> => {
    if (abortRef.current) return false;

    const controller = new AbortController();
    abortRef.current = controller;
    setRunning(true);
    setProgress(null);
    setWarnings([]);

    try {
      const result = await runProblemOcr(input, {
        signal: controller.signal,
        onProgress: setProgress,
      });
      setWarnings(result.merged.warnings);
      toast.success(
        `문항 ${result.merged.problems.length}개, 지문 ${result.merged.passages.length}개를 읽었어요.`,
      );
      return true;
    } catch (e) {
      if (isAiError(e)) {
        // 취소는 사람이 한 일이라 오류로 알리지 않는다
        if (e.code !== 'cancelled') toast.error(aiErrorMessage(e.code));
      } else {
        toast.error(e instanceof Error ? e.message : '읽지 못했어요.');
      }
      return false;
    } finally {
      abortRef.current = null;
      setRunning(false);
    }
  }, []);

  const progressLabel = progress
    ? `${PHASE_LABEL[progress.phase]}… ${progress.done}/${progress.total}`
    : '';

  return { running, progress, progressLabel, warnings, start, cancel };
}
