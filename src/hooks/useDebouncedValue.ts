'use client';

import { useEffect, useState } from 'react';

/**
 * 값이 `delayMs` 동안 바뀌지 않았을 때에만 따라오는 값.
 *
 * 입력칸은 친 그대로 보여 주고, 무거운 조회만 손이 멈춘 뒤에 돌리고 싶을 때 쓴다
 * (아카이브 검색 — 글자마다 문항 29,000행을 훑지 않게).
 *
 * ⚠️ 바뀐 값은 **타이머 콜백 안에서만** 넣는다 — 효과 본문에서 동기로 setState 하면
 *    `react-hooks/set-state-in-effect` 에 걸리고 렌더가 한 번 더 돈다.
 * @param value - 따라갈 값
 * @param delayMs - 멈춰 있어야 하는 시간(ms)
 * @returns 늦게 따라오는 값 (처음에는 `value` 그대로)
 */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return settled;
}
