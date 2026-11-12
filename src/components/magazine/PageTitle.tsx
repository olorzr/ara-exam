import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface PageTitleProps {
  /** 제목 위 영문 작은 대문자 한 줄(예: 'PROBLEM BANK'). 꾸밈이라 화면 읽기 프로그램에는 숨긴다 */
  eyebrow?: string;
  /** 화면 제목 — h1 로 그린다 */
  children: ReactNode;
  /** 제목 크기. 작업 화면(편집·검수)은 'sm' */
  size?: 'md' | 'sm';
  className?: string;
}

/**
 * 화면 제목 — 영문 작은 대문자 라벨 + 고운바탕 한글 제목(연한 민트 잡지 테마, 2026-11-12).
 *
 * 제목 h1 하나만 바꾼다 — 옆 단추·아래 설명 같은 둘레 배치는 화면마다 그대로 둔다.
 * ⚠️ `<header>` 로 감싸지 말 것 — 인쇄 CSS 가 `header` 를 통째로 숨긴다(print-a4.css).
 * @param props - 영문 라벨·제목·크기
 * @returns 제목 블록
 */
export default function PageTitle({ eyebrow, children, size = 'md', className }: PageTitleProps) {
  return (
    <div className={cn('min-w-0', className)}>
      {eyebrow && (
        <p aria-hidden="true" className="mb-1 font-label text-[10.5px] font-bold tracking-[0.18em] text-ink">
          {eyebrow}
        </p>
      )}
      <h1
        className={cn(
          'font-display font-bold leading-tight tracking-[-0.01em] text-ink',
          size === 'md' ? 'text-[28px]' : 'text-2xl',
        )}
      >
        {children}
      </h1>
    </div>
  );
}
