'use client';

import { useMemo, useState } from 'react';
import FacetTree from '@/components/problem-bank/FacetTree';
import WorkTreeOrderSelect from '@/components/problem-bank/WorkTreeOrderSelect';
import type { WorkTreeOrder } from '@/lib/problem-bank/work-tree';
import { readWorkTreeOrder } from '@/lib/problem-bank/work-tree-pref';
import { buildReferenceWorkTree } from '@/lib/reference-texts/browse-trees';
import type { ReferenceFacetRow } from '@/lib/reference-texts/facets';
import { ALL_REFERENCE_TEXTS, axisKey, type ReferenceBrowseAxis } from '@/lib/reference-texts/filters';
import BrowseTreeFrame from './BrowseTreeFrame';

interface ReferenceWorkTreePanelProps {
  axis: ReferenceBrowseAxis;
  rows: ReferenceFacetRow[];
  onChange: (axis: ReferenceBrowseAxis) => void;
}

/**
 * 작품 전문을 **작품별로** 훑는 트리 — 지은이 › 작품 (또는 작품명순 평면).
 *
 * 같은 작품의 판본이 여럿이면 잎 하나에 `(2)` 로 모이고, 누르면 판본들이 목록에 나란히 나온다
 * (판본 메모로 구분된다). 정렬은 문제 은행 작품 트리와 같은 선택을 함께 쓴다.
 * @param props - 지금 축, 패싯, 축 바꾸기
 * @returns 작품 트리 칸
 */
export default function ReferenceWorkTreePanel({ axis, rows, onChange }: ReferenceWorkTreePanelProps) {
  // lazy 초기화 — 효과에서 setState 하지 않는다(WorkTreePanel 과 같은 판단)
  const [order, setOrder] = useState<WorkTreeOrder>(() => readWorkTreeOrder());
  const nodes = useMemo(() => buildReferenceWorkTree(rows, order), [rows, order]);

  return (
    <BrowseTreeFrame
      title="작품"
      active={axis.kind === 'work'}
      onClear={() => onChange(ALL_REFERENCE_TEXTS)}
      toolbar={<WorkTreeOrderSelect value={order} onChange={setOrder} />}
    >
      <FacetTree
        nodes={nodes}
        selectedId={axisKey(axis)}
        onSelect={onChange}
        emptyText="올린 전문이 아직 없어요."
      />
    </BrowseTreeFrame>
  );
}
