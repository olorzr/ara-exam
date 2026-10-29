'use client';

import { useCallback, useMemo, useRef, useState } from 'react';

/** 여러 패널이 함께 쓰는 '하나만 불러오기' 잠금 */
export interface PickGate {
  /** 지금 무언가를 불러오는 중인가 — 고르기 단추를 잠근다 */
  busy: boolean;
  /**
   * 불러오기를 시작한다.
   * @returns 잠금을 얻었으면 true. 이미 다른 것을 불러오는 중이면 false — 아무것도 하지 말 것
   */
  begin: () => boolean;
  /** 실패해서 다시 고를 수 있게 잠금을 푼다 */
  end: () => void;
}

/**
 * 한 창 안의 여러 패널(탭)이 **한 번에 하나만** 불러오게 하는 잠금.
 *
 * 패널마다 잠금을 따로 두면 한 탭에서 고른 본문을 읽는 사이 다른 탭으로 가 또 고를 수 있고, 두 요청이
 * 함께 돌다 **먼저 고른 것이 늦게 와서** 나중에 고른 것을 덮는다(감춘 탭도 `keepMounted` 라 살아 있다).
 * 잠금은 ref 다 — 단추의 disabled 는 렌더 뒤라 같은 틈의 두 번 눌림을 못 막는다. 화면 잠금은 `busy` 로 한다.
 * @returns 잠금
 */
export function usePickGate(): PickGate {
  const lockRef = useRef(false);
  const [busy, setBusy] = useState(false);

  const begin = useCallback(() => {
    if (lockRef.current) return false;
    lockRef.current = true;
    setBusy(true);
    return true;
  }, []);

  const end = useCallback(() => {
    lockRef.current = false;
    setBusy(false);
  }, []);

  return useMemo(() => ({ busy, begin, end }), [busy, begin, end]);
}
