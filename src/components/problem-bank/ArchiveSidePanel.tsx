'use client';

import { useState } from 'react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import GrammarTreePanel from '@/components/problem-bank/GrammarTreePanel';
import SchoolExamTreePanel from '@/components/problem-bank/SchoolExamTreePanel';
import UnitTreePanel from '@/components/problem-bank/UnitTreePanel';
import WorkTreePanel from '@/components/problem-bank/WorkTreePanel';
import type { WorkFacet } from '@/lib/problem-bank/facets';
import type { ProblemFilters } from '@/lib/problem-bank/filters';
import {
  initialSideTab, type ArchiveSideTab, type SchoolExamFacet,
} from '@/lib/problem-bank/school-exam-tree';

const TABS: ArchiveSideTab[] = ['units', 'schools', 'works', 'grammar'];

interface ArchiveSidePanelProps {
  filters: ProblemFilters;
  schoolExams: SchoolExamFacet[];
  works: WorkFacet[];
  /** 문법 경로별 문항 수 — 트리는 마스터로 그리고 건수만 얹는다 */
  grammarCounts: ReadonlyMap<string, number>;
  onChange: (patch: Partial<ProblemFilters>) => void;
}

/**
 * 아카이브 왼쪽 패널 — 훑는 방법을 고른다.
 *
 * 같은 문항에 이르는 길이 넷이다: **교과서 단원**(무엇을 가르치는 문항인가),
 * **학교 기출**(누가 언제 낸 문항인가), **작품**(어떤 글에 딸린 문항인가),
 * **문법**(어떤 개념을 묻는 문항인가).
 * 한 화면에 쌓으면 세로가 길어져 트리를 쓸 수 없으므로 탭으로 가른다.
 *
 * 첫 탭은 주소에서 복원한 조건을 따른다 — 학교 링크를 받아 열었는데 교과서 트리가
 * 켜져 있으면 왜 이 목록인지 알 수 없다.
 */
export default function ArchiveSidePanel({
  filters, schoolExams, works, grammarCounts, onChange,
}: ArchiveSidePanelProps) {
  const [tab, setTab] = useState<ArchiveSideTab>(() => initialSideTab(filters));

  return (
    <div className="space-y-2">
      <Tabs
        value={tab}
        // base-ui 는 값으로 null 을 줄 수 있다(CLAUDE.md Known Issues)
        onValueChange={(v) => { if (TABS.includes(v as ArchiveSideTab)) setTab(v as ArchiveSideTab); }}
      >
        <TabsList className="w-full">
          <TabsTrigger value="units">교과서</TabsTrigger>
          <TabsTrigger value="schools">학교 기출</TabsTrigger>
          <TabsTrigger value="works">작품</TabsTrigger>
          <TabsTrigger value="grammar">문법</TabsTrigger>
        </TabsList>
      </Tabs>

      {tab === 'units' && <UnitTreePanel filters={filters} onChange={onChange} />}
      {tab === 'schools' && (
        <SchoolExamTreePanel filters={filters} tuples={schoolExams} onChange={onChange} />
      )}
      {tab === 'works' && <WorkTreePanel filters={filters} works={works} onChange={onChange} />}
      {tab === 'grammar' && (
        <GrammarTreePanel filters={filters} counts={grammarCounts} onChange={onChange} />
      )}
    </div>
  );
}
