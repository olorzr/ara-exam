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

/** 읽는 사이 문제지가 고쳐지면 다시 읽는 횟수 */
const CONSISTENT_READ_TRIES = 3;

interface PaperRead {
  row: ProblemPaper | null;
  items: PaperItemSnapshot[];
}

/**
 * 문제지 행과 항목을 **같은 판으로** 읽는다 — 행 → 항목 → 행(판만) 차례로 읽어 판이 같을 때만 쓴다.
 *
 * ⚠️ 문제지는 만든 뒤에도 고친다(sql/103). 둘을 따로(또는 동시에) 읽으면 그 사이 고치기가 끝났을 때 고치기 전 문항과
 *    고친 뒤 설정이 섞인 문제지를 인쇄하게 된다 — 학원 성적에는 이미 새 차례의 정답표가 올라가 있다(코덱스 3R).
 *    고치기 RPC 는 항목과 함께 문제지 행을 늘 고쳐 판(updated_at)이 오르므로 판이 같으면 항목도 같다.
 */
async function readPaperConsistent(paperId: string): Promise<PaperRead> {
  for (let attempt = 0; attempt < CONSISTENT_READ_TRIES; attempt += 1) {
    const paperRes = await supabase.from('problem_papers').select('*').eq('id', paperId).maybeSingle();
    if (paperRes.error) throw paperRes.error;
    const row = paperRes.data as ProblemPaper | null;
    if (!row) return { row: null, items: [] };
    const itemRes = await supabase.from('problem_paper_items').select('order_index, snapshot')
      .eq('paper_id', paperId).order('order_index').limit(300);
    if (itemRes.error) throw itemRes.error;
    const again = await supabase.from('problem_papers').select('updated_at').eq('id', paperId).maybeSingle();
    if (again.error) throw again.error;
    if ((again.data as { updated_at?: string } | null)?.updated_at === row.updated_at) {
      return { row, items: ((itemRes.data ?? []) as { snapshot: PaperItemSnapshot }[]).map((r) => r.snapshot) };
    }
  }
  throw new Error('문제지가 방금 고쳐지는 중이었어요. 잠시 뒤 새로 고쳐 주세요.');
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
        const { row, items } = await readPaperConsistent(paperId);
        const names = row ? await fetchCreatorNames([row.user_id]) : new Map<string, string>();
        next = {
          paper: row ? { ...row, settings: normalizePaperSettings(row.settings) } : null,
          items,
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
