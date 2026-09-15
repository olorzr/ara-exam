'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  candidateInputValue, rankWorkCandidates,
  type BundleWorkRow, type PassageWorkRow, type WorkCandidate,
} from '@/lib/problem-bank/work-candidates';
import {
  fetchPrintBundleWorks, fetchSchoolPassageWorks,
} from '@/lib/problem-bank/work-candidates-fetch';

/**
 * 그 학교에 **이미 적혀 있는 작품명**을 읽어 업로드 폼의 작품 칸을 채운다.
 *
 * `useScopeHint` 와 같은 모양이다:
 *  - 학교만 고르면 조회한다(나머지 조건은 줄 세우기에만 쓴다).
 *  - 조건이 바뀌면 값을 지우는 대신 **파생**해서 비운다(효과 안 setState 금지).
 *  - 조회 실패는 fail-soft — 후보가 없을 뿐 업로드를 막지 않는다.
 *
 * ⚠️ 조회 키는 **학교 하나**다. 학년·학기가 바뀔 때마다 다시 읽으면 같은 표를 몇 번씩
 *    긁는다 — 줄 세우기는 손안의 값으로 `useMemo` 가 한다.
 */

/** 아직 못 읽었을 때 돌려줄 빈 값 — 참조가 바뀌지 않게 하나만 둔다 */
const EMPTY: WorkCandidate[] = [];

export interface WorkCandidatesInput {
  /** public.schools.id. '' 면 조회하지 않는다 */
  schoolId: string;
  year: string;
  grade: string;
  semester: string;
  examType: string;
  /** 이 화면에서 후보를 쓸 상황인가 (학교 칸이 보이는 출처 유형인가) */
  enabled: boolean;
}

/** 그 학교에서 읽어 둔 재료 */
interface Loaded {
  key: string;
  bundles: BundleWorkRow[];
  passages: PassageWorkRow[];
}

/**
 * @param input - 조회 조건
 * @param onHint - 후보가 정해질 때마다 칸에 넣을 값을 알려 준다(없으면 '').
 *   **채울지 말지는 호출부가 정한다** — 직접 친 작품은 덮으면 안 된다
 * @returns 가까운 순 후보. 학교를 안 골랐거나 아직 못 읽었으면 빈 배열
 */
export function useWorkCandidates(
  input: WorkCandidatesInput,
  onHint?: (value: string) => void,
): WorkCandidate[] {
  const { schoolId, year, grade, semester, examType, enabled } = input;
  const [loaded, setLoaded] = useState<Loaded | null>(null);

  // 콜백이 렌더마다 새로 와도 효과가 다시 돌지 않게 참조로 든다(useScopeHint 와 같다).
  // 아래 효과보다 **먼저** 선언해야 같은 렌더에서 최신 값을 본다
  const onHintRef = useRef(onHint);
  useEffect(() => { onHintRef.current = onHint; });

  const key = `${schoolId}|${String(enabled)}`;
  useEffect(() => {
    if (!enabled || !schoolId) return undefined;
    let alive = true;
    Promise.all([fetchPrintBundleWorks(schoolId), fetchSchoolPassageWorks(schoolId)])
      .then(([bundles, passages]) => {
        if (alive) setLoaded({ key, bundles, passages });
      })
      .catch(() => {
        // 조회 자체가 fail-soft 라 여기 오는 일은 없지만, 오더라도 칸만 비운다
        if (alive) setLoaded({ key, bundles: [], passages: [] });
      });
    return () => { alive = false; };
  }, [key, schoolId, enabled]);

  const rows = loaded?.key === key ? loaded : null;
  const candidates = useMemo(() => (
    rows
      ? rankWorkCandidates({
        bundles: rows.bundles,
        passages: rows.passages,
        wanted: { year, grade, semester, examType },
      })
      : EMPTY
  ), [rows, year, grade, semester, examType]);

  // 후보가 바뀔 때마다 칸에 넣을 값을 알린다 — 조건을 바꾸면 그 조건의 작품으로 따라간다.
  // ⚠️ 쓸 수 없는 상황(학교를 안 골랐거나 학교를 안 묻는 유형)에서는 **빈 값을 알린다**
  //    (코덱스 리뷰). 알리지 않고 넘어가면 내신기출에서 자동으로 채워 둔 앞 학교의 작품이
  //    문제집으로 바꾼 뒤에도 칸에 남아 그대로 AI 에게 실려 간다 — 화면에서 학교는 이미
  //    사라진 뒤라 어디서 온 값인지 알 길이 없다. 직접 친 작품은 `worksAuto` 가 지킨다
  const value = enabled && schoolId ? candidateInputValue(candidates) : '';
  useEffect(() => {
    onHintRef.current?.(value);
  }, [value]);

  return candidates;
}
