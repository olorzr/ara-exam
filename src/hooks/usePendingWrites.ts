'use client';

import { useCallback, useMemo, useRef, useState } from 'react';

/**
 * 도는 중인 쓰기(저장·지우기·합치기)를 센다 — 화면을 옮기기 전에 끝나기를 기다리게 하려고.
 *
 * 원본 대조 고치기 화면에서 저장이 끝나기 전에 '읽기 전용으로 보기' 로 가면 쓰기는 그대로 돌고, 읽기 전용 화면이 그보다
 * 먼저 DB 를 읽어 옛 내용을 보인다(코덱스 4R). `track` 으로 감싼 함수가 약속을 돌려주면 끝날 때까지 하나로 센다 —
 * 약속이 아니면 세지 않는다(즉시 끝난 일).
 * @returns 도는 쓰기 수와 감싸기 함수(늘 같은 함수)
 */
export function usePendingWrites() {
  const [pending, setPending] = useState(0);
  const count = useRef(0);

  const track = useCallback(<A extends unknown[], R>(fn: (...args: A) => R) => (...args: A): R => {
    const result = fn(...args);
    if (!(result instanceof Promise)) return result;
    count.current += 1;
    setPending(count.current);
    const settle = () => {
      count.current -= 1;
      setPending(count.current);
    };
    result.then(settle, settle);
    return result;
  }, []);

  return useMemo(() => ({ pending, track }), [pending, track]);
}
