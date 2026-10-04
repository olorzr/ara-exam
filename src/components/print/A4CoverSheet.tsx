import type { ReactNode } from 'react';
import { A4_HEIGHT_PX, A4_WIDTH_PX } from '@/lib/print/constants';

interface A4CoverSheetProps {
  /** 타이포그래피 스코프 클래스 (문서와 같은 것) */
  className?: string;
  children: ReactNode;
}

/**
 * 표지 한 장.
 *
 * 본문 낱장(`A4Sheet`)과 같은 크기지만 **여백·머리글·푸터가 없다** — 표지는 종이 전체를 쓰고
 * 쪽 번호를 세지 않는다(책 관례). 실측 배정 밖의 고정 한 장이라 측정 컨테이너에 넣지 않는다.
 * 크기는 상수에서 인라인 style 로 준다(CSS 에 px 를 복사하지 않는다).
 */
export default function A4CoverSheet({ className = '', children }: A4CoverSheetProps) {
  return (
    <section
      className={`a4-sheet a4-sheet--cover ${className}`.trim()}
      aria-label="표지"
      style={{ width: A4_WIDTH_PX, height: A4_HEIGHT_PX }}
    >
      {children}
    </section>
  );
}
