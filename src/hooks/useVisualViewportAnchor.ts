'use client';

import { useEffect, type RefObject } from 'react';

/**
 * 오른쪽 아래에 떠 있는(fixed) 요소를 손가락으로 확대(핀치 줌)한 화면에서도 보이는 곳에 둔다.
 *
 * fixed 는 레이아웃 뷰포트에 붙는데, 휴대폰에서 확대하면 실제로 보이는 곳(비주얼 뷰포트)은 그 안의 일부라 단추가 화면 밖에
 * 남는다(코덱스 17R — 412px 폭 2배 확대에서 오류 신고 단추가 끝까지 내려도 안 보였다). 비주얼 뷰포트의 오른쪽 아래 모서리와
 * 레이아웃 뷰포트의 오른쪽 아래 모서리의 차이만큼 옮긴다. 확대하지 않았으면(차이 0) 옮기지 않는다. `visualViewport` 가 없는
 * 브라우저에서는 아무것도 하지 않는다.
 * @param ref - 옮길 요소
 * @param enabled - 켤 때만
 */
export function useVisualViewportAnchor(ref: RefObject<HTMLElement | null>, enabled: boolean): void {
  useEffect(() => {
    const vv = typeof window !== 'undefined' ? window.visualViewport : null;
    if (!enabled || !vv) return undefined;
    const el = ref.current;
    const update = () => {
      if (!el) return;
      const root = document.documentElement;
      const dx = vv.offsetLeft + vv.width - root.clientWidth;
      const dy = vv.offsetTop + vv.height - root.clientHeight;
      el.style.transform = dx === 0 && dy === 0 ? '' : `translate(${dx}px, ${dy}px)`;
    };
    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
      if (el) el.style.transform = '';
    };
  }, [ref, enabled]);
}
