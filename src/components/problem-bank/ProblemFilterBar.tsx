'use client';

import { Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { OptionSelect, type SelectOption } from '@/components/ui/option-select';
import type { SourceFacets, WorkFacet } from '@/lib/problem-bank/facets';
import { buildFilterAxes } from '@/lib/problem-bank/filter-axes';
import { grammarSelectOptions } from '@/lib/problem-bank/grammar-browse-tree';
import { hasActiveFilters, type ProblemFilters } from '@/lib/problem-bank/filters';

/** 문법 선택지는 마스터라 안 바뀐다 — 렌더마다 새로 만들 것 없다 */
const MASTER_GRAMMAR_OPTIONS = grammarSelectOptions();

interface ProblemFilterBarProps {
  filters: ProblemFilters;
  facets: SourceFacets;
  areaFacets: string[][];
  unitFacets: string[][];
  /** 문법 선택지. 기본은 마스터 전체다 — 테스트에서만 갈아 끼운다 */
  grammarOptions?: SelectOption[];
  workFacets: WorkFacet[];
  total: number;
  onChange: (patch: Partial<ProblemFilters>) => void;
  onReset: () => void;
}

/**
 * 아카이브 필터 줄.
 *
 * 어떤 칸을 보일지·'전체'와 '미지정'을 어떻게 둘지는 전부
 * [filter-axes.ts](../../lib/problem-bank/filter-axes.ts) 가 정한다 — 여기서는 그리기만 한다.
 *
 * 영역·단원·작품은 실제로 **아카이브에 쓰인 값**으로만 고른다(마스터 전체를 보여 주면
 * 문항이 하나도 없는 항목이 잔뜩 나온다). **문법만 마스터 기반**이고 그 까닭은
 * [grammar-browse-tree.ts](../../lib/problem-bank/grammar-browse-tree.ts) 에 적어 두었다.
 */
export default function ProblemFilterBar({
  filters, facets, areaFacets, unitFacets, grammarOptions = MASTER_GRAMMAR_OPTIONS,
  workFacets, total, onChange, onReset,
}: ProblemFilterBarProps) {
  const axes = buildFilterAxes({ filters, facets, areaFacets, unitFacets, workFacets, grammarOptions });

  return (
    <div className="space-y-3 rounded-lg border border-gray-200 p-4">
      <div className="flex flex-wrap gap-2">
        {axes.map((axis) => (
          <OptionSelect
            key={axis.key}
            value={axis.value}
            options={axis.options}
            placeholder={axis.label}
            ariaLabel={axis.label}
            className={`h-9 ${axis.widthClass} text-sm`}
            onChange={(v) => onChange(axis.toPatch(v))}
          />
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-52">
          <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            value={filters.search}
            onChange={(e) => onChange({ search: e.target.value, page: 0 })}
            placeholder="발문 · 선지 · 작품명 검색"
            className="h-9 pl-8 text-sm"
          />
        </div>

        <label className="flex items-center gap-1.5 text-sm text-gray-600">
          <input
            type="checkbox"
            checked={filters.verifiedOnly}
            onChange={(e) => onChange({ verifiedOnly: e.target.checked, page: 0 })}
            className="h-4 w-4 accent-[color:var(--primary)]"
          />
          검수한 것만
        </label>

        {hasActiveFilters(filters) && (
          <Button type="button" variant="outline" size="sm" onClick={onReset}>
            <X className="h-3.5 w-3.5" />
            <span className="ml-1">조건 지우기</span>
          </Button>
        )}

        <span className="ml-auto text-sm text-gray-500">{total}개</span>
      </div>
    </div>
  );
}
