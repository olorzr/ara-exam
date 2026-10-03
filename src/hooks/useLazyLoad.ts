'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * 처음 필요할 때 **한 번만** 읽는다 — 고르기 창처럼 열어야 쓰는 무거운 목록용.
 *
 * 화면을 열 때마다 읽지 않는다: 작품 전문 편집 화면은 단원·작품 고르기 창을 열지 않고 끝나는
 * 일이 대부분인데, 그 목록은 표 여섯 개(카테고리)나 문항 전체(작품 패싯)를 훑는다.
 *
 * ⚠️ 읽기는 **효과가 아니라 `ensureLoaded` 를 부르는 쪽**(단추를 누른 이벤트)에서 시작한다.
 *    효과 본문에서 상태를 바꾸면 `react-hooks/set-state-in-effect` 가 막고, 열림 상태를 따라
 *    효과를 돌리면 '실패 → 다시 열기' 에서 실패 표시를 지울 자리가 없다.
 * ⚠️ 실패하면 다시 부를 수 있다(`failed` 를 보여 주고 다시 시도 단추가 `ensureLoaded` 를 부른다).
 * @param loader - 읽는 함수. 모듈 수준의 함수처럼 바뀌지 않는 것을 넘긴다(바뀌어도 마지막 것을 쓴다)
 * @returns 읽은 값(아직이면 null), 실패 여부, 읽기 시작
 */
export function useLazyLoad<T>(loader: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [failed, setFailed] = useState(false);
  const loaderRef = useRef(loader);
  /** 읽는 중이거나 이미 읽었다 — 겹쳐 부르지 않는다. ⚠️ state 가 아니라 ref(렌더 뒤에야 바뀐다) */
  const startedRef = useRef(false);
  const aliveRef = useRef(true);

  useEffect(() => { loaderRef.current = loader; }, [loader]);
  useEffect(() => {
    // StrictMode 의 setup → cleanup → setup 뒤에 꺼진 채로 남지 않게 본문에서 켠다
    aliveRef.current = true;
    return () => { aliveRef.current = false; };
  }, []);

  const ensureLoaded = useCallback(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    setFailed(false);
    loaderRef.current()
      .then((value) => { if (aliveRef.current) setData(value); })
      .catch(() => {
        // 다시 부를 수 있게 문을 연다
        startedRef.current = false;
        if (aliveRef.current) setFailed(true);
      });
  }, []);

  return { data, failed, ensureLoaded };
}
