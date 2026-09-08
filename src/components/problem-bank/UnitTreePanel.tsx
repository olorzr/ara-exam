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
 * ⚠️ 학기는 필터 축이 아니다. 저장되는 것은 **단원 이름**이라, 1·2학기에 같은 이름의
 *    대단원이 있으면 두 폴더가 같은 결과를 낸다(교과서 안에서 단원 이름은 보통 유일하다).
 *    그래서 '어디를 눌렀는가'는 필터에서 되짚지 않고 눌린 잎을 그대로 기억한다.
 */
export default function UnitTreePanel({ filters, onChange }: UnitTreePanelProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  /** 방금 누른 잎 — 표시용이다(필터에서 되짚으면 같은 이름의 다른 학기를 켤 수 있다) */
  const [pickedId, setPickedId] = useState<string | undefined>(undefined);

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

  // 필터에서 단원이 빠지면(조건 지우기·해제) 표시도 함께 지운다
  const selectedId = filters.unit_path.length > 0 ? pickedId : undefined;

  if (nodes.length === 0) return null;

  const handleSelect = (category: Category) => {
    setPickedId(category.id);
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
