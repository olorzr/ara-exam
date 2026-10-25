'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { fetchCreatorNames } from '@/lib/creator-names';
import { normalizePaperSettings } from '@/lib/problem-paper/settings';
import type { PaperItemSnapshot, ProblemPaper } from '@/types/problem-bank';

/** 저장된 문제지 한 장을 읽은 결과 */
export interface PaperLoadState {
  paper: ProblemPaper | null;
  items: PaperItemSnapshot[];
  /** 다 읽었는가(실패해도 true — 없는 문제지 안내를 그린다) */
  loaded: boolean;
  /** 문제지를 만든 선생님 이름 — 표지의 '선생님' 줄이 비었을 때 쓴다. 못 읽으면 '' */
  creatorName: string;
}

/**
 * 문제지와 항목 스냅샷, 만든 선생님 이름을 읽는다.
 *
 * 이름은 **문제지와 함께** 다 읽은 뒤에 `loaded` 를 켠다 — 표지 글꼴 준비(`useCoverFontsReady`)가 찍을 글자에
 * 이름을 담으므로, 나중에 이름이 오면 그 글자 묶음이 바뀌어 인쇄 단추가 한 번 더 잠긴다. 이름은 곁들이는
 * 정보라 못 읽어도 막지 않는다(`fetchCreatorNames` 는 실패해도 빈 지도를 준다).
 * @param paperId - 문제지 id
 * @returns 읽은 결과
 */
export function usePaperLoad(paperId: string): PaperLoadState {
  const [state, setState] = useState<PaperLoadState>({ paper: null, items: [], loaded: false, creatorName: '' });

  useEffect(() => {
    let alive = true;
    (async () => {
      let next: PaperLoadState = { paper: null, items: [], loaded: true, creatorName: '' };
      try {
        const [paperRes, itemRes] = await Promise.all([
          supabase.from('problem_papers').select('*').eq('id', paperId).maybeSingle(),
          supabase.from('problem_paper_items').select('order_index, snapshot')
            .eq('paper_id', paperId).order('order_index').limit(300),
        ]);
        if (paperRes.error) throw paperRes.error;
        if (itemRes.error) throw itemRes.error;

        const row = paperRes.data as ProblemPaper | null;
        const names = row ? await fetchCreatorNames([row.user_id]) : new Map<string, string>();
        next = {
          paper: row ? { ...row, settings: normalizePaperSettings(row.settings) } : null,
          items: ((itemRes.data ?? []) as { snapshot: PaperItemSnapshot }[]).map((r) => r.snapshot),
          loaded: true,
          creatorName: row ? names.get(row.user_id) ?? '' : '',
        };
      } catch (e) {
        if (alive) toast.error(e instanceof Error ? e.message : '불러오지 못했어요.');
      }
      if (alive) setState(next);
    })();
    return () => { alive = false; };
  }, [paperId]);

  return state;
}
