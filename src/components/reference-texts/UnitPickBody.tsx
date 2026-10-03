'use client';

import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import CategoryTree from '@/components/words/CategoryTree';
import { Input } from '@/components/ui/input';
import { buildCategoryTree } from '@/lib/category-tree';
import { formatCategoryLabel } from '@/lib/format';
import { REFERENCE_UNITS_MAX } from '@/lib/reference-texts/constants';
import { toggleReferenceUnit, unitFromCategory, unitKey } from '@/lib/reference-texts/units';
import type { Category } from '@/types';
import type { ReferenceUnit } from '@/types/reference-text';

interface UnitPickBodyProps {
  /** 고를 수 있는 카테고리 (중등·고등만). null 이면 아직 읽는 중 */
  categories: Category[] | null;
  /** 카테고리를 못 읽었는가 */
  failed: boolean;
  /** 다시 읽기 */
  onRetry: () => void;
  /** 지금 붙은 단원들 */
  value: ReferenceUnit[];
  onChange: (units: ReferenceUnit[]) => void;
}

/**
 * 교과서 단원 고르기의 **속** — 검색칸과 카테고리 트리(체크 모드).
 *
 * 개념지·단어와 **같은 카테고리 트리**를 쓴다(학년 › 교과서 › 학기 › 대단원 › 소단원) — 선생님이
 * 이미 아는 구조다. 이미 붙은 단원은 **체크된 채로** 보이고, 누르면 붙이고 다시 누르면 뗀다.
 * 창을 닫지 않고 여러 교과서의 단원을 이어서 붙인다(같은 작품이 여러 교과서에 실린다).
 *
 * 껍데기(시트)와 가른 까닭: 포털로 뜨는 시트는 테스트 환경에서 열어 볼 수 없어서, 고르는
 * 규칙은 이 본체로 시험한다.
 * @param props - 카테고리·붙은 단원·바뀐 목록 콜백
 * @returns 검색칸과 트리
 */
export default function UnitPickBody({
  categories, failed, onRetry, value, onChange,
}: UnitPickBodyProps) {
  const [query, setQuery] = useState('');
  /** 상한에 막혔는가 — 막힌 그 자리에서 알린다(토스트는 시트 뒤에 가려진다) */
  const [full, setFull] = useState(false);

  const keyword = query.trim().toLowerCase();
  const filtered = useMemo(
    () => (categories ?? []).filter(
      (c) => !keyword || formatCategoryLabel(c).toLowerCase().includes(keyword),
    ),
    [categories, keyword],
  );
  const tree = useMemo(() => buildCategoryTree(filtered), [filtered]);

  // 붙은 단원과 같은 카테고리를 체크해 보여 준다 — 개념지처럼 이름으로 대조한다
  const pickedKeys = useMemo(() => new Set(value.map(unitKey)), [value]);
  const checkedIds = useMemo(
    () => (categories ?? [])
      .filter((c) => pickedKeys.has(unitKey(unitFromCategory(c))))
      .map((c) => c.id),
    [categories, pickedKeys],
  );

  const toggle = (categoryId: string) => {
    const category = categories?.find((c) => c.id === categoryId);
    // 대단원이 없는 카테고리는 단원이 아니다(교과서만 등록된 자리)
    if (!category || !category.chapter) return;
    const next = toggleReferenceUnit(value, unitFromCategory(category));
    setFull(next === null);
    if (next) onChange(next);
  };

  if (failed) {
    return (
      <div className="space-y-2 px-4 py-6 text-center">
        <p className="text-sm text-red-600">카테고리를 불러오지 못했어요.</p>
        <button type="button" onClick={onRetry} className="text-sm text-primary underline underline-offset-2">
          다시 불러오기
        </button>
      </div>
    );
  }
  if (!categories) {
    return <p className="px-4 py-6 text-center text-sm text-gray-400">카테고리를 불러오는 중…</p>;
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="px-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="교과서·단원 이름"
            aria-label="단원 검색"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-9 pl-9 text-sm"
          />
        </div>
        <p className={`mt-1 text-xs ${full ? 'font-medium text-red-600' : 'text-gray-500'}`}>
          {full
            ? `단원은 ${REFERENCE_UNITS_MAX}개까지 붙일 수 있어요. 하나를 빼고 다시 고르세요.`
            : `붙인 단원 ${value.length} / ${REFERENCE_UNITS_MAX} — 누르면 붙이고, 다시 누르면 뺍니다.`}
        </p>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
        {/* 검색 중에는 트리를 펼쳐 둔다 — 기본 접힘이라 맞은 단원이 아래 단계에 숨는다(개념지와 같다) */}
        <CategoryTree
          nodes={tree}
          multiSelect
          selectedIds={checkedIds}
          onToggle={toggle}
          forceExpanded={keyword !== ''}
        />
      </div>
    </div>
  );
}
