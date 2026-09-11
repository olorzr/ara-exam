'use client';

import { useCallback, useRef, useState } from 'react';

/**
 * 값과 함께 **늘 최신인 ref** 를 내주는 state.
 *
 * 왜 필요한가: 오래 걸리는 일(파일 올리기·AI 호출)을 시작한 뒤, **끝날 때의** 값이
 * 필요할 때가 있다. 콜백이 시작 시점의 값을 닫아 두면 그 사이 사람이 친 내용이
 * **말없이 되돌아간다** — 그림을 붙이는 동안 발문을 고치면 실제로 그랬다(코덱스 리뷰).
 *
 * ⚠️ ref 는 **설정 함수 안에서만** 쓴다. 렌더 중에 쓰면 `react-hooks/refs` 가 막는다
 *    (그리고 동시 렌더에서 어긋난다).
 * @param initial - 첫 값
 * @returns `[값, 설정 함수, 최신 ref]`
 */
export function useTrackedState<T>(initial: T) {
  const [value, setValue] = useState(initial);
  const ref = useRef(initial);

  const set = useCallback((next: T) => {
    ref.current = next;
    setValue(next);
  }, []);

  return [value, set, ref] as const;
}
