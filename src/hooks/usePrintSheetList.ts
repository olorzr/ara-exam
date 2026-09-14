'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { fetchScansWithBundles } from '@/lib/print-scan/queries';
import {
  createSheetForBundle, deleteBundle as deleteBundleRow, deleteScan as deleteScanRow,
} from '@/lib/print-scan/save';
import { bundleDeleteConfirmMessage, scanDeleteConfirmMessage } from '@/lib/print-scan/scan-delete';
import type { PrintBundleRow, PrintScanRow } from '@/types/print-scan';

/**
 * 학교 프린트 목록 화면의 상태.
 *
 * 목록은 스캔 몇 건뿐이라 페이지네이션을 두지 않는다(상한 100). 지우고 나면
 * **통째로 다시 읽는다** — 지역에서 행만 빼면 안에 딸린 시험지 수 같은 파생값이 어긋난다.
 */
export function usePrintSheetList() {
  const [scans, setScans] = useState<PrintScanRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const aliveRef = useRef(true);
  /**
   * 지우기·만들기가 겹치지 않게 하는 잠금.
   *
   * ⚠️ state 가 아니라 ref 다 — 같은 실행 흐름에서 두 번 부르면 state 는 아직 안 바뀌어
   *    있어 두 번째가 통과한다(화면의 disabled 는 렌더 뒤에나 걸린다).
   */
  const busyRef = useRef(false);

  const load = useCallback(async () => {
    try {
      const rows = await fetchScansWithBundles();
      if (aliveRef.current) setScans(rows);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '목록을 불러오지 못했어요.');
    } finally {
      if (aliveRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    // ⚠️ 효과 본문에서 true 로 **되돌린다** — StrictMode 는 마운트 → 언마운트 → 재마운트라,
    //    안 되돌리면 재마운트 뒤 이 화면의 기능이 조용히 통째로 죽는다
    aliveRef.current = true;
    load();
    return () => { aliveRef.current = false; };
  }, [load]);

  /** 잠금·busy 표시·다시 읽기를 한 벌로 묶는다 */
  const withBusy = useCallback(async (id: string, job: () => Promise<void>) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusyId(id);
    try {
      await job();
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '처리하지 못했어요.');
    } finally {
      busyRef.current = false;
      if (aliveRef.current) setBusyId(null);
    }
  }, [load]);

  const deleteScan = useCallback(async (scan: PrintScanRow) => {
    const message = scanDeleteConfirmMessage({
      title: scan.title,
      bundleCount: scan.bundles.length,
      sheetCount: scan.bundles.filter((b) => b.sheetId).length,
      running: scan.bundles.some((b) => b.status === '읽는중'),
    });
    if (!window.confirm(message)) return;
    await withBusy(scan.id, async () => {
      await deleteScanRow(scan);
      toast.success('스캔을 지웠어요.');
    });
  }, [withBusy]);

  const deleteBundle = useCallback(async (bundle: PrintBundleRow) => {
    const message = bundleDeleteConfirmMessage({
      name: bundle.name,
      hasSheet: Boolean(bundle.sheetId),
      running: bundle.status === '읽는중',
    });
    if (!window.confirm(message)) return;
    await withBusy(bundle.id, async () => {
      await deleteBundleRow(bundle.id);
      toast.success('프린트를 지웠어요.');
    });
  }, [withBusy]);

  /**
   * 이미 읽어 둔 원문으로 시험지만 다시 만든다 — **ChatGPT 를 쓰지 않는다.**
   * 시험지를 지웠다가 되살리고 싶을 때의 길이다.
   */
  const createSheet = useCallback(async (bundle: PrintBundleRow) => {
    if (!bundle.ocr_html) {
      toast.error('읽어 둔 내용이 없어요. 먼저 읽기를 해 주세요.');
      return;
    }
    await withBusy(bundle.id, async () => {
      await createSheetForBundle(bundle, bundle.ocr_html);
      toast.success('시험지를 만들었어요.');
    });
  }, [withBusy]);

  return { scans, loading, busyId, reload: load, deleteScan, deleteBundle, createSheet };
}
