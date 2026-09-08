'use client';

import { useMemo, useState } from 'react';
import FacetTree from '@/components/problem-bank/FacetTree';
import type { WorkFacet } from '@/lib/problem-bank/facets';
import type { ProblemFilters } from '@/lib/problem-bank/filters';
import { buildWorkTree, workFilterPatch, workKey, WORK_AXIS_CLEARED } from '@/lib/problem-bank/work-tree';

interface WorkTreePanelProps {
  filters: ProblemFilters;
  /** 아카이브에 실제로 태깅된 작품들 */
  works: WorkFacet[];
  onChange: (patch: Partial<ProblemFilters>) => void;
}

/**
 * 작품별로 훑어보는 왼쪽 트리.
 *
 * **지은이 › 작품** 순이다. 같은 「동백꽃」을 여러 학교가 내는데, 예전에는 학교별로만
 * 훑을 수 있어 한 작품의 기출을 모아 보려면 학교를 하나씩 돌아야 했다.
 *
 * ⚠️ 소설 전문이 실리는 일은 드물어서, 같은 작품이라도 학교마다 **실린 대목이 다르다.**
 *    그래서 이 조건으로 본 목록은 지문(발췌)별로 묶여 그려진다.
 */
export default function WorkTreePanel({ filters, works, onChange }: WorkTreePanelProps) {
  const nodes = useMemo(() => buildWorkTree(works), [works]);
  /**
   * 방금 누른 잎. 위쪽 필터를 따로 바꿨을 때 옛 잎이 켜진 채로 남지 않도록
   * **그때 건 조건**과 함께 들고 있는다(다른 두 트리와 같은 규약).
   */
  const [picked, setPicked] = useState<{ id: string; key: string } | null>(null);
  const selectedId = picked?.key === filters.work_title ? picked.id : undefined;

  const handleSelect = (facet: WorkFacet) => {
    setPicked({ id: workKey(facet), key: facet.title });
    onChange(workFilterPatch(facet));
  };

  return (
    <div className="rounded-lg border border-gray-200 p-2">
      <div className="flex items-center justify-between px-2 py-1">
        <p className="text-xs font-medium text-gray-500">작품</p>
        {filters.work_title && (
          <button
            type="button"
            className="text-xs text-primary underline underline-offset-2"
            onClick={() => onChange({ ...WORK_AXIS_CLEARED, page: 0 })}
          >
            해제
          </button>
        )}
      </div>
      <div className="max-h-[70vh] overflow-y-auto">
        <FacetTree
          nodes={nodes}
          onSelect={handleSelect}
          selectedId={selectedId}
          emptyText="작품명이 붙은 문항이 아직 없어요. 검수 화면에서 지문의 작품명을 적으면 여기 나와요."
        />
      </div>
    </div>
  );
}
