'use client';

import { useEffect, useState } from 'react';
import { fetchSourceSets } from '@/lib/problem-bank/source-set-queries';
import type { SourceSet } from '@/lib/problem-bank/source-sets';

/** 읽기 실패 문구 */
function failMessage(e: unknown): string {
  return e instanceof Error && e.message ? e.message : '세트를 불러오지 못했어요.';
}

/**
 * 기출 세트 목록을 한 번 읽는다(`exam.source_sets()`, sql/107).
 *
 * 로딩은 state 가 아니라 '몇 번째 시도의 결과인가' 에서 파생한다 — 효과 본문의 동기 setState 는 lint 가 막는다.
 * 다시 읽는 동안에는 앞 결과를 그대로 보여 준다.
 * @returns 세트들·로딩·오류·다시 읽기
 */
export function useSourceSets() {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ attempt: number; sets: SourceSet[]; error: string | null }>(
    { attempt: -1, sets: [], error: null },
  );

  useEffect(() => {
    let alive = true;
    fetchSourceSets()
      .then((sets) => { if (alive) setResult({ attempt, sets, error: null }); })
      .catch((e: unknown) => { if (alive) setResult((prev) => ({ attempt, sets: prev.sets, error: failMessage(e) })); });
    return () => { alive = false; };
  }, [attempt]);

  const settled = result.attempt === attempt;
  return {
    sets: result.sets,
    loading: !settled,
    error: settled ? result.error : null,
    reload: () => setAttempt((n) => n + 1),
  };
}
