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
  /** 학기 ('1학기'·'2학기'). '' 는 전체 */
  semester: string;
  exam_type: string;
  /** 교과서(= 출처의 textbook) */
  textbook: string;
  area_path: string[];
  /** 교과서 단원 이름 경로 [대단원, 소단원] */
  unit_path: string[];
  search: string;
  verifiedOnly: boolean;
  page: number;
}

export const EMPTY_FILTERS: ProblemFilters = {
  source_type: '', school_name: '', year: '', grade: '', semester: '', exam_type: '', textbook: '',
  area_path: [], unit_path: [], search: '', verifiedOnly: false, page: 0,
};

/** 영역 경로를 주소에 실을 때 쓰는 구분자 — 이름에 들어갈 일이 없는 글자 */
const AREA_SEPARATOR = '>';

/**
 * '미지정인 것만' 을 뜻하는 값.
 *
 * ⚠️ 빈 문자열은 이 필터에서 **'전체'** 다(조건을 만들지 않는다). 그래서 저장값이 실제로
 *    `''` 인 행만 고르려면 따로 표시할 값이 필요하다 — 없으면 학교 기출 트리의
 *    '미지정' 갈래가 그 축 **전체**를 불러온다(코덱스 리뷰 2R).
 *    ⚠️ **자유 텍스트 축(학교·교과서)에는 쓰지 않는다.** 저장값이 우연히 `'__none__'` 인
 *    학교가 있으면 그 학교 대신 '이름 없는 출처' 를 찾게 된다. 선택지가 정해진 축
 *    (학년도·학년·학기·시험)에서만 쓴다.
 */
export const UNSPECIFIED_AXIS = '__none__';

/**
 * 값이 있는 조건만 남긴다.
 * @param key - 조회 조건 이름
 * @param value - 필터 값
 * @param allowUnspecified - '미지정만'(빈 값인 행만)을 고를 수 있는 축인지
 * @returns 조건 한 칸, 또는 빈 객체
 */
function axisEntry<K extends string>(
  key: K,
  value: string,
  allowUnspecified = false,
): Partial<Record<K, string>> {
  if (!value) return {};
  // '' 도 '미지정만' 이라는 뜻이라 살려야 한다 — queries.ts 가 undefined 로만 유무를 가른다
  const query = allowUnspecified && value === UNSPECIFIED_AXIS ? '' : value;
  return { [key]: query } as Partial<Record<K, string>>;
}

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
  if (filters.semester) params.set('sem', filters.semester);
  if (filters.exam_type) params.set('exam', filters.exam_type);
  if (filters.textbook) params.set('book', filters.textbook);
  if (filters.area_path.length > 0) params.set('area', filters.area_path.join(AREA_SEPARATOR));
  if (filters.unit_path.length > 0) params.set('unit', filters.unit_path.join(AREA_SEPARATOR));
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
  const unit = params.get('unit') ?? '';
  return {
    source_type: params.get('type') ?? '',
    school_name: params.get('school') ?? '',
    year: params.get('year') ?? '',
    grade: params.get('grade') ?? '',
    semester: params.get('sem') ?? '',
    exam_type: params.get('exam') ?? '',
    textbook: params.get('book') ?? '',
    area_path: area ? area.split(AREA_SEPARATOR).filter(Boolean) : [],
    unit_path: unit ? unit.split(AREA_SEPARATOR).filter(Boolean) : [],
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
    ...axisEntry('source_type', filters.source_type),
    ...axisEntry('school_name', filters.school_name),
    // 선택지가 정해진 축만 '미지정만' 을 받는다(자유 텍스트는 값과 겹칠 수 있다)
    ...axisEntry('year', filters.year, true),
    ...axisEntry('grade', filters.grade, true),
    ...axisEntry('semester', filters.semester, true),
    ...axisEntry('exam_type', filters.exam_type, true),
    ...axisEntry('textbook', filters.textbook),
    ...(filters.area_path.length > 0 ? { area_path: filters.area_path } : {}),
    ...(filters.unit_path.length > 0 ? { unit_path: filters.unit_path } : {}),
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
    || filters.semester || filters.exam_type || filters.textbook || filters.area_path.length > 0
    || filters.unit_path.length > 0 || filters.search || filters.verifiedOnly,
  );
}
