'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth-context';
import type { OwnerScope } from '@/lib/owner-scope';
import { deletePaper, fetchPapers } from '@/lib/problem-paper/paper-list';
import type { ProblemPaper } from '@/types/problem-bank';

/** 읽어 둔 목록 — 어느 탭의 것인지와 함께 든다 */
interface LoadedPapers {
  key: string;
  papers: ProblemPaper[];
}

/**
 * 만든 문제지 목록 — 탭(내 것 / 다른 선생님 것)마다 따로 읽는다.
 *
 * 로딩은 **"어느 탭의 목록을 읽어 두었는가" 에서 파생**한다 — 탭을 바꾼 직후 옛 탭의
 * 목록이 새 탭 이름 아래 보이면 안 되고, 효과에서 동기로 비우면 lint 가 막는다.
 * @param scope - 내 것 / 다른 선생님 것
 * @returns 목록·로딩·삭제
 */
export function usePaperList(scope: OwnerScope) {
  const { user } = useAuth();
  const userId = user?.id ?? '';
  const key = `${scope}:${userId}`;
  const [loaded, setLoaded] = useState<LoadedPapers | null>(null);

  useEffect(() => {
    if (!userId) return;
    let alive = true;
    fetchPapers(scope, userId)
      .then((papers) => { if (alive) setLoaded({ key, papers }); })
      .catch((e) => {
        if (!alive) return;
        toast.error(e instanceof Error ? e.message : '문제지를 불러오지 못했어요.');
        setLoaded({ key, papers: [] });
      });
    return () => { alive = false; };
  }, [key, scope, userId]);

  const remove = useCallback(async (paper: ProblemPaper) => {
    if (!window.confirm(`'${paper.title}' 문제지를 지울까요? 담긴 문항은 아카이브에 그대로 남아요.`)) return;
    try {
      await deletePaper(paper.id);
      setLoaded((prev) => (prev
        ? { ...prev, papers: prev.papers.filter((p) => p.id !== paper.id) }
        : prev));
      toast.success('문제지를 지웠어요.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '지우지 못했어요.');
    }
  }, []);

  const current = loaded?.key === key ? loaded : null;
  return { papers: current?.papers ?? [], loading: current === null, userId, remove };
}
