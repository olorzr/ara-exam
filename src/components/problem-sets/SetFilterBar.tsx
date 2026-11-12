'use client';

import { Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { OptionSelect, type SelectOption } from '@/components/ui/option-select';
import { ALL_AXIS } from '@/lib/problem-bank/filter-axes';
import {
  hasActiveSetFilters, SET_KIND_OPTIONS, toSetKind, type SourceSetFilters,
} from '@/lib/problem-bank/source-set-filters';

interface SetFilterBarProps {
  filters: SourceSetFilters;
  yearOptions: SelectOption[];
  /** 거른 뒤 남은 세트 수 */
  shown: number;
  onChange: (patch: Partial<SourceSetFilters>) => void;
  onReset: () => void;
}

/**
 * 세트 목록 위의 거르기 줄 — 구분 · 학년도 · 학교 이름. 모양은 '올라간 기출' 필터 줄(SourceFilterBar)과 같다.
 * '전체' 는 드롭다운이 빈 값을 못 보내 `ALL_AXIS` 로 오고 여기서 빈 값으로 바꾼다.
 */
export default function SetFilterBar({ filters, yearOptions, shown, onChange, onReset }: SetFilterBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-gray-200 p-4">
      <OptionSelect
        value={filters.kind || ALL_AXIS}
        options={SET_KIND_OPTIONS}
        ariaLabel="구분"
        className="h-9 w-36 text-sm"
        onChange={(v) => onChange({ kind: toSetKind(v) })}
      />
      <OptionSelect
        value={filters.year || ALL_AXIS}
        options={yearOptions}
        ariaLabel="학년도"
        className="h-9 w-32 text-sm"
        onChange={(v) => onChange({ year: v === ALL_AXIS ? '' : v })}
      />
      <div className="relative min-w-52 flex-1">
        <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <Input
          value={filters.q}
          onChange={(e) => onChange({ q: e.target.value })}
          placeholder="학교 이름으로 찾기"
          aria-label="학교 이름으로 찾기"
          className="h-9 pl-8 text-sm"
        />
      </div>
      {hasActiveSetFilters(filters) && (
        <Button type="button" variant="outline" size="sm" onClick={onReset}>
          <X className="h-3.5 w-3.5" />
          <span className="ml-1">조건 지우기</span>
        </Button>
      )}
      <span className="ml-auto text-sm text-gray-500" aria-live="polite">세트 {shown}장</span>
    </div>
  );
}
