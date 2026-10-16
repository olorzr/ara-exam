'use client';

import { useCallback, useMemo, useRef, useState, type RefObject } from 'react';
import { toast } from 'sonner';
import { fetchBundle } from '@/lib/print-scan/queries';
import { BundleConflictError, BundleMissingError, updateBundle } from '@/lib/print-scan/save';
import type { PrintBundle, PrintQaItem, PrintQaMeta } from '@/types/print-scan';

/**
 * 문답 저장의 **버전 규약** (2026-10-15 리뷰 2·7번).
 *
 * ⚠️ 문답은 `qa_items`·`qa_meta` 를 통째로 보낸다. 예전에는 조건이 묶음 id 뿐이라, 같은 문답을
 *    연 두 탭(두 선생님)에서 뒤에 저장한 쪽이 **앞서 저장한 답안 교정을 조용히 옛 값으로 되돌렸다.**
 *    이제 읽어 온 `updated_at` 이 그대로일 때만 고치고, 성공하면 돌려받은 새 버전을 다음 저장에 쓴다.
 * ⚠️ 충돌·없음이면 **화면 값을 그대로 둔다**(내 편집·AI 가 만든 결과를 잃지 않는다). 확인 없이
 *    다시 읽어 덮어쓰지 않는다 — 사람이 '저장된 것 다시 불러오기'(내 것을 버림) 또는 '내 것으로 덮기'
 *    (상대 교정을 버림)를 확인창을 거쳐 고른다.
 */

/** 저장이 멈춘 까닭 — 충돌(행은 있다)과 없음(지워졌다)은 다시 할 일이 다르다 */
export type PrintQaSaveFailure = 'conflict' | 'missing';

/** 확인창 문구 — 무엇을 버리는지 밝힌다 */
const RELOAD_CONFIRM = '저장된 문답을 다시 불러오면 이 화면에서 고친 내용과 만든 답이 사라져요. 계속할까요?';
const OVERWRITE_CONFIRM =
  '다른 곳에서 먼저 저장한 문답을 이 화면의 내용으로 덮어쓸까요? 그쪽에서 고친 답은 사라집니다.';
const MISSING_NOTICE = '이 프린트를 찾지 못했어요. 다른 탭에서 지웠을 수 있어요.';

/**
 * 문답 저장 상태.
 * @param bundle - 화면이 읽어 온 묶음 (처음 버전은 이것의 `updated_at`)
 * @param aiRef - 도는 AI 의 취소 손잡이 (`usePrintQa` 의 abortRef) — 있으면 저장 잠금을 쥘 수 없다
 * @returns 저장 함수·잠금·멈춘 까닭·충돌을 푸는 두 길
 */
export function usePrintQaPersist(bundle: PrintBundle, aiRef: RefObject<AbortController | null>) {
  /** 마지막으로 서버와 맞춘 버전 — 저장할 때마다 새 값으로 바뀐다(ref: 같은 흐름의 연속 저장이 옛 값을 닫지 않게) */
  const versionRef = useRef<string | null>(bundle.updated_at || null);
  const [failure, setFailure] = useState<PrintQaSaveFailure | null>(null);
  const [saving, setSaving] = useState(false);
  /**
   * 저장이 도는 중인가.
   *
   * ⚠️ **state 가 아니라 ref 다.** 같은 실행 흐름에서 두 번 부르면 state 는 아직 안 바뀌어 있어
   *    두 번째가 통과한다(`usePrintSheetList` 의 `busyRef` 와 같은 판단).
   * ⚠️ 저장과 AI 는 **한 잠금**이다(코덱스 리뷰). 따로 두면 모범답안이 도는 동안 누른 저장이
   *    **옛 문항을 나중에 덮어써**, 화면에는 새 답이 보이는데 DB 에는 옛 답이 남고
   *    `dirty` 는 false 라 아무도 눈치채지 못한다. AI 쪽은 이 ref 를 보고 시작하지 않는다.
   */
  const savingRef = useRef(false);
  /** 저장·다시 불러오기·덮어쓰기가 나눠 쥐는 잠금 — AI 가 돌거나 저장 중이면 쥘 수 없다 */
  const lock = useMemo(() => ({
    take: (): boolean => {
      if (savingRef.current || aiRef.current) return false;
      savingRef.current = true;
      setSaving(true);
      return true;
    },
    release: (): void => {
      savingRef.current = false;
      setSaving(false);
    },
  }), [aiRef]);

  /**
   * 문답과 영수증을 **함께** 저장한다 — 둘이 갈라지면 해시가 거짓말을 한다.
   * @returns 저장했으면 true. 아니면 까닭을 알리고 false (던지지 않는다)
   */
  const persist = useCallback(async (items: PrintQaItem[], meta: PrintQaMeta): Promise<boolean> => {
    try {
      const saved = await updateBundle(
        bundle.id,
        { qa_items: items, qa_meta: meta },
        { expectUpdatedAt: versionRef.current },
      );
      versionRef.current = saved.updated_at;
      setFailure(null);
      return true;
    } catch (e) {
      if (e instanceof BundleConflictError) setFailure('conflict');
      else if (e instanceof BundleMissingError) setFailure('missing');
      toast.error(e instanceof Error ? e.message : '저장하지 못했어요.');
      return false;
    }
  }, [bundle.id]);

  /**
   * 손으로 고친 것을 잠금을 쥐고 저장한다.
   * @returns 저장했으면 true (잠금을 못 쥐었거나 멈췄으면 false)
   */
  const saveNow = useCallback(async (items: PrintQaItem[], meta: PrintQaMeta): Promise<boolean> => {
    if (!lock.take()) return false;
    try {
      const saved = await persist(items, meta);
      if (saved) toast.success('저장했어요.');
      return saved;
    } finally {
      lock.release();
    }
  }, [lock, persist]);

  /**
   * 서버의 지금 묶음을 읽고 그 버전을 받아들인다.
   * @returns 묶음. 없으면 null(지워졌다 — 까닭을 '없음' 으로 둔다)
   * @throws 조회 실패 시
   */
  const adoptLatest = useCallback(async (): Promise<PrintBundle | null> => {
    const found = await fetchBundle(bundle.id);
    if (!found) {
      setFailure('missing');
      return null;
    }
    versionRef.current = found.bundle.updated_at || null;
    setFailure(null);
    return found.bundle;
  }, [bundle.id]);

  /**
   * 서버에 저장된 문답으로 되돌린다 — **이 화면에서 고친 것을 버린다**(확인창).
   * @param apply - 읽어 온 묶음을 화면에 넣는다
   */
  const reloadSaved = useCallback(async (apply: (row: PrintBundle) => void) => {
    // 잠금을 먼저 쥔다 — 못 쥘 때(AI·저장 중) 확인창만 띄우고 아무 일도 안 하면 안 된다
    if (!lock.take()) return;
    try {
      if (!window.confirm(RELOAD_CONFIRM)) return;
      const latest = await adoptLatest();
      if (!latest) { toast.error(MISSING_NOTICE); return; }
      apply(latest);
      toast.success('저장된 문답을 다시 불러왔어요.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '불러오지 못했어요.');
    } finally {
      lock.release();
    }
  }, [adoptLatest, lock]);

  /**
   * 먼저 저장된 것을 **이 화면의 내용으로 덮는다**(확인창) — 서버의 지금 버전을 받아 그 위에 쓴다.
   * 그 사이 또 누가 저장하면 다시 충돌로 멈춘다.
   * @param items - 이 화면의 문항
   * @param meta - 이 화면의 영수증
   * @param adoptSource - 받아 온 서버 행(원문 포함)을 화면에 알린다 — 원문 어긋남 경고가 지금 원문을 보게
   * @returns 저장했으면 true
   */
  const overwrite = useCallback(async (
    items: PrintQaItem[],
    meta: PrintQaMeta,
    adoptSource: (row: PrintBundle) => void,
  ): Promise<boolean> => {
    if (!lock.take()) return false;
    try {
      if (!window.confirm(OVERWRITE_CONFIRM)) return false;
      const latest = await adoptLatest();
      if (!latest) { toast.error(MISSING_NOTICE); return false; }
      adoptSource(latest);
      const saved = await persist(items, meta);
      if (saved) toast.success('이 화면의 내용으로 저장했어요.');
      return saved;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '저장하지 못했어요.');
      return false;
    } finally {
      lock.release();
    }
  }, [adoptLatest, lock, persist]);

  return { saving, savingRef, failure, persist, saveNow, reloadSaved, overwrite };
}
