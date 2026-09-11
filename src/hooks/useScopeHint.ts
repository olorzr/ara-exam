'use client';

import { useEffect, useRef, useState } from 'react';
import { fetchScopeHint, type ScopeHint } from '@/lib/problem-bank/scope-resolve';

/**
 * 관리자시스템 **내신 관리**에 등록된 시험범위 힌트를 읽는다 (업로드·검수 공용).
 *
 * 학교만 고르면 조회한다 — 나머지 조건은 어느 슬롯을 고를지에만 쓰인다.
 * ⚠️ 조회 실패는 fail-soft: 힌트가 없을 뿐 업로드·검수를 막지 않는다.
 * ⚠️ 조건이 바뀌면 값을 지우는 대신 **파생**해서 null 로 만든다(효과 안에서 setState 를
 *    부르면 `react-hooks/set-state-in-effect` 에 걸린다). 옛 학교의 힌트가 화면에 남아
 *    있으면 선생님이 다른 학교의 교과서를 자기 것으로 읽는다.
 */

/** 무엇을 기준으로 힌트를 찾을지 (폼 표시값 그대로) */
export interface ScopeHintInput {
  /** public.schools.id. '' 면 조회하지 않는다 */
  schoolId: string;
  grade: string;
  year: string;
  semester: string;
  examType: string;
  /** 이 앱의 교과서(출판사) 이름 목록 — 비어 있으면 이름을 맞출 수 없어 조회하지 않는다 */
  textbookNames: readonly string[];
  /** 이 화면에서 힌트를 쓸 상황인가 (예: 학교 칸이 보이는 출처 유형인가) */
  enabled: boolean;
}

/**
 * @param input - 조회 조건
 * @param onHint - 힌트가 도착할 때마다 찾은 교과서 이름(못 찾으면 null)을 알려 준다.
 *   **채울지 말지는 호출부가 정한다** — 직접 고른 값을 덮으면 안 된다
 * @returns 힌트. 조건이 모자라거나 등록된 범위가 없으면 null
 */
export function useScopeHint(
  input: ScopeHintInput,
  onHint?: (matched: string | null) => void,
): ScopeHint | null {
  const { schoolId, grade, year, semester, examType, textbookNames, enabled } = input;
  const [loaded, setLoaded] = useState<{ key: string; hint: ScopeHint | null } | null>(null);

  // 콜백이 렌더마다 새로 와도 효과가 다시 돌지 않게 참조로 들고 있는다.
  // ⚠️ 참조 갱신은 렌더 중이 아니라 효과에서 하고(react-hooks/refs), 아래 효과보다
  //    **먼저** 선언해야 같은 렌더에서 최신 값을 보고 돈다(효과는 선언 순서대로 실행된다).
  const onHintRef = useRef(onHint);
  useEffect(() => { onHintRef.current = onHint; });

  const key = [schoolId, grade, year, semester, examType, String(enabled)].join('|');
  useEffect(() => {
    if (!enabled || !schoolId || textbookNames.length === 0) return undefined;
    let alive = true;
    fetchScopeHint({ schoolId, grade, year, semester, examType, textbookNames })
      .then((hint) => {
        if (!alive) return;
        setLoaded({ key, hint });
        onHintRef.current?.(hint?.matchedTextbook ?? null);
      })
      .catch(() => {
        if (!alive) return;
        setLoaded({ key, hint: null });
        onHintRef.current?.(null);
      });
    return () => { alive = false; };
  }, [key, schoolId, grade, year, semester, examType, textbookNames, enabled]);

  return loaded?.key === key ? loaded.hint : null;
}
