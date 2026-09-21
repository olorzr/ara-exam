'use client';

import { useMemo, useState } from 'react';
import { ArrowUpDown } from 'lucide-react';
import FacetTree from '@/components/problem-bank/FacetTree';
import { OptionSelect, type SelectOption } from '@/components/ui/option-select';
import type { WorkFacet } from '@/lib/problem-bank/facets';
import type { ProblemFilters } from '@/lib/problem-bank/filters';
import {
  buildWorkTree, isWorkTreeOrder, workFilterPatch, workKey,
  WORK_AXIS_CLEARED, type WorkTreeOrder,
} from '@/lib/problem-bank/work-tree';
import { readWorkTreeOrder, writeWorkTreeOrder } from '@/lib/problem-bank/work-tree-pref';

/** 정렬 선택지 — 값은 `WorkTreeOrder`, 이름은 선생님이 읽는 말 */
const ORDER_OPTIONS: SelectOption[] = [
  { value: 'author', label: '지은이순 (ㄱ~ㅎ)' },
  { value: 'title', label: '작품명순 (ㄱ~ㅎ)' },
];

interface WorkTreePanelProps {
  filters: ProblemFilters;
  /** 아카이브에 실제로 태깅된 작품들 */
  works: WorkFacet[];
  onChange: (patch: Partial<ProblemFilters>) => void;
}

/**
 * 작품별로 훑어보는 왼쪽 트리.
 *
 * **문학·비문학 › (지은이 ›) 작품** 순이다. 같은 「동백꽃」을 여러 학교가 내는데, 예전에는
 * 학교별로만 훑을 수 있어 한 작품의 기출을 모아 보려면 학교를 하나씩 돌아야 했다.
 * 갈래를 가르는 까닭은 비문학 지문도 제목이 인쇄돼 있으면 작품으로 올라오기 때문이다 —
 * 판정은 지문의 영역으로 한다(`work-counts.ts`).
 *
 * 정렬은 **지은이순·작품명순** 둘이고 브라우저에 남는다 — 매번 다시 고르게 하지 않는다.
 *
 * ⚠️ 소설 전문이 실리는 일은 드물어서, 같은 작품이라도 학교마다 **실린 대목이 다르다.**
 *    그래서 이 조건으로 본 목록은 지문(발췌)별로 묶여 그려진다.
 */
export default function WorkTreePanel({ filters, works, onChange }: WorkTreePanelProps) {
  /**
   * 정렬은 lazy 초기화로 읽는다 — 효과에서 setState 하면 `react-hooks/set-state-in-effect`
   * 에 걸리고, 이 앱은 로그인 게이트 때문에 페이지 내용이 서버에서 그려지지 않아
   * 수화가 어긋날 자리도 없다(`settings/ai/page.tsx` 의 포트 선택과 같은 모양).
   */
  const [order, setOrder] = useState<WorkTreeOrder>(() => readWorkTreeOrder());
  const nodes = useMemo(() => buildWorkTree(works, order), [works, order]);
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

  const handleOrder = (value: string) => {
    if (!isWorkTreeOrder(value)) return;
    setOrder(value);
    writeWorkTreeOrder(value);
  };

  return (
    <div className="rounded-lg border border-gray-200 p-2">
      <div className="flex items-center justify-between gap-2 px-2 py-1">
        <div className="flex items-center gap-2">
          <p className="text-xs font-medium text-gray-500">작품</p>
          <OptionSelect
            value={order}
            options={ORDER_OPTIONS}
            className="h-8 w-[128px] text-xs"
            ariaLabel="작품 트리 정렬"
            triggerIcon={<ArrowUpDown className="h-3 w-3 mr-1" />}
            onChange={handleOrder}
          />
        </div>
        {filters.work_title && (
          <button
            type="button"
            className="shrink-0 text-xs text-primary underline underline-offset-2"
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
