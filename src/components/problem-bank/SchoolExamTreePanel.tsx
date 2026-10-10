'use client';

import { useMemo, useState } from 'react';
import FacetTree from '@/components/problem-bank/FacetTree';
import type { ProblemFilters } from '@/lib/problem-bank/filters';
import {
  buildSchoolExamTree, MOCK_EXAM_SOURCE_TYPE, SCHOOL_AXES_CLEARED, schoolExamFilterPatch,
  schoolExamKey, type SchoolExamFacet,
} from '@/lib/problem-bank/school-exam-tree';

/**
 * 학교급(고등·중등·모의고사)만 펼쳐 두고 **학교부터는 접어 둔다**(2026-10-10 사용자 요청 —
 * "학교별까지만 보이고 나머진 접어 달라, 없애는 게 아니라"). 창비 업체 기출로 고교가 100곳 가까이
 * 되자 학교마다 학년도가 펼쳐져 목록이 끝없이 길어졌다. 학년도 단계는 그대로 있고 학교를 누르면 열린다.
 */
const SCHOOL_EXAM_EXPANDED_DEPTH = 1;

interface SchoolExamTreePanelProps {
  filters: ProblemFilters;
  /** 아카이브에 실제로 있는 기출 갈래 (학교 기출 + 모의고사) */
  tuples: SchoolExamFacet[];
  onChange: (patch: Partial<ProblemFilters>) => void;
}

/**
 * 기출별로 훑어보는 왼쪽 트리.
 *
 * 맨 위가 **고등 / 중등 / 모의고사·수능** 이다. 학교 기출은 그 아래 **학교 › 학년도 › 학년 ›
 * 학기·시험** — 선생님이 기출을 떠올리는 순서가 "상현중 작년 2학기 기말" 이기 때문이다.
 * 모의고사는 **학년도 › 회차**("2026학년도 수능"). 잎을 고르면 그 시험의 문항만 남는다.
 *
 * ⚠️ 문제집·프린트는 나오지 않는다 — 학교도 회차도 없어 같은 축으로 묶이지 않는다.
 *    그쪽은 위 필터 줄로 찾는다.
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
        <p className="text-xs font-medium text-gray-500">기출</p>
        {(filters.school_name || filters.source_type === MOCK_EXAM_SOURCE_TYPE) && (
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
          defaultExpandedDepth={SCHOOL_EXAM_EXPANDED_DEPTH}
          emptyText="읽어 둔 기출이 아직 없어요."
        />
      </div>
    </div>
  );
}
