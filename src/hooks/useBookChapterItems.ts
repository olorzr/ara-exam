'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { fetchChapterItems } from '@/lib/book';
import type { PaperItemSnapshot } from '@/types/problem-bank';

const EMPTY = new Map<string, PaperItemSnapshot[]>();

/**
 * 책의 장(문제지)마다 항목 스냅샷을 읽는다 — 내지를 그릴 때만 부른다.
 *
 * 결과는 **어느 문제지 묶음의 것인지**와 함께 든다(`key`). 장을 바꾼 뒤 옛 묶음의 항목을 새 장 차례에 내주면
 * 다른 문제지의 문항이 그 장에 찍힌다. 하나라도 못 읽으면 실패다 — 장 하나가 빈 채로 인쇄되면 안 된다.
 * @param paperIds - 장 차례대로의 문제지 id
 * @param enabled - 읽어도 되는가
 * @returns 문제지 id → 항목, 상태, 다시 읽기
 */
export function useBookChapterItems(paperIds: readonly string[], enabled: boolean) {
  const key = paperIds.join('|');
  const [attempt, setAttempt] = useState(0);
  const loadKey = `${key}#${attempt}`;
  const [loaded, setLoaded] = useState<{ key: string; items: Map<string, PaperItemSnapshot[]>; failed: boolean } | null>(null);

  useEffect(() => {
    if (!enabled || !key) return;
    let alive = true;
    const k = `${key}#${attempt}`;
    fetchChapterItems(key.split('|'))
      .then((items) => { if (alive) setLoaded({ key: k, items, failed: false }); })
      .catch((e) => {
        if (!alive) return;
        toast.error(e instanceof Error && e.message ? e.message : '장의 문항을 불러오지 못했어요.');
        setLoaded({ key: k, items: EMPTY, failed: true });
      });
    return () => { alive = false; };
  }, [enabled, key, attempt]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);
  const current = loaded?.key === loadKey ? loaded : null;
  return {
    items: current?.items ?? EMPTY,
    loading: enabled && key !== '' && current === null,
    failed: current?.failed ?? false,
    reload,
  };
}
