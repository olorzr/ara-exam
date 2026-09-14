'use client';

import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { aiErrorMessage } from '@/lib/ai/errors';
import { isAiError } from '@/lib/ai/types';
import { signProblemFile } from '@/lib/problem-bank/storage';
import type { PrintRunProgress } from '@/lib/print-scan/run';
import {
  rerunBundle as rerunBundleOnce, runPrintScan,
  type PrintScanRunInput, type PrintScanRunResult,
} from '@/lib/print-scan/run-scan';
import type { PrintBundle, PrintScan } from '@/types/print-scan';
import { ocrStillEnabled } from './useProblemOcr';

/** 단계별 한글 이름 — 진행률 문구가 화면마다 달라지지 않게 한 곳에 둔다 */
const PHASE_LABEL: Record<PrintRunProgress['phase'], string> = {
  upload: '원본 올리는 중',
  page: '원본 페이지 저장 중',
  ocr: '프린트 읽는 중',
  save: '시험지 만드는 중',
};

/**
 * 학교 프린트 읽기 실행 상태.
 *
 * `useProblemOcr` 과 같은 규약이다 — 킬스위치를 **행을 만들기 전에** 다시 확인하고,
 * 취소는 `AbortSignal` 로 끝까지 전달되며, 언마운트 때 진행 중인 생성을 끊는다.
 */
export function usePrintScanOcr() {
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<PrintRunProgress | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // 느슨한 정리는 늦게 실행돼 이미 끝난 생성이 슬쩍 통과할 수 있다(ara-system 선례)
  useLayoutEffect(() => () => abortRef.current?.abort(), []);

  const cancel = useCallback(() => abortRef.current?.abort(), []);

  /** 업로드 화면: 스캔 한 건을 통째로 읽는다 */
  const startScan = useCallback(async (
    input: PrintScanRunInput,
  ): Promise<PrintScanRunResult | null> => {
    if (abortRef.current) return null;

    // ⚠️ 행을 만들기 **전에** 확인한다 — 거부된 뒤에 '대기' 묶음만 남으면
    //    선생님은 읽기가 시작된 줄 알고 기다린다
    if (!(await ocrStillEnabled('print_ocr'))) {
      toast.error(aiErrorMessage('feature_disabled'));
      return null;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    setRunning(true);
    setProgress(null);
    try {
      const result = await runPrintScan(input, {
        signal: controller.signal,
        onProgress: setProgress,
      });
      announce(result);
      return result;
    } catch (e) {
      reportError(e, '읽지 못했어요.');
      return null;
    } finally {
      abortRef.current = null;
      setRunning(false);
    }
  }, []);

  /** 목록 화면: 묶음 하나만 다시 읽는다 (올려 둔 원본 PDF 로) */
  const rerunBundle = useCallback(async (
    bundle: PrintBundle,
    scan: Pick<PrintScan, 'id' | 'file_path'>,
  ): Promise<boolean> => {
    if (abortRef.current) return false;
    if (!scan.file_path) {
      toast.error('원본 파일이 없어 다시 읽을 수 없어요. 새로 올려 주세요.');
      return false;
    }
    if (!(await ocrStillEnabled('print_ocr'))) {
      toast.error(aiErrorMessage('feature_disabled'));
      return false;
    }

    const url = await signProblemFile(scan.file_path);
    if (!url) {
      toast.error('원본 파일을 열지 못했어요. 잠시 뒤에 다시 시도해 주세요.');
      return false;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    setRunning(true);
    setProgress(null);
    try {
      await rerunBundleOnce(bundle, { kind: 'url', url }, scan.id, {
        signal: controller.signal,
        onProgress: setProgress,
      });
      toast.success(`"${bundle.name}" 시험지를 만들었어요.`);
      return true;
    } catch (e) {
      reportError(e, '다시 읽지 못했어요.');
      return false;
    } finally {
      abortRef.current = null;
      setRunning(false);
    }
  }, []);

  const progressLabel = progress
    ? `${bundlePrefix(progress)}${PHASE_LABEL[progress.phase]}… ${progress.done}/${progress.total}`
    : '';

  return { running, progress, progressLabel, startScan, rerunBundle, cancel };
}

/** '(2/3) 문학 프린트 · ' — 여러 장을 이어 읽을 때 어디쯤인지 */
function bundlePrefix(progress: PrintRunProgress): string {
  const at = progress.bundle;
  if (!at) return '';
  return `(${at.index + 1}/${at.total}) ${at.name} · `;
}

/** 결과를 한 줄로 알린다 — 실패·미시작을 뭉뚱그리지 않는다 */
function announce(result: PrintScanRunResult): void {
  if (result.failed === 0 && result.pending === 0) {
    toast.success(`프린트 ${result.ok}장을 읽어 시험지를 만들었어요.`);
    return;
  }
  const parts = [`${result.ok}장 완료`];
  if (result.failed > 0) parts.push(`${result.failed}장 실패`);
  // '대기' 는 실패가 아니다 — 시작도 안 했으니 목록에서 다시 읽으면 된다
  if (result.pending > 0) parts.push(`${result.pending}장은 시작 전`);
  toast.warning(`${parts.join(' · ')} — 목록에서 다시 읽을 수 있어요.`);
}

function reportError(e: unknown, fallback: string): void {
  if (isAiError(e)) {
    // 취소는 사람이 한 일이라 오류로 알리지 않는다
    if (e.code !== 'cancelled') toast.error(aiErrorMessage(e.code));
    return;
  }
  toast.error(e instanceof Error ? e.message : fallback);
}
