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
import { PRINT_MAX_MERGED_WARNINGS } from '@/lib/print-scan/constants';
import type { PrintBundle, PrintScan } from '@/types/print-scan';
import { ocrStillEnabled } from './useProblemOcr';

/** 단계별 한글 이름 — 진행률 문구가 화면마다 달라지지 않게 한 곳에 둔다 */
const PHASE_LABEL: Record<PrintRunProgress['phase'], string> = {
  upload: '원본 올리는 중',
  page: '원본 페이지 저장 중',
  ocr: '프린트 읽는 중',
  save: '시험지 만드는 중',
  words: '단어 등록 중',
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
  // 읽는 동안 쌓이는 경고 — 진행률 칸이 그대로 보여 준다(`ocr_meta` 에만 넣으면 아무도 안 본다)
  const [warnings, setWarnings] = useState<string[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  // 느슨한 정리는 늦게 실행돼 이미 끝난 생성이 슬쩍 통과할 수 있다(ara-system 선례)
  useLayoutEffect(() => () => abortRef.current?.abort(), []);

  const cancel = useCallback(() => abortRef.current?.abort(), []);

  /**
   * 경고를 모으는 그릇 하나. 여러 묶음을 이어 읽으므로 **어느 프린트 얘기인지**를 붙이고,
   * `ocr_meta` 와 같은 상한을 걸어 화면이 끝없이 길어지지 않게 한다.
   */
  const collector = useCallback(() => {
    const collected: string[] = [];
    setWarnings([]);
    return {
      collected,
      onWarnings: (list: string[], bundleName: string) => {
        for (const w of list) collected.push(bundleName ? `${bundleName} · ${w}` : w);
        setWarnings(collected.slice(0, PRINT_MAX_MERGED_WARNINGS));
      },
    };
  }, []);

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
    const warn = collector();
    try {
      const result = await runPrintScan(input, {
        signal: controller.signal,
        onProgress: setProgress,
        onWarnings: warn.onWarnings,
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
  }, [collector]);

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
    const warn = collector();
    try {
      const result = await rerunBundleOnce(bundle, { kind: 'url', url }, scan.id, {
        signal: controller.signal,
        onProgress: setProgress,
        onWarnings: warn.onWarnings,
      });
      const words = result.wordsRegistered > 0 ? ` · 단어 ${result.wordsRegistered}개 등록` : '';
      // 다 읽은 것과 '읽히긴 했는데 모자란 것' 을 같은 말로 알리지 않는다
      if (warn.collected.length > 0) {
        toast.warning(`"${bundle.name}" 시험지를 만들었어요${words} — 확인이 필요한 곳이 ${warn.collected.length}군데 있어요.`);
      } else {
        toast.success(`"${bundle.name}" 시험지를 만들었어요${words}.`);
      }
      return true;
    } catch (e) {
      reportError(e, '다시 읽지 못했어요.');
      return false;
    } finally {
      abortRef.current = null;
      setRunning(false);
    }
  }, [collector]);

  const progressLabel = progress
    ? `${bundlePrefix(progress)}${PHASE_LABEL[progress.phase]}… ${progress.done}/${progress.total}`
    : '';

  return { running, progress, progressLabel, warnings, startScan, rerunBundle, cancel };
}

/** '(2/3) 문학 프린트 · ' — 여러 장을 이어 읽을 때 어디쯤인지 */
function bundlePrefix(progress: PrintRunProgress): string {
  const at = progress.bundle;
  if (!at) return '';
  return `(${at.index + 1}/${at.total}) ${at.name} · `;
}

/** 결과를 한 줄로 알린다 — 실패·미시작·'모자란 완료' 를 뭉뚱그리지 않는다 */
function announce(result: PrintScanRunResult): void {
  const words = result.words > 0 ? ` 단어 ${result.words}개도 등록했어요.` : '';
  if (result.failed === 0 && result.pending === 0 && result.warned === 0) {
    toast.success(`프린트 ${result.ok}장을 읽어 시험지를 만들었어요.${words}`);
    return;
  }
  const parts = [`${result.ok}장 완료`];
  if (result.failed > 0) parts.push(`${result.failed}장 실패`);
  // '대기' 는 실패가 아니다 — 시작도 안 했으니 목록에서 다시 읽으면 된다
  if (result.pending > 0) parts.push(`${result.pending}장은 시작 전`);
  // 만들어지긴 했으나 빠진 데가 있는 것 — 성공으로 뭉뚱그리면 그대로 인쇄된다
  if (result.warned > 0) parts.push(`${result.warned}장은 확인 필요`);
  if (result.words > 0) parts.push(`단어 ${result.words}개 등록`);
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
