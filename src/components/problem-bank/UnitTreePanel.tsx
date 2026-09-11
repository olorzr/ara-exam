'use client';

import { useEffect, useMemo, useState } from 'react';
import CategoryTree from '@/components/words/CategoryTree';
import { buildCategoryTree } from '@/lib/category-tree';
import { getAllSelectableCategories } from '@/lib/category-master';
import { EXTERNAL_LEVEL } from '@/lib/constants';
import { GRAMMAR_AXIS_CLEARED, type ProblemFilters } from '@/lib/problem-bank/filters';
import { SCHOOL_AXES_CLEARED } from '@/lib/problem-bank/school-exam-tree';
import { WORK_AXIS_CLEARED } from '@/lib/problem-bank/work-tree';
import type { Category } from '@/types';

interface UnitTreePanelProps {
  filters: ProblemFilters;
  onChange: (patch: Partial<ProblemFilters>) => void;
}

/**
 * 교과서별 단원별로 훑어보는 왼쪽 트리.
 *
 * 카테고리 관리(중등/고등)의 **학년 › 교과서 › 학기 › 대단원 › 소단원** 폴더를 그대로 쓴다 —
 * 단어지·개념지와 같은 트리라 선생님이 이미 아는 구조다. 잎을 고르면 학년·교과서·단원을
 * 한 번에 필터에 넣는다.
 *
 * 소단원이 없는 '(전체)' 잎은 대단원만 넣는다 — 배열 포함 검색이라 그 아래 소단원 문항까지
 * 함께 걸린다.
 *
 * ⚠️ 외부지문·프린트 폴더는 뺀다(교과서 단원이 없다).
 * ⚠️ 트리를 못 읽어도 아무것도 그리지 않을 뿐이다 — 위쪽 필터로 계속 찾을 수 있다.
 * ⚠️ **이 트리는 학기를 걸지 않는다.** `ProblemFilters` 에 학기 축은 생겼지만(학교 기출
 *    트리가 쓴다), 여기서 저장되는 것은 단원 **이름**이고 학기는 출처 행에 있다.
 *    1·2학기에 같은 이름의 대단원이 등록된 경우가 실제로 있어(2026-09-08 운영 데이터
 *    2건, 미래엔(신유식) 중2) 두 폴더가 같은 결과를 낸다 — 같은 단원을 두 학기에
 *    걸쳐 등록한 것이라 결과가 같은 편이 맞다.
 */
export default function UnitTreePanel({ filters, onChange }: UnitTreePanelProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  /**
   * 방금 누른 잎과 **그때 건 조건**.
   * 필터에서 되짚지 않는 이유는 같은 이름의 단원이 두 학기에 있을 수 있어서고,
   * 조건을 함께 들고 있는 이유는 위쪽 필터를 따로 바꿨을 때 옛 잎이 켜진 채로 남지
   * 않게 하기 위해서다(코덱스 리뷰 2R).
   */
  const [picked, setPicked] = useState<{ id: string; key: string } | null>(null);

  useEffect(() => {
    let alive = true;
    getAllSelectableCategories()
      .then((all) => {
        if (alive) setCategories(all.filter((c) => c.level !== EXTERNAL_LEVEL));
      })
      .catch(() => { if (alive) setCategories([]); });
    return () => { alive = false; };
  }, []);

  const nodes = useMemo(() => buildCategoryTree(categories), [categories]);

  // 지금 필터가 그때 건 조건 그대로일 때만 강조한다
  const filterKey = [filters.grade, filters.textbook, filters.unit_path.join('>')].join('|');
  const selectedId = picked?.key === filterKey ? picked.id : undefined;

  if (nodes.length === 0) return null;

  const handleSelect = (category: Category) => {
    const unitPath = category.sub_chapter
      ? [category.chapter, category.sub_chapter]
      : [category.chapter];
    setPicked({
      id: category.id,
      key: [category.grade, category.publisher, unitPath.join('>')].join('|'),
    });
    onChange({
      // 다른 트리에서 걸어 둔 조건은 비운다 — 세 트리는 탭으로 갈린 대안 경로라
      // 남겨 두면 '상현중 기출 ∩ 이 단원' 이 조용히 0건이 되고 화면에 이유가 안 보인다
      ...SCHOOL_AXES_CLEARED,
      ...WORK_AXIS_CLEARED,
      ...GRAMMAR_AXIS_CLEARED,
      grade: category.grade,
      textbook: category.publisher,
      // 소단원이 없는 '(전체)' 잎은 대단원만 — 그 아래 문항이 모두 걸린다
      unit_path: unitPath,
      page: 0,
    });
  };

  return (
    <div className="rounded-lg border border-gray-200 p-2">
      <div className="flex items-center justify-between px-2 py-1">
        <p className="text-xs font-medium text-gray-500">교과서 · 단원</p>
        {filters.unit_path.length > 0 && (
          <button
            type="button"
            className="text-xs text-primary underline underline-offset-2"
            onClick={() => onChange({ unit_path: [], page: 0 })}
          >
            해제
          </button>
        )}
      </div>
      <div className="max-h-[70vh] overflow-y-auto">
        <CategoryTree nodes={nodes} onSelect={handleSelect} selectedId={selectedId} />
      </div>
    </div>
  );
}
