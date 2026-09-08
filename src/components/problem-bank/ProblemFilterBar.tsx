'use client';

import { Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SOURCE_TYPE_OPTIONS, EXAM_TYPE_OPTIONS } from '@/lib/problem-bank/source-form';
import { areaPathLabel } from '@/lib/problem-bank/area-tree';
import { hasActiveFilters, type ProblemFilters } from '@/lib/problem-bank/filters';
import { unitPathLabel } from '@/lib/problem-bank/unit-tree';

/** '전체'를 뜻하는 센티널 — base-ui Select 는 빈 문자열 value 를 싫어한다 */
const ALL = '__all__';

interface ProblemFilterBarProps {
  filters: ProblemFilters;
  facets: { schools: string[]; years: string[]; grades: string[]; textbooks: string[] };
  areaFacets: string[][];
  unitFacets: string[][];
  total: number;
  onChange: (patch: Partial<ProblemFilters>) => void;
  onReset: () => void;
}

/**
 * 아카이브 필터 줄.
 *
 * 영역은 실제로 **아카이브에 쓰인 경로**로만 고른다 — 마스터 전체를 보여 주면
 * 문항이 하나도 없는 영역이 잔뜩 나온다.
 */
export default function ProblemFilterBar({
  filters, facets, areaFacets, unitFacets, total, onChange, onReset,
}: ProblemFilterBarProps) {
  // base-ui Select 의 onValueChange 는 `string | null` 을 준다(CLAUDE.md Known Issues)
  const pick = (key: keyof ProblemFilters) => (v: string | null) => {
    if (v) onChange({ [key]: v === ALL ? '' : v, page: 0 } as Partial<ProblemFilters>);
  };

  return (
    <div className="space-y-3 rounded-lg border border-gray-200 p-4">
      <div className="flex flex-wrap gap-2">
        <Select value={filters.source_type || ALL} onValueChange={pick('source_type')}>
          <SelectTrigger className="h-9 w-32 text-sm"><SelectValue placeholder="유형" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>유형 전체</SelectItem>
            {SOURCE_TYPE_OPTIONS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={filters.school_name || ALL} onValueChange={pick('school_name')}>
          <SelectTrigger className="h-9 w-36 text-sm"><SelectValue placeholder="학교" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>학교 전체</SelectItem>
            {facets.schools.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={filters.year || ALL} onValueChange={pick('year')}>
          <SelectTrigger className="h-9 w-28 text-sm"><SelectValue placeholder="학년도" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>학년도 전체</SelectItem>
            {facets.years.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={filters.grade || ALL} onValueChange={pick('grade')}>
          <SelectTrigger className="h-9 w-24 text-sm"><SelectValue placeholder="학년" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>학년 전체</SelectItem>
            {facets.grades.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={filters.exam_type || ALL} onValueChange={pick('exam_type')}>
          <SelectTrigger className="h-9 w-24 text-sm"><SelectValue placeholder="시험" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>시험 전체</SelectItem>
            {EXAM_TYPE_OPTIONS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>

        {facets.textbooks.length > 0 && (
          <Select value={filters.textbook || ALL} onValueChange={pick('textbook')}>
            <SelectTrigger className="h-9 w-40 text-sm"><SelectValue placeholder="교과서" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>교과서 전체</SelectItem>
              {facets.textbooks.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        )}

        {unitFacets.length > 0 && (
          <Select
            value={filters.unit_path.length > 0 ? filters.unit_path.join('>') : ALL}
            onValueChange={(v) => {
              if (v) onChange({ unit_path: v === ALL ? [] : v.split('>'), page: 0 });
            }}
          >
            <SelectTrigger className="h-9 w-48 text-sm"><SelectValue placeholder="단원" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>단원 전체</SelectItem>
              {unitFacets.map((path) => (
                <SelectItem key={path.join('>')} value={path.join('>')}>
                  {unitPathLabel(path)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {areaFacets.length > 0 && (
          <Select
            value={filters.area_path.length > 0 ? filters.area_path.join('>') : ALL}
            onValueChange={(v) => {
              if (v) onChange({ area_path: v === ALL ? [] : v.split('>'), page: 0 });
            }}
          >
            <SelectTrigger className="h-9 w-44 text-sm"><SelectValue placeholder="영역" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>영역 전체</SelectItem>
              {areaFacets.map((path) => (
                <SelectItem key={path.join('>')} value={path.join('>')}>
                  {areaPathLabel(path)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
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
