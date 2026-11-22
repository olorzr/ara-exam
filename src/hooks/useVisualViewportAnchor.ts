'use client';

import { useEffect } from 'react';

/** 옮기기에 쓰는 인라인 스타일 칸 */
type AnchorStyle = Partial<Record<'transform' | 'transformOrigin', string>>;

/** 비운 상태 — 확대하지 않았을 때·끝낼 때 */
const CLEARED: Required<AnchorStyle> = { transform: '', transformOrigin: '' };

/**
 * 요소의 인라인 스타일을 고친다 — 훅 밖 함수라 React Compiler 가 '훅 인자를 고친다' 로 막지 않는다(DOM 쓰기는 효과 안에서만 부른다).
 * @param node - 요소
 * @param style - 바꿀 칸(빈 글이면 지운다)
 */
function applyAnchorStyle(node: HTMLElement, style: AnchorStyle): void {
  Object.assign(node.style, { ...CLEARED, ...style });
}

/**
 * 손가락으로 확대(핀치 줌)한 상태인가 — 신고 창이 열 때 종이를 옮기지 않게 초점 자리를 고르는 데 쓴다.
 * @returns 비주얼 뷰포트 배율이 1 보다 크면 true(없으면 false)
 */
export function isPinchZoomed(): boolean {
  const vv = typeof window !== 'undefined' ? window.visualViewport : null;
  return Boolean(vv && vv.scale > 1);
}

/** 계산된 px 값 — 못 읽으면 0 */
const px = (value: string): number => {
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? n : 0;
};

/**
 * 오른쪽 아래에 떠 있는(fixed) 요소를 손가락으로 확대(핀치 줌)한 화면에서도 **보이는 곳 오른쪽 아래에, 확대 전과 같은 크기로** 둔다.
 *
 * fixed 는 레이아웃 뷰포트에 붙는데, 휴대폰에서 확대하면 실제로 보이는 곳(비주얼 뷰포트)은 그 안의 일부라 요소가 화면 밖에
 * 남는다(코덱스 17R — 412px 폭 2배 확대에서 오류 신고 단추가 안 보였다). 옮기기만 하면 크기는 확대된 그대로라 높은 배율에서
 * 글자가 잘려(18R) `1/배율` 로 줄이고 바깥 여백도 확대 전 실제 크기로 맞춘다. 확대하지 않았으면 아무것도 바꾸지 않는다.
 * `visualViewport` 가 없는 브라우저에서는 아무것도 하지 않는다.
 * ⚠️ 창(신고 창)에는 쓰지 않는다 — 창을 보이는 곳에 따라 붙였더니 열 때 초점이 종이를 옮기고, 키보드가 올라오면 초점 칸이
 *    창 안에서 가려졌다(코덱스 19·20R). 창은 보통 창 그대로 두고 브라우저가 초점 칸으로 옮겨 보이게 한다.
 * 요소는 콜백 ref 로 받은 값을 넘긴다.
 * @param el - 옮길 요소(아직 없으면 null)
 * @param enabled - 켤 때만
 */
export function useVisualViewportAnchor(el: HTMLElement | null, enabled: boolean): void {
  useEffect(() => {
    const vv = typeof window !== 'undefined' ? window.visualViewport : null;
    if (!enabled || !vv || !el) return undefined;
    const reset = () => applyAnchorStyle(el, {});
    const update = () => {
      const scale = vv.scale > 0 ? vv.scale : 1;
      // 옮기지 않은 자리를 실제로 잰다 — 뿌리 요소 크기로 짐작하면 문서가 넘쳐 레이아웃 뷰포트가 커진 화면에서 틀린다(코덱스 23R)
      reset();
      const rect = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      // 목표: 보이는 곳 오른쪽 아래에서 바깥 여백(실제 크기 그대로 = 레이아웃 px 여백/배율)만큼 안쪽
      const dx = vv.offsetLeft + vv.width - px(style.right) / scale - rect.right;
      const dy = vv.offsetTop + vv.height - px(style.bottom) / scale - rect.bottom;
      if (scale === 1 && Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return;
      applyAnchorStyle(el, {
        transformOrigin: 'bottom right', transform: `translate(${dx}px, ${dy}px) scale(${1 / scale})`,
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
  }, [el, enabled]);
}
