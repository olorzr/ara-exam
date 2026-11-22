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
 * 화면이 둘(주소 둘)이라 base-ui `Tabs` 상태가 아니라 링크다(`aria-current="page"`). 모양은 앱 탭(`TabsTrigger`)과 같은
 * 밑줄 하나. 반대편 탭은 그 화면에서 마지막으로 보던 조건으로 간다(`examSheetHref`).
 */
export default function ExamSheetTabs({ current, children }: ExamSheetTabsProps) {
  return (
    <div className="space-y-2">
      <div className="space-y-3 border-b-2 border-ink">
        <PageTitle eyebrow="PROBLEM BANK · EXAM SHEETS">기출 시험지</PageTitle>
        <nav aria-label="기출 시험지 보기 방식" className="flex gap-5">
          {EXAM_SHEET_TABS.map((tab) => {
            const active = tab.view === current;
            return (
              <Link
                key={tab.view}
                href={active ? tab.path : examSheetHref(tab.view)}
                prefetch={false}
                aria-current={active ? 'page' : undefined}
                className={`relative pb-2 text-sm transition-colors ${
                  active
                    ? 'font-bold text-ink after:absolute after:inset-x-0 after:-bottom-[2px] after:h-[3px] after:bg-ink'
                    : 'font-medium text-gray-500 hover:text-ink'
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>
      </div>
      {children && <p className="text-sm text-gray-500">{children}</p>}
    </div>
  );
}
