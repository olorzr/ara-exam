'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';

/** 보고 있는 동안 판을 다시 확인하는 간격 */
const WATCH_INTERVAL_MS = 60_000;

/**
 * 열어 둔 문제지가 다른 곳에서 고쳐졌는지 지켜본다 — 창으로 돌아올 때·1분마다·부를 때(`check` — 인쇄 단추가 인쇄 직전에 부른다).
 *
 * ⚠️ 문제지는 만든 뒤에도 고친다(sql/103). 보기 화면을 열어 둔 사이 다른 탭이 차례를 바꾸고 학원 성적에 새 정답표를
 *    올리면, 이 화면은 옛 차례를 그대로 인쇄한다 — 인쇄물과 정답표가 어긋난다(코덱스 4R P1). 바뀌었으면 화면이 인쇄를
 *    잠그고 인쇄물에도 찍히는 안내를 띄운다(Cmd/Ctrl+P 는 단추를 건너뛴다).
 * 조회가 실패하면 판단하지 않는다(그대로 둔다). 문제지가 지워졌으면 바뀐 것으로 친다.
 * @param paperId - 문제지 id
 * @param revision - 화면이 읽은 판(`updated_at`, 글자 그대로). 아직 못 읽었으면 undefined
 * @returns 바뀌었는가 · 지금 확인하기
 */
export function usePaperRevisionWatch(paperId: string, revision: string | undefined) {
  const [staleFor, setStaleFor] = useState<string | null>(null);
  const revisionRef = useRef(revision);
  useEffect(() => { revisionRef.current = revision; }, [revision]);

  /** 지금 판을 확인한다 — 바뀌었으면 true(인쇄 단추가 이 값을 기다렸다가 인쇄하지 않는다). 조회 실패는 false */
  const check = useCallback(async (): Promise<boolean> => {
    const seen = revisionRef.current;
    if (!seen) return false;
    const { data, error } = await supabase.from('problem_papers').select('updated_at').eq('id', paperId).maybeSingle();
    if (error || revisionRef.current !== seen) return false;
    const now = (data as { updated_at?: string } | null)?.updated_at;
    if (now === seen) return false;
    setStaleFor(seen);
    return true;
  }, [paperId]);

  useEffect(() => {
    if (!revision) return undefined;
    const onVisible = () => { if (document.visibilityState === 'visible') void check(); };
    window.addEventListener('focus', onVisible);
    document.addEventListener('visibilitychange', onVisible);
    const timer = window.setInterval(() => { void check(); }, WATCH_INTERVAL_MS);
    return () => {
      window.removeEventListener('focus', onVisible);
      document.removeEventListener('visibilitychange', onVisible);
      window.clearInterval(timer);
    };
  }, [revision, check]);

  return { stale: staleFor !== null && staleFor === revision, check };
}
