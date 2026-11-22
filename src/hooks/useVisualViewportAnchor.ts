'use client';

import { useEffect } from 'react';

/** 어디에 붙이나 — 오른쪽 아래 모서리(떠 있는 단추) · 가운데(창) */
export type ViewportAnchor = 'corner' | 'center';

/** 옮기기에 쓰는 인라인 스타일 칸 */
type AnchorStyle = Partial<Record<'transform' | 'transformOrigin' | 'left' | 'top', string>>;

/** 비운 상태 — 확대하지 않았을 때·끝낼 때 */
const CLEARED: Required<AnchorStyle> = { transform: '', transformOrigin: '', left: '', top: '' };

/**
 * 요소의 인라인 스타일을 고친다 — 훅 밖 함수라 React Compiler 가 '훅 인자를 고친다' 로 막지 않는다(DOM 쓰기는 효과 안에서만 부른다).
 * @param node - 요소
 * @param style - 바꿀 칸(빈 글이면 지운다)
 */
function applyAnchorStyle(node: HTMLElement, style: AnchorStyle): void {
  Object.assign(node.style, { ...CLEARED, ...style });
}

/** 계산된 px 값 — 못 읽으면 0 */
const px = (value: string): number => {
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? n : 0;
};

/**
 * 고정(fixed) 요소를 손가락으로 확대(핀치 줌)한 화면에서도 **보이는 곳에, 확대 전과 같은 크기로** 둔다.
 *
 * fixed 는 레이아웃 뷰포트에 붙는데, 휴대폰에서 확대하면 실제로 보이는 곳(비주얼 뷰포트)은 그 안의 일부라 요소가 화면 밖에
 * 남는다(코덱스 17R — 412px 폭 2배 확대에서 오류 신고 단추가 안 보였다). 그리고 옮기기만 하면 크기는 확대된 그대로라 높은
 * 배율에서는 단추 글자가 잘리고 창의 단추가 화면 밖으로 나간다(18R). 그래서 `1/배율` 로 줄여 확대 전과 같은 실제 크기로 두고,
 * - `corner`: 비주얼 뷰포트 오른쪽 아래에 붙인다(바깥 여백도 확대 전과 같은 실제 크기로)
 * - `center`: 비주얼 뷰포트 가운데에 둔다(창 — 창의 `translate(-50%,-50%)` 는 그대로 쓴다)
 * 확대하지 않았으면 아무것도 바꾸지 않는다. `visualViewport` 가 없는 브라우저에서는 아무것도 하지 않는다.
 * 요소는 콜백 ref 로 받은 값을 넘긴다 — 창처럼 늦게 붙는 요소도 붙는 순간 다시 돈다.
 * @param el - 옮길 요소(아직 없으면 null)
 * @param enabled - 켤 때만(창이면 열렸을 때)
 * @param anchor - 붙일 자리
 */
export function useVisualViewportAnchor(
  el: HTMLElement | null, enabled: boolean, anchor: ViewportAnchor = 'corner',
): void {
  useEffect(() => {
    const vv = typeof window !== 'undefined' ? window.visualViewport : null;
    if (!enabled || !vv || !el) return undefined;
    const reset = () => applyAnchorStyle(el, {});
    const update = () => {
      const scale = vv.scale > 0 ? vv.scale : 1;
      const root = document.documentElement;
      const dx = vv.offsetLeft + vv.width - root.clientWidth;
      const dy = vv.offsetTop + vv.height - root.clientHeight;
      if (scale === 1 && dx === 0 && dy === 0) {
        reset();
        return;
      }
      if (anchor === 'center') {
        applyAnchorStyle(el, {
          left: `${vv.offsetLeft + vv.width / 2}px`, top: `${vv.offsetTop + vv.height / 2}px`,
          transformOrigin: 'center', transform: `scale(${1 / scale})`,
        });
        return;
      }
      // 바깥 여백(right·bottom)도 실제 크기를 지키게 — 레이아웃 px 여백은 확대하면 그만큼 커진다
      const style = getComputedStyle(el);
      const gapX = px(style.right) - px(style.right) / scale;
      const gapY = px(style.bottom) - px(style.bottom) / scale;
      applyAnchorStyle(el, {
        transformOrigin: 'bottom right', transform: `translate(${dx + gapX}px, ${dy + gapY}px) scale(${1 / scale})`,
      });
    };
    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
      reset();
    };
  }, [el, enabled, anchor]);
}
