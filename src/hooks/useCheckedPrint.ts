'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * 인쇄 단추가 인쇄 **직전에** 판을 한 번 더 확인하게 한다 — 문제지 보기 화면 · 책 표지 · 책 내지가 같이 쓴다.
 *
 * ⚠️ 창을 보는 동안 다른 곳에서 고쳐지면 감시(창으로 돌아올 때·1분마다)가 알기 전까지 인쇄 단추가 열려 있다(코덱스 9·10R).
 *    그래서 단추는 `check` 를 기다렸다가 바뀌지 않았을 때만 `go` 를 부른다. 기다리는 동안은 `checking` 이 참이라
 *    단추를 잠근다(두 번 누르지 않게 — 잠금은 ref 라 같은 렌더 안의 두 번째 누름도 막는다).
 * ⚠️ `go` 는 기다리기 **전** 값이 아니라 **지금** 값(`latest`)을 받는다 — 그사이 그림·글꼴·판 잠금이 다시 걸릴 수 있다
 *    (코덱스 정지 게이트). 부르는 쪽은 `go` 안에서 그 값으로 잠금을 다시 본다.
 * 확인이 던지면 판단하지 않는다(감시 훅과 같은 규약 — 조회 실패로 인쇄를 영영 막지 않는다). Cmd/Ctrl+P 는 이 길을
 * 건너뛰어 감시와 인쇄물에 찍히는 안내가 맡는다.
 * @param check - 지금 판을 확인한다 — 바뀌었으면 true(감시 훅의 `check`)
 * @param latest - 기다린 뒤에 볼 지금 값(잠금 등)
 * @returns 확인 중인가 · 확인한 뒤 인쇄하기
 */
export function useCheckedPrint<T>(check: () => Promise<boolean>, latest: T) {
  const [checking, setChecking] = useState(false);
  const busyRef = useRef(false);
  const latestRef = useRef(latest);
  useEffect(() => { latestRef.current = latest; });

  const run = useCallback(async (go: (now: T) => void) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setChecking(true);
    let changed = false;
    try {
      changed = await check();
    } catch {
      changed = false;
    } finally {
      busyRef.current = false;
      setChecking(false);
    }
    if (!changed) go(latestRef.current);
  }, [check]);

  return { checking, run };
}
