'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { bookCoverSignature, normalizePageCounts } from '@/lib/book';

/** 보고 있는 동안 다시 확인하는 간격 */
const WATCH_INTERVAL_MS = 60_000;

interface ChapterRow {
  paper_id: string;
  paper: { updated_at: string } | null;
}

/**
 * 열어 둔 책 화면이 믿고 있는 쪽 수·담긴 문제지가 바뀌었는지 지켜본다 — 창으로 돌아올 때·1분마다·부를 때(`check` —
 * 표지·내지 인쇄 단추가 인쇄 직전에 부른다, 코덱스 10R).
 *
 * ⚠️ 다른 탭에서 담긴 문제지를 고치면(sql/103) DB 의 쪽 수가 비워지지만 이 화면은 읽어 둔 값으로 옛 책등을 그린다
 *    (코덱스 5R). 바뀌었으면 화면이 펼침면 대신 인쇄물에도 찍히는 안내를 그린다. 조회가 실패하면 판단하지 않는다.
 * @param bookId - 책 id
 * @param signature - 화면이 믿고 있는 값의 서명(`bookCoverSignature`). 지켜볼 것이 없으면(표지만 항목) null
 * @param withPageCounts - 저장된 쪽 수까지 견주는가 — 표지 화면은 true, 내지 화면은 쪽 수를 스스로 저장하므로 false
 * @returns 바뀌었는가 · 지금 확인하기
 */
export function useBookRevisionWatch(bookId: string, signature: string | null, withPageCounts: boolean) {
  const [staleFor, setStaleFor] = useState<string | null>(null);
  const signatureRef = useRef(signature);
  useEffect(() => { signatureRef.current = signature; }, [signature]);

  /** 지금 판을 확인한다 — 바뀌었으면 true(인쇄 단추가 이 값을 기다렸다가 인쇄하지 않는다). 조회 실패·지켜볼 것 없음은 false */
  const check = useCallback(async (): Promise<boolean> => {
    const seen = signatureRef.current;
    if (!seen) return false;
    const [bookRes, chapterRes] = await Promise.all([
      supabase.from('books').select('page_counts').eq('id', bookId).maybeSingle(),
      supabase.from('book_chapters').select('paper_id, paper:problem_papers(updated_at)').eq('book_id', bookId)
        .order('order_index').order('created_at'),
    ]);
    if (bookRes.error || chapterRes.error || !bookRes.data || signatureRef.current !== seen) return false;
    const now = bookCoverSignature(
      withPageCounts ? normalizePageCounts((bookRes.data as { page_counts: unknown }).page_counts) : null,
      ((chapterRes.data ?? []) as unknown as ChapterRow[]).map((c) => ({ paperId: c.paper_id, revision: c.paper?.updated_at ?? '' })),
    );
    if (now === seen) return false;
    setStaleFor(seen);
    return true;
  }, [bookId, withPageCounts]);

  useEffect(() => {
    if (!signature) return undefined;
    const onVisible = () => { if (document.visibilityState === 'visible') void check(); };
    window.addEventListener('focus', onVisible);
    document.addEventListener('visibilitychange', onVisible);
    const timer = window.setInterval(() => { void check(); }, WATCH_INTERVAL_MS);
    return () => {
      window.removeEventListener('focus', onVisible);
      document.removeEventListener('visibilitychange', onVisible);
      window.clearInterval(timer);
    };
  }, [signature, check]);

  return { stale: staleFor !== null && staleFor === signature, check };
}
