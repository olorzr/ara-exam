'use client';

import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
 *
 * 아카이브(`/problems/archive`)와 문제지 조합(`/problems/papers/new`)이 이 패널을 함께 쓴다.
 */
export default function ArchiveSidePanel({
  filters, schoolExams, works, grammarCounts, onChange,
}: ArchiveSidePanelProps) {
  const [tab, setTab] = useState<ArchiveSideTab>(() => initialSideTab(filters));
  /**
   * 한 번이라도 연 탭. **연 탭의 트리만 마운트하고, 그 뒤로는 감춘 채 둔다**(코덱스 리뷰 2R).
   *
   * 트리를 넷 다 미리 마운트하면 학교·작품·문법 링크로 들어온 사람도 교과서 트리의
   * 카테고리 조회(표 6개)를 쓰지도 않을 탭 때문에 치른다.
   * 반대로 한 번 연 트리를 걷어내면 고른 폴더의 강조와 조회 결과를 잃는다(아래 참고).
   */
  const [seen, setSeen] = useState<ReadonlySet<ArchiveSideTab>>(() => new Set([tab]));

  const changeTab = (v: string) => {
    // base-ui 는 값으로 null 을 줄 수 있다(CLAUDE.md Known Issues)
    if (!TABS.includes(v as ArchiveSideTab)) return;
    const next = v as ArchiveSideTab;
    setTab(next);
    setSeen((prev) => (prev.has(next) ? prev : new Set(prev).add(next)));
  };

  return (
    // Tabs 루트가 이미 `flex flex-col gap-2` 다 — 바깥에 래퍼를 하나 더 두면 감춘 패널에도
    // 여백이 붙는 space-y 문제가 되살아난다(코덱스 리뷰 2R)
    <Tabs value={tab} onValueChange={changeTab}>
      <TabsList className="w-full">
        <TabsTrigger value="units">교과서</TabsTrigger>
        <TabsTrigger value="schools">학교 기출</TabsTrigger>
        <TabsTrigger value="works">작품</TabsTrigger>
        <TabsTrigger value="grammar">문법</TabsTrigger>
      </TabsList>

      {/* ⚠️ 패널은 **Tabs 안의 `TabsContent`** 여야 한다(코덱스 리뷰 3R). 밖에 두면 탭과
          패널이 ARIA 로 이어지지 않아, 스크린리더에서 이 탭이 무엇을 여는지 알 수 없다.
          ⚠️ 그래서 **네 칸은 언제나 그린다**(4R) — `seen` 으로 칸 자체를 빼면 아직 안 연
          탭에는 이어 줄 패널이 없어 `aria-controls` 가 안 생긴다. 미루는 것은 **안쪽 트리**다.
          ⚠️ `keepMounted` 로 **언마운트를 막는다**(1R): 패널마다 '방금 누른 잎'(picked)을
          지역 state 로 들고 있어서, 언마운트하면 탭을 다녀온 것만으로 **고른 폴더의 강조가
          사라진다** — 목록은 그대로인데 어디를 눌러 이 목록이 됐는지 알 수 없어진다.
          교과서 탭은 카테고리 조회까지 다시 한다. 감춘 패널은 base-ui 가 `hidden` 으로
          둬서 접근성 트리·탭 순서에서 빠진다 */}
      <TabsContent value="units" keepMounted>
        {seen.has('units') && <UnitTreePanel filters={filters} onChange={onChange} />}
      </TabsContent>
      <TabsContent value="schools" keepMounted>
        {seen.has('schools') && (
          <SchoolExamTreePanel filters={filters} tuples={schoolExams} onChange={onChange} />
        )}
      </TabsContent>
      <TabsContent value="works" keepMounted>
        {seen.has('works') && (
          <WorkTreePanel filters={filters} works={works} onChange={onChange} />
        )}
      </TabsContent>
      <TabsContent value="grammar" keepMounted>
        {seen.has('grammar') && (
          <GrammarTreePanel filters={filters} counts={grammarCounts} onChange={onChange} />
        )}
      </TabsContent>
    </Tabs>
  );
}
