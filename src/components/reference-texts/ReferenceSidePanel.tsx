'use client';

import { useState } from 'react';
import FacetTree from '@/components/problem-bank/FacetTree';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { FacetTreeNode } from '@/lib/problem-bank/school-exam-tree';
import type { ReferenceFacetRow } from '@/lib/reference-texts/facets';
import {
  ALL_REFERENCE_TEXTS, REFERENCE_SIDE_TABS, axisKey, tabForAxis,
  type ReferenceBrowseAxis, type ReferenceSideTab,
} from '@/lib/reference-texts/filters';
import BrowseTreeFrame from './BrowseTreeFrame';
import ReferenceWorkTreePanel from './ReferenceWorkTreePanel';

interface ReferenceSidePanelProps {
  axis: ReferenceBrowseAxis;
  /** 패싯 — 작품 트리는 정렬 선택이 패널 안에 있어 여기서 만든다 */
  rows: ReferenceFacetRow[];
  unitTree: FacetTreeNode<ReferenceBrowseAxis>[];
  grammarTree: FacetTreeNode<ReferenceBrowseAxis>[];
  onChange: (axis: ReferenceBrowseAxis) => void;
}

/** 값이 탭 이름인가 — base-ui 는 탭 값으로 아무 값이나(null 포함) 줄 수 있다 */
function isSideTab(value: unknown): value is ReferenceSideTab {
  return REFERENCE_SIDE_TABS.some((tab) => tab === value);
}

/**
 * 작품 전문 목록의 왼쪽 패널 — **교과서 · 단원 / 작품 / 문법** 으로 훑는다.
 *
 * 문제 은행 아카이브의 왼쪽 패널(`ArchiveSidePanel`)과 같은 모양·같은 규약이다:
 * - 패널은 **언제나 `TabsContent` 안에** 그린다 — 밖에 두면 탭과 패널이 ARIA 로 안 이어진다.
 * - `keepMounted` 로 감춘 패널도 남긴다(작품 정렬 선택이 탭을 다녀와도 그대로).
 * - 안쪽 트리는 **한 번이라도 연 탭만** 그린다(문법 트리는 마스터 전체라 무겁다).
 *
 * 다른 점: 강조할 잎은 지역 state 가 아니라 **축에서 바로 나온다**(`axisKey`) — 축이 잎의 값
 * 그대로라 되짚을 필요가 없다. 축은 한 번에 하나라 다른 탭의 잎을 누르면 앞의 축은 풀린다.
 * @param props - 지금 축, 트리 재료, 축 바꾸기
 * @returns 왼쪽 패널
 */
export default function ReferenceSidePanel({
  axis, rows, unitTree, grammarTree, onChange,
}: ReferenceSidePanelProps) {
  const [tab, setTab] = useState<ReferenceSideTab>(() => tabForAxis(axis));
  const [seen, setSeen] = useState<ReadonlySet<ReferenceSideTab>>(() => new Set([tab]));
  const selectedId = axisKey(axis);
  const clear = () => onChange(ALL_REFERENCE_TEXTS);

  const changeTab = (value: unknown) => {
    if (!isSideTab(value)) return;
    setTab(value);
    setSeen((prev) => (prev.has(value) ? prev : new Set(prev).add(value)));
  };

  return (
    <Tabs value={tab} onValueChange={changeTab}>
      <TabsList className="w-full">
        <TabsTrigger value="units">교과서 · 단원</TabsTrigger>
        <TabsTrigger value="works">작품</TabsTrigger>
        <TabsTrigger value="grammar">문법</TabsTrigger>
      </TabsList>

      <TabsContent value="units" keepMounted>
        {seen.has('units') && (
          <BrowseTreeFrame
            title="교과서 · 단원"
            active={axis.kind === 'unit' || axis.kind === 'unit-none'}
            onClear={clear}
          >
            <FacetTree
              nodes={unitTree}
              selectedId={selectedId}
              onSelect={onChange}
              emptyText="단원을 붙인 전문이 아직 없어요. 전문을 열어 '단원 고르기' 로 붙이면 여기 나와요."
            />
          </BrowseTreeFrame>
        )}
      </TabsContent>
      <TabsContent value="works" keepMounted>
        {seen.has('works') && <ReferenceWorkTreePanel axis={axis} rows={rows} onChange={onChange} />}
      </TabsContent>
      <TabsContent value="grammar" keepMounted>
        {seen.has('grammar') && (
          <BrowseTreeFrame
            title="문법 개념"
            active={axis.kind === 'grammar' || axis.kind === 'grammar-none'}
            onClear={clear}
          >
            {/* 마스터 전체라 첫 화면에 대분류만 펼친다(문제 은행 문법 트리와 같다) */}
            <FacetTree nodes={grammarTree} selectedId={selectedId} onSelect={onChange} defaultExpandedDepth={1} />
          </BrowseTreeFrame>
        )}
      </TabsContent>
    </Tabs>
  );
}
