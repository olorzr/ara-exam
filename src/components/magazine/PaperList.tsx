import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface PaperListProps {
  /** 차례가 뜻이 있으면 ol(기본), 아니면 ul */
  as?: 'ol' | 'ul';
  className?: string;
  'aria-label'?: string;
  children: ReactNode;
}

/**
 * 종이 목록 — 민트 책상 위의 흰 종이 한 장에 줄을 점선으로 나눈다(2026-11-14, 원장님 "학교 프린트 시험지라던가 이런게 디자인이 안 예뻐").
 * 예전 목록은 흰 카드 안에 회색 테두리 상자를 또 쌓아(상자 안의 상자) 일반 관리자 화면처럼 보였다. 기출 세트의 학교 목록과 같은 결이다.
 * 줄(`li`)의 안쪽 여백은 쓰는 쪽이 정한다 — 보통 `px-4 py-3`.
 */
export default function PaperList({ as = 'ol', className, children, ...aria }: PaperListProps) {
  const Tag = as;
  return (
    <Tag
      {...aria}
      className={cn('divide-y divide-dashed divide-gray-300 overflow-hidden rounded-lg border border-gray-200 bg-card', className)}
    >
      {children}
    </Tag>
  );
}
