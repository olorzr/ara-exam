'use client';

import { useState } from 'react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import SchoolExamTreePanel from '@/components/problem-bank/SchoolExamTreePanel';
import UnitTreePanel from '@/components/problem-bank/UnitTreePanel';
import type { ProblemFilters } from '@/lib/problem-bank/filters';
import { initialSideTab, type SchoolExamFacet } from '@/lib/problem-bank/school-exam-tree';

interface ArchiveSidePanelProps {
  filters: ProblemFilters;
  schoolExams: SchoolExamFacet[];
  onChange: (patch: Partial<ProblemFilters>) => void;
}

/**
 * 아카이브 왼쪽 패널 — 훑는 방법을 고른다.
 *
 * 같은 문항에 이르는 길이 둘이다: **교과서 단원**(무엇을 가르치는 문항인가)과
 * **학교 기출**(누가 언제 낸 문항인가). 둘을 한 화면에 쌓으면 세로가 길어져 트리를
 * 쓸 수 없으므로 탭으로 가른다.
 *
 * 첫 탭은 주소에서 복원한 조건을 따른다 — 학교 링크를 받아 열었는데 교과서 트리가
 * 켜져 있으면 왜 이 목록인지 알 수 없다.
 */
export default function ArchiveSidePanel({
  filters, schoolExams, onChange,
}: ArchiveSidePanelProps) {
  const [tab, setTab] = useState<'units' | 'schools'>(() => initialSideTab(filters));

  return (
    <div className="space-y-2">
      <Tabs
        value={tab}
        // base-ui 는 값으로 null 을 줄 수 있다(CLAUDE.md Known Issues)
        onValueChange={(v) => { if (v === 'units' || v === 'schools') setTab(v); }}
      >
        <TabsList className="w-full">
          <TabsTrigger value="units">교과서 · 단원</TabsTrigger>
          <TabsTrigger value="schools">학교 기출</TabsTrigger>
        </TabsList>
      </Tabs>

      {tab === 'units' ? (
        <UnitTreePanel filters={filters} onChange={onChange} />
      ) : (
        <SchoolExamTreePanel filters={filters} tuples={schoolExams} onChange={onChange} />
      )}
    </div>
  );
}
