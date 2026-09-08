'use client';

import { Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SEMESTER_OPTIONS } from '@/lib/constants';
import { SOURCE_TYPE_OPTIONS, EXAM_TYPE_OPTIONS } from '@/lib/problem-bank/source-form';
import { areaPathLabel } from '@/lib/problem-bank/area-tree';
import type { SourceFacets, WorkFacet } from '@/lib/problem-bank/facets';
import { hasActiveFilters, UNSPECIFIED_AXIS, type ProblemFilters } from '@/lib/problem-bank/filters';
import { unitPathLabel } from '@/lib/problem-bank/unit-tree';

/** '전체'를 뜻하는 센티널 — base-ui Select 는 빈 문자열 value 를 싫어한다 */
const ALL = '__all__';

/**
 * '미지정만' 칸.
 *
 * 학교 기출 트리가 미지정 갈래를 고르면 필터에 `UNSPECIFIED_AXIS` 가 들어온다.
 * 여기에 같은 값의 칸이 없으면 셀렉트가 **아무것도 안 고른 것처럼 보여** 화면과
 * 실제 조건이 어긋난다. 겸사겸사 '학기 미지정인 기출만' 을 손으로도 고를 수 있다.
 */
function UnspecifiedItem() {
  return <SelectItem value={UNSPECIFIED_AXIS}>미지정</SelectItem>;
}

/**
 * 이 칸을 보여 줄지.
 *
 * ⚠️ 선택지 유무만 보면 **조건이 걸린 칸이 사라진다.** 예를 들어 모든 출처의 학기가
 *    비어 있으면 패싯 목록이 비는데, 학교 기출 트리에서 '미지정' 갈래를 고르면
 *    학기 조건은 살아 있다 — 칸이 없으면 그 조건을 볼 수도 끌 수도 없다(코덱스 리뷰 3R).
 * @param hasOptions - 고를 값이 하나라도 있는가
 * @param hasValue - 지금 이 축에 조건이 걸려 있는가
 * @returns 보여 줄지
 */
function showAxis(hasOptions: boolean, hasValue: boolean): boolean {
  return hasOptions || hasValue;
}

/**
 * 지금 걸린 값이 선택지에 없으면 칸을 하나 만들어 앞에 붙인다.
 *
 * ⚠️ 패싯은 **문항이 실제로 있는 값**만 모은다. 그래서 왼쪽 트리에서 아직 기출이 없는
 *    교과서·단원을 고르면 그 값이 목록에 없고, 셀렉트가 아무것도 안 고른 것처럼 보인다
 *    (조건은 걸려 있는데 화면은 '전체'라고 말하는 셈이다).
 * @param options - 패싯이 준 선택지
 * @param value - 지금 걸린 값
 * @param hasUnspecifiedItem - 이 칸에 '미지정' 칸이 따로 있는가. 없는 축에서는
 *   `'__none__'` 이 센티널이 아니라 **그런 이름의 교과서·학교**일 수 있다
 * @returns 걸린 값이 반드시 들어 있는 선택지
 */
function withValue(options: string[], value: string, hasUnspecifiedItem = false): string[] {
  if (!value || options.includes(value)) return options;
  if (hasUnspecifiedItem && value === UNSPECIFIED_AXIS) return options;
  return [value, ...options];
}

interface ProblemFilterBarProps {
  filters: ProblemFilters;
  facets: SourceFacets;
  areaFacets: string[][];
  unitFacets: string[][];
  workFacets: WorkFacet[];
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
  filters, facets, areaFacets, unitFacets, workFacets, total, onChange, onReset,
}: ProblemFilterBarProps) {
  const workTitles = workFacets.map((w) => w.title);
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
            {withValue(facets.schools, filters.school_name)
              .map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={filters.year || ALL} onValueChange={pick('year')}>
          <SelectTrigger className="h-9 w-28 text-sm"><SelectValue placeholder="학년도" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>학년도 전체</SelectItem>
            <UnspecifiedItem />
            {withValue(facets.years, filters.year, true)
              .map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={filters.grade || ALL} onValueChange={pick('grade')}>
          <SelectTrigger className="h-9 w-24 text-sm"><SelectValue placeholder="학년" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>학년 전체</SelectItem>
            <UnspecifiedItem />
            {withValue(facets.grades, filters.grade, true)
              .map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
          </SelectContent>
        </Select>

        {showAxis(facets.semesters.length > 0, Boolean(filters.semester)) && (
          <Select value={filters.semester || ALL} onValueChange={pick('semester')}>
            <SelectTrigger className="h-9 w-24 text-sm"><SelectValue placeholder="학기" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>학기 전체</SelectItem>
              <UnspecifiedItem />
              {SEMESTER_OPTIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        )}

        <Select value={filters.exam_type || ALL} onValueChange={pick('exam_type')}>
          <SelectTrigger className="h-9 w-24 text-sm"><SelectValue placeholder="시험" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>시험 전체</SelectItem>
            <UnspecifiedItem />
            {EXAM_TYPE_OPTIONS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>

        {showAxis(facets.textbooks.length > 0, Boolean(filters.textbook)) && (
          <Select value={filters.textbook || ALL} onValueChange={pick('textbook')}>
            <SelectTrigger className="h-9 w-40 text-sm"><SelectValue placeholder="교과서" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>교과서 전체</SelectItem>
              {withValue(facets.textbooks, filters.textbook)
                .map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        )}

        {showAxis(unitFacets.length > 0, filters.unit_path.length > 0) && (
          <Select
            value={filters.unit_path.length > 0 ? filters.unit_path.join('>') : ALL}
            onValueChange={(v) => {
              if (v) onChange({ unit_path: v === ALL ? [] : v.split('>'), page: 0 });
            }}
          >
            <SelectTrigger className="h-9 w-48 text-sm"><SelectValue placeholder="단원" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>단원 전체</SelectItem>
              {withValue(unitFacets.map((p) => p.join('>')), filters.unit_path.join('>'))
                .map((key) => (
                  <SelectItem key={key} value={key}>{unitPathLabel(key.split('>'))}</SelectItem>
                ))}
            </SelectContent>
          </Select>
        )}

        {showAxis(workFacets.length > 0, Boolean(filters.work_title)) && (
          <Select value={filters.work_title || ALL} onValueChange={pick('work_title')}>
            <SelectTrigger className="h-9 w-40 text-sm"><SelectValue placeholder="작품" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>작품 전체</SelectItem>
              {withValue(workTitles, filters.work_title)
                .map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        )}

        {showAxis(areaFacets.length > 0, filters.area_path.length > 0) && (
          <Select
            value={filters.area_path.length > 0 ? filters.area_path.join('>') : ALL}
            onValueChange={(v) => {
              if (v) onChange({ area_path: v === ALL ? [] : v.split('>'), page: 0 });
            }}
          >
            <SelectTrigger className="h-9 w-44 text-sm"><SelectValue placeholder="영역" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>영역 전체</SelectItem>
              {withValue(areaFacets.map((p) => p.join('>')), filters.area_path.join('>'))
                .map((key) => (
                  <SelectItem key={key} value={key}>{areaPathLabel(key.split('>'))}</SelectItem>
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
