'use client';

import { useSyncExternalStore, type ReactNode } from 'react';

/** 터치 화면인가 — 손가락으로 끌어 넘기는 화면에서만 상자 안 가로 스크롤을 쓴다(print-a4.css 의 `.a4-scroll-x` 와 같은 조건) */
const TOUCH_QUERY = '(hover: none)';

const touchMedia = (): MediaQueryList | null =>
  (typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia(TOUCH_QUERY) : null);

const subscribe = (onChange: () => void) => {
  const media = touchMedia();
  media?.addEventListener('change', onChange);
  return () => media?.removeEventListener('change', onChange);
};

/**
 * 문제지 미리보기의 가로 스크롤 상자 — **터치 화면에서만** 가로 넘침을 이 안에 가둔다(코덱스 13·16R).
 *
 * A4 낱장(794px)이 휴대폰보다 넓어 페이지째 넓어지면 모바일 크롬의 레이아웃 뷰포트가 커져 떠 있는 오류 신고 단추(fixed)가
 * 화면 밖으로 밀렸다. 마우스 화면에서는 상자 바닥(문서 맨 끝)에 가로 막대가 생겨 닿기 어려워 예전처럼 페이지가 넘친다 —
 * 데스크톱 브라우저는 fixed 를 늘 화면 안에 둔다. 인쇄에서는 어느 쪽이든 풀린다(print-a4.css).
 * 터치 화면에서는 키보드로도 넘기게 이름 있는 구역으로 초점을 받는다(사파리는 스크롤 상자에 초점을 안 준다, 14R).
 * 서버 그림에서는 터치가 아닌 것으로 그린다(하이드레이션이 어긋나지 않게).
 */
export default function PaperPreviewScroll({ children }: { children: ReactNode }) {
  const touch = useSyncExternalStore(subscribe, () => touchMedia()?.matches ?? false, () => false);
  return (
    <div
      className="a4-scroll-x focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
      {...(touch ? { role: 'region', 'aria-label': '문제지 미리보기', tabIndex: 0 } : {})}
    >
      {children}
    </div>
  );
}
