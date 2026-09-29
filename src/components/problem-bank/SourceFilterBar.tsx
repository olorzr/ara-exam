'use client';

import { ArrowUpDown, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { OptionSelect } from '@/components/ui/option-select';
import type { SourceFacets } from '@/lib/problem-bank/facets';
import {
  buildSourceAxes, hasActiveSourceFilters, parseSourceSort, SOURCE_SORT_OPTIONS,
  type SourceListFilters,
} from '@/lib/problem-bank/source-list-filters';

interface SourceFilterBarProps {
  filters: SourceListFilters;
  facets: SourceFacets;
  total: number;
  onChange: (patch: Partial<SourceListFilters>) => void;
  onReset: () => void;
}

/**
 * '올라간 기출' 목록 위의 필터 줄 — 드롭다운으로 좁히고 제목으로 찾는다.
 *
 * 어떤 칸을 보일지·'전체' 와 '미지정' 을 어떻게 둘지는 아카이브와 같은 규칙이다
 * ([source-list-filters.ts](../../lib/problem-bank/source-list-filters.ts)). 여기서는 그리기만 한다.
 */
export default function SourceFilterBar({
  filters, facets, total, onChange, onReset,
}: SourceFilterBarProps) {
  const axes = buildSourceAxes(filters, facets);

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
        <div className="relative min-w-52 flex-1">
          <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            value={filters.title}
            onChange={(e) => onChange({ title: e.target.value })}
            placeholder="시험지 제목 검색"
            aria-label="시험지 제목 검색"
            className="h-9 pl-8 text-sm"
          />
        </div>

        <OptionSelect
          value={filters.sort}
          options={SOURCE_SORT_OPTIONS}
          ariaLabel="늘어놓는 차례"
          className="h-9 w-40 text-sm"
          triggerIcon={<ArrowUpDown className="h-3.5 w-3.5 text-gray-400" />}
          onChange={(v) => onChange({ sort: parseSourceSort(v) })}
        />

        {hasActiveSourceFilters(filters) && (
          <Button type="button" variant="outline" size="sm" onClick={onReset}>
            <X className="h-3.5 w-3.5" />
            <span className="ml-1">조건 지우기</span>
          </Button>
        )}

        <span className="ml-auto text-sm text-gray-500" aria-live="polite">시험지 {total}건</span>
      </div>
    </div>
  );
}
