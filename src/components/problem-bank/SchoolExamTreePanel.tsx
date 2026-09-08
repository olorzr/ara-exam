'use client';

import { useMemo, useState } from 'react';
import FacetTree from '@/components/problem-bank/FacetTree';
import type { ProblemFilters } from '@/lib/problem-bank/filters';
import {
  buildSchoolExamTree, SCHOOL_AXES_CLEARED, schoolExamFilterPatch,
  schoolExamKey, type SchoolExamFacet,
} from '@/lib/problem-bank/school-exam-tree';

interface SchoolExamTreePanelProps {
  filters: ProblemFilters;
  /** 아카이브에 실제로 있는 학교 기출 갈래 */
  tuples: SchoolExamFacet[];
  onChange: (patch: Partial<ProblemFilters>) => void;
}

/**
 * 학교 기출별로 훑어보는 왼쪽 트리.
 *
 * **학교 › 학년도 › 학년 › 학기·시험** 순이다 — 선생님이 기출을 떠올리는 순서가
 * "상현중 작년 2학기 기말" 이기 때문이다. 잎을 고르면 그 시험의 문항만 남는다.
 *
 * ⚠️ 트리에는 `내신기출` 출처만 나온다. 모의고사·문제집은 학교가 없거나(출판사가 대신 있다)
 *    학기·시험 구분이 의미가 없어 같은 축으로 묶이지 않는다 — 그쪽은 위 필터 줄로 찾는다.
 */
export default function SchoolExamTreePanel({
  filters, tuples, onChange,
}: SchoolExamTreePanelProps) {
  const nodes = useMemo(() => buildSchoolExamTree(tuples), [tuples]);
  /**
   * 방금 누른 잎과 **그때 건 조건**.
   * 교과서 트리와 같은 규약이다 — 위쪽 필터를 따로 바꿨을 때 옛 잎이 켜진 채로 남지 않는다.
   */
  const [picked, setPicked] = useState<{ id: string; key: string } | null>(null);

  const filterKey = JSON.stringify([
    filters.source_type, filters.school_name, filters.year,
    filters.grade, filters.semester, filters.exam_type,
  ]);
  const selectedId = picked?.key === filterKey ? picked.id : undefined;

  const handleSelect = (facet: SchoolExamFacet) => {
    // 강조 판정은 **실제로 걸 조건**과 같은 값으로 만든다 — 트리는 빈 값을
    // '미지정만' 으로 바꿔 싣기 때문에 원본 튜플로 비교하면 잎이 켜지지 않는다
    const patch = schoolExamFilterPatch(facet);
    setPicked({
      id: schoolExamKey(facet),
      key: JSON.stringify([
        patch.source_type, patch.school_name, patch.year,
        patch.grade, patch.semester, patch.exam_type,
      ]),
    });
    onChange(patch);
  };

  return (
    <div className="rounded-lg border border-gray-200 p-2">
      <div className="flex items-center justify-between px-2 py-1">
        <p className="text-xs font-medium text-gray-500">학교 · 기출</p>
        {filters.school_name && (
          <button
            type="button"
            className="text-xs text-primary underline underline-offset-2"
            onClick={() => onChange({ ...SCHOOL_AXES_CLEARED, page: 0 })}
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
          emptyText="읽어 둔 학교 기출이 아직 없어요."
        />
      </div>
    </div>
  );
}
