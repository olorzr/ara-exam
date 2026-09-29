'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth-context';
import type { OwnerScope } from '@/lib/owner-scope';
import { fetchScansWithBundles } from '@/lib/print-scan/queries';
import {
  createSheetForBundle, deleteBundle as deleteBundleRow, deleteScan as deleteScanRow,
  ensureSchoolMaterial,
} from '@/lib/print-scan/save';
import { bundleDeleteConfirmMessage, scanDeleteConfirmMessage } from '@/lib/print-scan/scan-delete';
import { isTypedBundle } from '@/lib/print-scan/typed';
import { registeredWordCount } from '@/lib/print-words';
import type { PrintBundleRow, PrintScanRow } from '@/types/print-scan';

/** 읽어 둔 목록 — 어느 탭의 것인지와 함께 든다 */
interface LoadedScans {
  key: string;
  scans: PrintScanRow[];
}

/**
 * 학교 프린트 목록 화면의 상태.
 *
 * 목록은 스캔 몇 건뿐이라 페이지네이션을 두지 않는다(탭마다 상한 100). 지우고 나면
 * **통째로 다시 읽는다** — 지역에서 행만 빼면 안에 딸린 시험지 수 같은 파생값이 어긋난다.
 *
 * 탭(내 것 / 다른 선생님 것)을 바꾸면 그 탭을 새로 읽는다. 로딩은 **"어느 탭의 목록을 읽어
 * 두었는가" 에서 파생**한다 — 탭을 바꾼 직후 옛 탭의 줄이 새 탭 이름 아래 보이면 안 된다.
 * @param scope - 내 것 / 다른 선생님 것
 */
export function usePrintSheetList(scope: OwnerScope) {
  const { user } = useAuth();
  const userId = user?.id ?? '';
  const key = `${scope}:${userId}`;
  const [loaded, setLoaded] = useState<LoadedScans | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  /** 목록 요청 세대 — 탭을 오가며 늦게 온 옛 탭의 응답이 새 목록을 덮지 않게 */
  const reqSeq = useRef(0);
  /**
   * 지금 보고 있는 탭.
   *
   * ⚠️ `load` 는 이 ref 를 읽는다 — 탭을 닫아 두지 않는다(코덱스 1R). 지우기·시험지 만들기·
   *    다시 읽기는 끝나고 나서 목록을 다시 읽는데, 그 사이 탭을 바꿨으면 닫아 둔 **옛 탭**을
   *    읽게 된다. 그 요청이 세대를 올려 새 탭의 응답을 버리게 하고 자기는 옛 탭 결과를 남겨,
   *    **지금 탭이 영영 '읽는 중'** 으로 멈췄다. 늘 지금 탭을 읽으면 가장 늦은 요청이 맞는 답이다.
   */
  const currentRef = useRef({ scope, userId, key });
  const aliveRef = useRef(true);
  /**
   * 지우기·만들기가 겹치지 않게 하는 잠금.
   *
   * ⚠️ state 가 아니라 ref 다 — 같은 실행 흐름에서 두 번 부르면 state 는 아직 안 바뀌어
   *    있어 두 번째가 통과한다(화면의 disabled 는 렌더 뒤에나 걸린다).
   */
  const busyRef = useRef(false);

  const load = useCallback(async () => {
    const { scope: wantedScope, userId: wantedUser, key: wantedKey } = currentRef.current;
    if (!wantedUser) return;
    const seq = ++reqSeq.current;
    try {
      const rows = await fetchScansWithBundles(wantedScope, wantedUser);
      if (aliveRef.current && seq === reqSeq.current) setLoaded({ key: wantedKey, scans: rows });
    } catch (e) {
      if (!aliveRef.current || seq !== reqSeq.current) return;
      toast.error(e instanceof Error ? e.message : '목록을 불러오지 못했어요.');
      // 같은 탭을 다시 읽다 실패했으면 보던 목록을 둔다. 처음 읽기였으면 빈 목록으로 끝낸다
      setLoaded((prev) => (prev?.key === wantedKey ? prev : { key: wantedKey, scans: [] }));
    }
  }, []);

  useEffect(() => {
    // 탭을 먼저 적어 두고 읽는다 — 끝나고 다시 읽는 작업들도 이 값을 본다
    currentRef.current = { scope, userId, key };
    // ⚠️ 효과 본문에서 true 로 **되돌린다** — StrictMode 는 마운트 → 언마운트 → 재마운트라,
    //    안 되돌리면 재마운트 뒤 이 화면의 기능이 조용히 통째로 죽는다
    aliveRef.current = true;
    load();
    return () => { aliveRef.current = false; };
  }, [key, scope, userId, load]);

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
      // 칩과 **같은 함수**로 센다 — 다시 등록하면 registered 가 0 이라 따로 세면 안내가 사라진다
      wordCount: scan.bundles.reduce((sum, b) => sum + registeredWordCount(b.words_meta), 0),
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
      wordCount: registeredWordCount(bundle.words_meta),
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
    // 직접 입력한 프린트는 읽어 둔 원문이 원래 없다 — 빈 시험지를 만든다(만들다 실패한 것을 되살리는 길)
    if (!bundle.ocr_html && !isTypedBundle(bundle)) {
      toast.error('읽어 둔 내용이 없어요. 먼저 읽기를 해 주세요.');
      return;
    }
    await withBusy(bundle.id, async () => {
      await createSheetForBundle(bundle, bundle.ocr_html);
      // 읽기 경로(`runBundle`)와 **같이** 카테고리 트리에도 올린다 — 예전엔 이 길로 만든
      // 시험지만 트리에서 빠져 있었다(편집기 카테고리 바에서 고른 자리가 비어 보인다)
      await ensureSchoolMaterial(bundle, (warning) => toast.warning(warning));
      // 단어는 여기서 건드리지 않는다 — 이 길은 **ChatGPT 를 안 쓰는** 길이고,
      // 단어 등록은 목록의 '단어 등록' 버튼이 맡는다(누를 때마다 한 번 쓴다)
      toast.success('시험지를 만들었어요.');
    });
  }, [withBusy]);

  const current = loaded?.key === key ? loaded : null;
  return {
    scans: current?.scans ?? [],
    loading: current === null,
    busyId,
    reload: load,
    deleteScan,
    deleteBundle,
    createSheet,
  };
}
