import type { ProblemQuery } from './queries';

/**
 * 아카이브 필터 ↔ 주소 쿼리 변환 (순수 함수).
 *
 * 필터를 주소에 실어 두면 검수하다가 목록으로 돌아와도 조건이 남고,
 * 선생님끼리 링크를 그대로 주고받을 수 있다.
 */

/** 화면이 들고 있는 필터 */
export interface ProblemFilters {
  source_type: string;
  school_name: string;
  year: string;
  grade: string;
  exam_type: string;
  area_path: string[];
  search: string;
  verifiedOnly: boolean;
  page: number;
}

export const EMPTY_FILTERS: ProblemFilters = {
  source_type: '', school_name: '', year: '', grade: '', exam_type: '',
  area_path: [], search: '', verifiedOnly: false, page: 0,
};

/** 영역 경로를 주소에 실을 때 쓰는 구분자 — 이름에 들어갈 일이 없는 글자 */
const AREA_SEPARATOR = '>';

/**
 * 필터를 주소 쿼리 문자열로.
 * @param filters - 화면 필터
 * @returns '?school=상현중&year=2026' (빈 값은 싣지 않는다)
 */
export function filtersToQueryString(filters: ProblemFilters): string {
  const params = new URLSearchParams();
  if (filters.source_type) params.set('type', filters.source_type);
  if (filters.school_name) params.set('school', filters.school_name);
  if (filters.year) params.set('year', filters.year);
  if (filters.grade) params.set('grade', filters.grade);
  if (filters.exam_type) params.set('exam', filters.exam_type);
  if (filters.area_path.length > 0) params.set('area', filters.area_path.join(AREA_SEPARATOR));
  if (filters.search) params.set('q', filters.search);
  if (filters.verifiedOnly) params.set('verified', '1');
  if (filters.page > 0) params.set('page', String(filters.page + 1));
  const query = params.toString();
  return query ? `?${query}` : '';
}

/**
 * 주소 쿼리에서 필터를 복원한다.
 * @param params - URLSearchParams (또는 같은 인터페이스)
 * @returns 필터
 */
export function filtersFromParams(params: URLSearchParams): ProblemFilters {
  const rawPage = Number.parseInt(params.get('page') ?? '', 10);
  const area = params.get('area') ?? '';
  return {
    source_type: params.get('type') ?? '',
    school_name: params.get('school') ?? '',
    year: params.get('year') ?? '',
    grade: params.get('grade') ?? '',
    exam_type: params.get('exam') ?? '',
    area_path: area ? area.split(AREA_SEPARATOR).filter(Boolean) : [],
    search: params.get('q') ?? '',
    verifiedOnly: params.get('verified') === '1',
    // 주소는 사람이 읽는 1-based, 내부는 0-based
    page: Number.isFinite(rawPage) && rawPage > 1 ? rawPage - 1 : 0,
  };
}

/**
 * 필터를 조회 조건으로 바꾼다.
 * @param filters - 화면 필터
 * @returns 조회 조건 (빈 값은 빼서 불필요한 eq 를 만들지 않는다)
 */
export function toProblemQuery(filters: ProblemFilters): ProblemQuery {
  return {
    ...(filters.source_type ? { source_type: filters.source_type } : {}),
    ...(filters.school_name ? { school_name: filters.school_name } : {}),
    ...(filters.year ? { year: filters.year } : {}),
    ...(filters.grade ? { grade: filters.grade } : {}),
    ...(filters.exam_type ? { exam_type: filters.exam_type } : {}),
    ...(filters.area_path.length > 0 ? { area_path: filters.area_path } : {}),
    ...(filters.search.trim() ? { search: filters.search.trim() } : {}),
    ...(filters.verifiedOnly ? { verifiedOnly: true } : {}),
    page: filters.page,
  };
}

/**
 * 고른 조건이 하나라도 있는가 — '조건 지우기' 버튼을 보일지 정한다.
 * @param filters - 화면 필터
 * @returns 조건이 있으면 true
 */
export function hasActiveFilters(filters: ProblemFilters): boolean {
  return Boolean(
    filters.source_type || filters.school_name || filters.year || filters.grade
    || filters.exam_type || filters.area_path.length > 0 || filters.search || filters.verifiedOnly,
  );
}
