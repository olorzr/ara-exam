'use client';

import { useEffect, useMemo, useState } from 'react';
import CategoryTree from '@/components/words/CategoryTree';
import { buildCategoryTree } from '@/lib/category-tree';
import { getAllSelectableCategories } from '@/lib/category-master';
import { EXTERNAL_LEVEL } from '@/lib/constants';
import type { ProblemFilters } from '@/lib/problem-bank/filters';
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
 */
export default function UnitTreePanel({ filters, onChange }: UnitTreePanelProps) {
  const [categories, setCategories] = useState<Category[]>([]);

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

  /** 지금 필터와 맞는 잎 — 트리에서 어디를 보고 있는지 표시한다 */
  const selectedId = useMemo(() => {
    if (filters.unit_path.length === 0) return undefined;
    const [chapter, subChapter = ''] = filters.unit_path;
    return categories.find((c) => (
      c.grade === filters.grade
      && c.publisher === filters.textbook
      && c.chapter === chapter
      && c.sub_chapter === subChapter
    ))?.id;
  }, [categories, filters.grade, filters.textbook, filters.unit_path]);

  if (nodes.length === 0) return null;

  const handleSelect = (category: Category) => {
    onChange({
      grade: category.grade,
      textbook: category.publisher,
      // 소단원이 없는 '(전체)' 잎은 대단원만 — 그 아래 문항이 모두 걸린다
      unit_path: category.sub_chapter
        ? [category.chapter, category.sub_chapter]
        : [category.chapter],
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
