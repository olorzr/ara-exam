'use client';

import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { authFetch } from '@/lib/auth-fetch';
import { aiErrorMessage } from '@/lib/ai/errors';
import { isAiError } from '@/lib/ai/types';
import { updateSource } from '@/lib/problem-bank/save';
import { runProblemOcr, type OcrRunInput, type OcrRunProgress } from '@/lib/problem-ocr/run';

/** 단계별 한글 이름 — 진행률 문구가 화면마다 달라지지 않게 한 곳에 둔다 */
const PHASE_LABEL: Record<OcrRunProgress['phase'], string> = {
  page: '원본 페이지 저장 중',
  ocr: '문제 읽는 중',
  'answer-key': '정답표 읽는 중',
  crop: '문항 이미지 자르는 중',
  save: '저장하는 중',
};

/**
 * 서버의 킬스위치를 **시작 직전에** 다시 확인한다.
 *
 * `useAiEnabled` 는 화면이 뜰 때 한 번만 물어본다. 탭을 열어 둔 사이에 기능을 껐다면
 * 그 탭에서는 계속 새 작업이 나가 버린다 — 배포 없이 끄는 스위치가 되지 못한다.
 * 확인 자체가 실패해도 **막는다**(fail-closed) — 코덱스 리뷰 13R.
 * @returns 지금 써도 되면 true
 */
async function ocrStillEnabled(): Promise<boolean> {
  try {
    const res = await authFetch('/api/ai/status');
    if (!res.ok) return false;
    const json = await res.json();
    return json?.enabled === true && json?.features?.problem_ocr === true;
  } catch {
    return false;
  }
}

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

    // ⚠️ 킬스위치 재확인은 **출처 상태를 만지기 전에** 끝낸다.
    //    호출부가 이미 '추출중' 으로 만들어 둔 상태라, 여기서 그냥 던지면
    //    run.ts 의 정리 코드를 못 거쳐 **영영 돌고 있는 것처럼** 남는다(코덱스 리뷰 19R).
    if (!(await ocrStillEnabled())) {
      toast.error(aiErrorMessage('feature_disabled'));
      await updateSource(input.sourceId, {
        status: '업로드',
        ocr_meta: {
          ranAt: new Date().toISOString(),
          warnings: ['AI 읽기가 꺼져 있어 시작하지 못했어요. 관리자에게 문의해 주세요.'],
        },
      }).catch(() => {
        // 상태 정리까지 실패하면 어쩔 수 없다 — 원래 안내를 가리지 않는다
      });
      return false;
    }

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
