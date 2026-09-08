'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  fetchPassages, fetchProblemsOfSource, fetchSource,
} from '@/lib/problem-bank/queries';
import {
  clearSourceUnits, ConflictError, countTaggedUnits, deletePassage, deleteProblem,
  setProblemVerified, setSourceTextbook, updatePassage, updateProblem,
  type PassagePatch, type ProblemPatch,
} from '@/lib/problem-bank/mutations';
import { signProblemFiles } from '@/lib/problem-bank/storage';
import { sourcePagePath } from '@/lib/problem-bank/storage-paths';
import type { Passage, Problem, ProblemSource } from '@/types/problem-bank';

/**
 * 검수 화면의 상태.
 *
 * 저장은 **낙관적 동시성**이다(개념지와 같은 규약) — 화면이 읽어 온 `updated_at` 을
 * 조건으로 걸고, 0행이면 충돌로 알린다. 공유 표라 두 사람이 같은 문항을 열 수 있다.
 */
export function useProblemReview(sourceId: string) {
  const [source, setSource] = useState<ProblemSource | null>(null);
  const [passages, setPassages] = useState<Passage[]>([]);
  const [problems, setProblems] = useState<Problem[]>([]);
  const [pageUrls, setPageUrls] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  /**
   * 서버에서 본문을 통째로 다시 읽어 온 횟수.
   *
   * ⚠️ 편집 카드는 폼 값을 **지역 state** 로 들고 있다. 서버 본문을 새로 받아 놓고
   *    카드를 그대로 두면, 화면에는 옛 입력이 남은 채 새 버전 토큰만 붙는다 —
   *    그 상태로 저장하면 **남의 수정을 조용히 덮어쓴다**(코덱스 리뷰 4R).
   *    호출부가 이 값을 카드 key 에 섞어 다시 마운트하게 한다.
   */
  const [reloadSeq, setReloadSeq] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [src, ps, qs] = await Promise.all([
        fetchSource(sourceId),
        fetchPassages(sourceId),
        fetchProblemsOfSource(sourceId),
      ]);
      setSource(src);
      setPassages(ps);
      setProblems(qs);

      // 원본 대조용 페이지 이미지 — 쓰인 쪽만 한 번에 서명한다
      const pages = [...new Set([...ps.map((p) => p.page_no), ...qs.map((q) => q.page_no)])]
        .filter((n) => n >= 1);
      // 원본 대조용 페이지 이미지 — OCR 이 읽은 쪽(정답표·이어지는 쪽 포함)을 모두 서명한다.
      // 항목이 있는 쪽만 서명하면 정답표 쪽이 빠져 정답을 대조할 수 없다
      const ocrPages = (src?.ocr_meta?.pages ?? []).filter((n) => Number.isInteger(n) && n >= 1);
      const allPages = [...new Set([...pages, ...ocrPages])].sort((a, b) => a - b);
      setPageUrls(await signProblemFiles(allPages.map((n) => sourcePagePath(sourceId, n))));
    } catch (e) {
      setError(e instanceof Error ? e.message : '불러오지 못했어요.');
    } finally {
      setLoading(false);
    }
  }, [sourceId]);

  useEffect(() => {
    load();
  }, [load]);

  /** 저장 실패를 한 곳에서 사람 말로 바꾼다 */
  const reportError = (e: unknown) => {
    if (e instanceof ConflictError) toast.error(e.message);
    else toast.error(e instanceof Error ? e.message : '저장하지 못했어요.');
  };

  /**
   * 문항을 저장한다.
   * @returns 새 `updated_at`. 실패하면 null
   *
   * 불리언이 아니라 새 버전을 돌려주는 이유: 저장 직후 검수 완료까지 이어서 누르면
   * 화면 state 가 아직 안 돌아 **옛 버전으로 검수를 시도해 충돌**한다(코덱스 리뷰 9R).
   * 호출부가 받은 값을 그대로 넘길 수 있어야 한다.
   */
  const saveProblem = useCallback(async (
    id: string,
    patch: ProblemPatch,
  ): Promise<string | null> => {
    const target = problems.find((p) => p.id === id);
    if (!target) return null;
    try {
      const updatedAt = await updateProblem(id, target.updated_at, patch);
      setProblems((list) => list.map((p) => (
        p.id === id ? { ...p, ...patch, updated_at: updatedAt } as Problem : p
      )));
      return updatedAt;
    } catch (e) {
      reportError(e);
      return null;
    }
  }, [problems]);

  const savePassage = useCallback(async (id: string, patch: PassagePatch): Promise<boolean> => {
    const target = passages.find((p) => p.id === id);
    if (!target) return false;
    try {
      const updatedAt = await updatePassage(id, target.updated_at, patch);
      setPassages((list) => list.map((p) => (
        p.id === id ? { ...p, ...patch, updated_at: updatedAt } as Passage : p
      )));
      return true;
    } catch (e) {
      reportError(e);
      return false;
    }
  }, [passages]);

  /**
   * 검수 완료 표시를 켜고 끈다.
   * @param knownUpdatedAt - 방금 저장해서 이미 알고 있는 버전(있으면 이걸 쓴다).
   *   화면 state 가 아직 안 돈 시점에도 맞는 버전으로 걸 수 있다
   */
  const toggleVerified = useCallback(async (
    id: string,
    verified: boolean,
    knownUpdatedAt?: string,
  ) => {
    const target = problems.find((p) => p.id === id);
    if (!target) return;
    try {
      // 읽어 온 버전을 걸고, 새 버전을 받아 화면도 갱신한다.
      // 조건이 없으면 남이 고친 문항의 새 버전을 물려받은 채 옛 본문을 들고 있게 되고,
      // 다음 저장이 검사를 통과하며 남의 수정을 덮어쓴다
      const updatedAt = await setProblemVerified(
        id, knownUpdatedAt ?? target.updated_at, verified,
      );
      setProblems((list) => list.map((p) => (
        p.id === id
          ? { ...p, status: verified ? '검수완료' : '초안', updated_at: updatedAt }
          : p
      )));
    } catch (e) {
      reportError(e);
    }
  }, [problems]);

  const removeProblem = useCallback(async (id: string) => {
    try {
      await deleteProblem(id);
      setProblems((list) => list.filter((p) => p.id !== id));
      toast.success('문항을 지웠어요.');
    } catch (e) {
      reportError(e);
    }
  }, []);

  const removePassage = useCallback(async (id: string) => {
    try {
      await deletePassage(id);
      setPassages((list) => list.filter((p) => p.id !== id));

      // 딸린 문항은 남지만(FK ON DELETE SET NULL) 그 UPDATE 가 updated_at 트리거를
      // 건드린다. 화면에서 passage_id 만 지우면 문항들이 **옛 버전 토큰**을 들고 있어
      // 이후 저장·검수가 아무도 안 고쳤는데 충돌로 튕긴다(코덱스 리뷰 3R).
      // 영향받은 문항을 다시 읽어 본문과 토큰을 같이 맞춘다.
      const affected = problems.some((p) => p.passage_id === id);
      if (affected) {
        setProblems(await fetchProblemsOfSource(sourceId));
        // 편집 카드도 다시 마운트시킨다 — 새 본문 위에 옛 입력이 남으면
        // 그대로 저장할 때 남의 수정을 덮어쓴다
        setReloadSeq((n) => n + 1);
      }

      toast.success('지문을 지웠어요. 문항은 남아 있어요.');
    } catch (e) {
      reportError(e);
    }
  }, [problems, sourceId]);

  /**
   * 교과서를 바꾼다 — 단원 트리가 여기에 달려 있어 검수 중에도 고칠 수 있어야 한다.
   *
   * ⚠️ 이미 붙은 단원은 **다른 책의 단원**이 되므로 물어보고 지운다. 남겨 두면
   *    아카이브가 '새 교과서 + 옛 단원' 으로 묶여 아무도 못 찾는다(코덱스 리뷰 2R).
   * @param textbook - 교과서 이름 ('' 는 미지정)
   */
  const changeTextbook = useCallback(async (textbook: string) => {
    try {
      const tagged = await countTaggedUnits(sourceId);
      if (tagged > 0) {
        const ok = window.confirm(
          `이 출처에 단원이 붙은 문항·지문이 ${tagged}개 있어요.\n`
          + '교과서를 바꾸면 그 단원은 다른 책의 것이 되므로 함께 지웁니다. 계속할까요?',
        );
        if (!ok) return;
        await clearSourceUnits(sourceId);
      }
      const saved = await setSourceTextbook(sourceId, textbook);
      setSource((prev) => (prev ? { ...prev, textbook: saved } : prev));
      // 단원을 지웠으면 본문을 다시 읽고 카드도 다시 마운트한다 —
      // 화면에 남은 옛 단원 값을 그대로 저장하면 지운 태그가 되살아난다
      if (tagged > 0) {
        await load();
        setReloadSeq((n) => n + 1);
      }
      toast.success(saved ? `교과서를 '${saved}' 로 바꿨어요.` : '교과서를 지웠어요.');
    } catch (e) {
      reportError(e);
    }
  }, [sourceId, load]);

  const verifiedCount = useMemo(
    () => problems.filter((p) => p.status === '검수완료').length,
    [problems],
  );

  const pageUrlFor = useCallback(
    (page: number) => pageUrls.get(sourcePagePath(sourceId, page)) ?? null,
    [pageUrls, sourceId],
  );

  return {
    source, passages, problems, loading, error, verifiedCount, reloadSeq,
    reload: load, saveProblem, savePassage, toggleVerified, changeTextbook,
    removeProblem, removePassage, pageUrlFor,
  };
}
