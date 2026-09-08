'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  fetchPassages, fetchProblemsOfSource, fetchSource,
} from '@/lib/problem-bank/queries';
import {
  ConflictError, deletePassage, deleteProblem, setProblemVerified,
  updatePassage, updateProblem, type PassagePatch, type ProblemPatch,
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
      setPageUrls(await signProblemFiles(pages.map((n) => sourcePagePath(sourceId, n))));
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

  const saveProblem = useCallback(async (id: string, patch: ProblemPatch): Promise<boolean> => {
    const target = problems.find((p) => p.id === id);
    if (!target) return false;
    try {
      const updatedAt = await updateProblem(id, target.updated_at, patch);
      setProblems((list) => list.map((p) => (
        p.id === id ? { ...p, ...patch, updated_at: updatedAt } as Problem : p
      )));
      return true;
    } catch (e) {
      reportError(e);
      return false;
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

  const toggleVerified = useCallback(async (id: string, verified: boolean) => {
    try {
      // updated_at 을 같이 갱신한다 — 이 UPDATE 도 트리거를 건드리므로,
      // 옛 값을 들고 있으면 다음 본문 저장이 남 탓 없이 충돌로 튕긴다
      const updatedAt = await setProblemVerified(id, verified);
      setProblems((list) => list.map((p) => (
        p.id === id
          ? { ...p, status: verified ? '검수완료' : '초안', updated_at: updatedAt }
          : p
      )));
    } catch (e) {
      reportError(e);
    }
  }, []);

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
      // 딸린 문항은 남는다(FK ON DELETE SET NULL) — 화면도 그렇게 맞춘다
      setProblems((list) => list.map((p) => (
        p.passage_id === id ? { ...p, passage_id: null } : p
      )));
      toast.success('지문을 지웠어요. 문항은 남아 있어요.');
    } catch (e) {
      reportError(e);
    }
  }, []);

  const verifiedCount = useMemo(
    () => problems.filter((p) => p.status === '검수완료').length,
    [problems],
  );

  const pageUrlFor = useCallback(
    (page: number) => pageUrls.get(sourcePagePath(sourceId, page)) ?? null,
    [pageUrls, sourceId],
  );

  return {
    source, passages, problems, loading, error, verifiedCount,
    reload: load, saveProblem, savePassage, toggleVerified,
    removeProblem, removePassage, pageUrlFor,
  };
}
