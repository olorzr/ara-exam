'use client';

import { useEffect, useState } from 'react';
import { fetchPassages, fetchProblemsOfSource, fetchSource } from '@/lib/problem-bank/source-queries';
import type { Passage, Problem, ProblemSource } from '@/types/problem-bank';

/** 시험 한 건 */
export interface ExamViewData {
  source: ProblemSource;
  passages: Passage[];
  problems: Problem[];
}

/** 읽기 실패 문구 */
function failMessage(e: unknown): string {
  return e instanceof Error && e.message ? e.message : '시험지를 불러오지 못했어요.';
}

/**
 * 읽기 전용 시험 보기의 데이터 — 출처·지문·문항을 **빠짐없이** 읽는다(검수 화면과 같은 조회).
 *
 * 검수 화면의 `loadReviewData` 를 쓰지 않는다 — 그쪽은 들어오자마자 쪽 이미지를 서명한다. 여기서 쪽 이미지는
 * 원본 탭을 열 때만 받는다.
 * @param id - 출처 id
 * @returns 데이터(없으면 null)·로딩·찾지 못함·오류·다시 읽기
 */
export function useExamView(id: string) {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{
    id: string; attempt: number; data: ExamViewData | null; missing: boolean; error: string | null;
  }>({ id: '', attempt: -1, data: null, missing: false, error: null });

  useEffect(() => {
    if (!id) return;
    let alive = true;
    Promise.all([fetchSource(id), fetchPassages(id), fetchProblemsOfSource(id)])
      .then(([source, passages, problems]) => {
        if (!alive) return;
        setResult({
          id, attempt, data: source ? { source, passages, problems } : null, missing: !source, error: null,
        });
      })
      .catch((e: unknown) => {
        if (alive) setResult({ id, attempt, data: null, missing: false, error: failMessage(e) });
      });
    return () => { alive = false; };
  }, [id, attempt]);

  const settled = Boolean(id) && result.id === id && result.attempt === attempt;
  return {
    data: settled ? result.data : null,
    loading: Boolean(id) && !settled,
    missing: settled && result.missing,
    error: settled ? result.error : null,
    reload: () => setAttempt((n) => n + 1),
  };
}
