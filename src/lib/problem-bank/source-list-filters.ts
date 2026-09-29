import type { SelectOption } from '@/components/ui/option-select';
import type { SourceFacets } from './facets';
import { buildFilterAxes, type FilterAxis } from './filter-axes';
import {
  EMPTY_FILTERS, filtersFromParams, filtersToQueryString, toProblemQuery, type ProblemFilters,
} from './filters';
import { SOURCE_EQ_AXES, type SourceAxisQuery } from './queries';

/**
 * '올라간 기출' 목록(`/problems/sources`)의 필터 (순수 함수).
 *
 * ⚠️ **칸 규칙을 새로 적지 않는다.** '전체'·'미지정' 센티널, 학교급이 학교·학년을 좁히고
 *    비우는 규칙, 유형이 모의고사면 '시험' 칸이 회차가 되는 규칙은 전부 아카이브 필터
 *    ([filter-axes.ts](./filter-axes.ts))에 있다. 여기서는 아카이브 필터 모양으로 바꿔
 *    그 함수를 부르고, 출처 칸만 골라 쓴다 — 두 화면이 같은 조건에 다른 목록을 내면 안 된다.
 * 주소 키도 아카이브와 같다(`school`·`year`·`q` …). 제목 검색이 아카이브의 `q` 자리다.
 */

/** 출처 목록이 쓰는 칸 — 그릴 차례이기도 하다 */
export const SOURCE_FILTER_AXES = [
  'source_type', 'school_level', 'school_name', 'year', 'grade', 'semester', 'exam_type', 'textbook',
] as const;

/** 출처 목록 칸 이름 */
export type SourceFilterAxisKey = (typeof SOURCE_FILTER_AXES)[number];

/** 늘어놓는 차례 */
export type SourceSort = 'recent' | 'exam';

/** 차례 드롭다운 */
export const SOURCE_SORT_OPTIONS: SelectOption[] = [
  { value: 'recent', label: '최근 올린 순' },
  { value: 'exam', label: '학년도·학교 순' },
];

/** 화면이 들고 있는 필터 */
export type SourceListFilters = Pick<ProblemFilters, SourceFilterAxisKey> & {
  /** 제목 검색 */
  title: string;
  sort: SourceSort;
};

/** 조회 조건 */
export interface SourceListQuery extends SourceAxisQuery {
  title?: string;
  sort: SourceSort;
}

/** 필터 칸 하나 — 고른 값을 이 목록의 필터 패치로 바꾼다 */
export type SourceFilterAxis = Omit<FilterAxis, 'toPatch'> & {
  toPatch: (value: string) => Partial<SourceListFilters>;
};

/** 아무 조건 없는 필터 */
export const EMPTY_SOURCE_LIST_FILTERS: SourceListFilters = {
  source_type: '', school_level: '', school_name: '', year: '', grade: '',
  semester: '', exam_type: '', textbook: '', title: '', sort: 'recent',
};

const AXIS_KEYS = new Set<string>(SOURCE_FILTER_AXES);

/** 출처 칸만 골라낸다 (다른 키는 버린다) */
function pickAxes(from: Partial<ProblemFilters>): Partial<SourceListFilters> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(from)) {
    if (AXIS_KEYS.has(key)) out[key] = value;
  }
  return out as Partial<SourceListFilters>;
}

/** 아카이브 필터 모양으로 — 칸 규칙·주소 규칙을 그대로 빌려 쓰려고 */
function asArchiveFilters(filters: SourceListFilters): ProblemFilters {
  return { ...EMPTY_FILTERS, ...pickAxes(filters), search: filters.title };
}

/**
 * 주소의 차례 값을 읽는다. 모르는 값은 기본(최근 올린 순)이다.
 * @param value - 주소의 `sort` 값
 * @returns 차례
 */
export function parseSourceSort(value: string | null): SourceSort {
  return value === 'exam' ? 'exam' : 'recent';
}

/**
 * 주소 쿼리에서 필터를 복원한다.
 * @param params - URLSearchParams
 * @returns 필터 (아카이브 전용 키는 무시한다)
 */
export function sourceListFiltersFromParams(params: URLSearchParams): SourceListFilters {
  const archive = filtersFromParams(params);
  return {
    ...EMPTY_SOURCE_LIST_FILTERS,
    ...pickAxes(archive),
    title: archive.search,
    sort: parseSourceSort(params.get('sort')),
  };
}

/**
 * 필터를 주소 쿼리 문자열로. 기본 차례는 싣지 않는다.
 * @param filters - 화면 필터
 * @returns '?school=…&q=…' (조건이 없으면 빈 문자열)
 */
export function sourceListFiltersToQueryString(filters: SourceListFilters): string {
  const base = filtersToQueryString(asArchiveFilters(filters));
  if (filters.sort === 'recent') return base;
  const params = new URLSearchParams(base.slice(1));
  params.set('sort', filters.sort);
  return `?${params.toString()}`;
}

/**
 * 필터를 조회 조건으로 바꾼다 — '미지정만'·학교급 펴기는 `toProblemQuery` 가 한다.
 * @param filters - 화면 필터
 * @returns 조회 조건 (걸리지 않은 칸은 키가 없다)
 */
export function toSourceListQuery(filters: SourceListFilters): SourceListQuery {
  const archive = toProblemQuery({ ...EMPTY_FILTERS, ...pickAxes(filters) });
  const out: SourceListQuery = { sort: filters.sort };
  for (const key of SOURCE_EQ_AXES) {
    if (archive[key] !== undefined) out[key] = archive[key];
  }
  if (archive.grades) out.grades = archive.grades;
  const title = filters.title.trim();
  if (title) out.title = title;
  return out;
}

/**
 * 고른 조건이 하나라도 있는가 — '조건 지우기' 단추를 보일지. 차례는 조건이 아니다.
 * @param filters - 화면 필터
 * @returns 조건이 있으면 true
 */
export function hasActiveSourceFilters(filters: SourceListFilters): boolean {
  return Boolean(filters.title.trim()) || SOURCE_FILTER_AXES.some((key) => Boolean(filters[key]));
}

/**
 * 필터 줄에 그릴 칸들 — 아카이브 규칙을 그대로 쓰고 출처 칸만 남긴다.
 * @param filters - 지금 필터
 * @param facets - 출처에서 모은 선택지
 * @returns 그릴 차례대로의 칸
 */
export function buildSourceAxes(filters: SourceListFilters, facets: SourceFacets): SourceFilterAxis[] {
  const axes = buildFilterAxes({
    filters: asArchiveFilters(filters),
    facets,
    // 출처 목록에는 문항 칸이 없다 — 문항 선택지를 읽지 않는다
    areaFacets: [], unitFacets: [], workFacets: [], grammarOptions: [],
  });
  return axes
    .filter((axis) => AXIS_KEYS.has(axis.key))
    .map((axis) => ({ ...axis, toPatch: (value: string) => pickAxes(axis.toPatch(value)) }));
}
