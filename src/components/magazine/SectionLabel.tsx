import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface SectionLabelProps {
  /** 영문 작은 대문자(예: 'QUICK START') — 꾸밈이라 화면 읽기 프로그램에는 숨긴다 */
  en: string;
  /** 한글 이름(예: '빠른 실행') — 제목의 실제 이름이다 */
  children: ReactNode;
  className?: string;
}

/**
 * 구역 제목 — 넓은 자간의 영문 라벨 옆에 바탕체 한글을 작게 붙인다(잡지 테마, 2026-11-12).
 * @param props - 영문 라벨·한글 이름
 * @returns h2 구역 제목
 */
export default function SectionLabel({ en, children, className }: SectionLabelProps) {
  return (
    <h2 className={cn('flex items-baseline gap-2.5', className)}>
      <span aria-hidden="true" className="font-label text-[13px] font-extrabold tracking-[0.16em] text-ink">
        {en}
      </span>
      <span className="font-display text-[13px] font-normal tracking-[0.04em] text-gray-500">{children}</span>
    </h2>
  );
}
