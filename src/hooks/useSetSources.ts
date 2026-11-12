'use client';

import { useEffect, useState } from 'react';
import type { SourceListRow } from '@/lib/problem-bank/source-list';
import { fetchSetSources } from '@/lib/problem-bank/source-set-queries';
import type { SourceSetKey } from '@/lib/problem-bank/source-sets';

/** 읽기 실패 문구 */
function failMessage(e: unknown): string {
  return e instanceof Error && e.message ? e.message : '시험지를 불러오지 못했어요.';
}

/**
 * 세트 한 장에 든 출처(학교별 시험)를 읽는다.
 *
 * 결과는 그것을 만든 **세트 + 시도 번호**와 함께 든다 — 주소가 바뀌어 다른 세트를 보는데 앞 세트의 학교가
 * 남아 보이면 안 된다(늦게 온 응답은 효과 정리가 버린다). 세트는 글자(JSON)로 견준다 — 부모가 렌더마다 새 객체를
 * 넘겨도 다시 읽지 않는다(ProblemDetailDialog 의 `exclusionKey` 와 같은 수법).
 * @param set - 세트 칸. null 이면 읽지 않는다
 * @returns 출처들·로딩·오류·다시 읽기
 */
export function useSetSources(set: SourceSetKey | null) {
  const key = set ? JSON.stringify(set) : null;
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ key: string | null; attempt: number; rows: SourceListRow[]; error: string | null }>(
    { key: null, attempt: -1, rows: [], error: null },
  );

  useEffect(() => {
    if (key === null) return;
    let alive = true;
    fetchSetSources(JSON.parse(key) as SourceSetKey)
      .then((rows) => { if (alive) setResult({ key, attempt, rows, error: null }); })
      .catch((e: unknown) => { if (alive) setResult({ key, attempt, rows: [], error: failMessage(e) }); });
    return () => { alive = false; };
  }, [key, attempt]);

  const current = key !== null && result.key === key;
  const settled = current && result.attempt === attempt;
  return {
    rows: current ? result.rows : [],
    loading: key !== null && !settled,
    error: settled ? result.error : null,
    reload: () => setAttempt((n) => n + 1),
  };
}
