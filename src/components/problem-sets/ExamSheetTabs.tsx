'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { PageTitle } from '@/components/magazine';
import { EXAM_SHEET_TABS, examSheetHref, type ExamSheetView } from '@/lib/problem-bank/exam-sheet-tabs';

interface ExamSheetTabsProps {
  /** 지금 화면 */
  current: ExamSheetView;
  /** 머리 아래 설명 한 줄 — 화면마다 다르다 */
  children?: ReactNode;
}

/**
 * '기출 시험지' 머리 — 제목 + [세트로 보기][목록으로 보기] 링크 탭 + 설명 (2026-11-22, '기출 세트'·'올라간 기출' 을 합쳤다).
 *
 * 화면이 둘(주소 둘)이라 base-ui `Tabs` 상태가 아니라 링크다. 지금 화면 탭은 링크가 아닌 글(`aria-current="page"`) —
 * 눌러도 보던 조건이 그대로다. 모양은 앱 탭(`TabsTrigger`)과 같은 밑줄 하나. 반대편 탭은 그 화면에서 마지막으로 보던
 * 조건으로 간다(`examSheetHref`).
 */
export default function ExamSheetTabs({ current, children }: ExamSheetTabsProps) {
  return (
    <div className="space-y-2">
      <div className="space-y-3 border-b-2 border-ink">
        <PageTitle eyebrow="PROBLEM BANK · EXAM SHEETS">기출 시험지</PageTitle>
        <nav aria-label="기출 시험지 보기 방식" className="flex gap-5">
          {EXAM_SHEET_TABS.map((tab) => (
            // ⚠️ 지금 화면 탭은 링크가 아니다(코덱스 1R) — 맨 주소로 다시 오면 보던 조건이 지워진다(주소가 조건의 정본)
            tab.view === current ? (
              <span
                key={tab.view}
                aria-current="page"
                className="relative pb-2 text-sm font-bold text-ink after:absolute after:inset-x-0 after:-bottom-[2px] after:h-[3px] after:bg-ink"
              >
                {tab.label}
              </span>
            ) : (
              <Link
                key={tab.view}
                href={examSheetHref(tab.view)}
                prefetch={false}
                className="relative pb-2 text-sm font-medium text-gray-500 transition-colors hover:text-ink"
              >
                {tab.label}
              </Link>
            )
          ))}
        </nav>
      </div>
      {children && <p className="text-sm text-gray-500">{children}</p>}
    </div>
  );
}
