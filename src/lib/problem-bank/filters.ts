import { grammarPathsUnder } from './grammar-tree';
import { QUESTION_KIND_TYPES, parseQuestionKind, type QuestionKindFilter } from './question-kind';
import { gradesForSchoolLevel, parseSchoolLevel, type SchoolLevelFilter } from './school-level';
import type { ProblemQuery } from './queries';
import { GRAMMAR_SOLO_PASSAGE_AREAS, soloApplies, soloAxisOf } from './solo-filter';

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
  /**
   * 학교급 — `''`(전체) · `'중등'` · `'고등'`.
   * ⚠️ 저장 컬럼이 없다. 그 학교급 학년 전부로 펴는 일은 `toProblemQuery` 가 한다(school-level.ts).
   */
  school_level: SchoolLevelFilter;
  grade: string;
  /** 학기 ('1학기'·'2학기'). '' 는 전체 */
  semester: string;
  exam_type: string;
  /** 교과서(= 출처의 textbook) */
  textbook: string;
  /**
   * 출처 제목 **같음** — 평가문제집 가지의 책(소단원 출처) 잎이 건다(sql/82, 주소 `src`).
   * 자유 텍스트라 '미지정만' 을 쓰지 않는다. 위쪽 필터 줄에는 칸이 없다(트리에서만 건다).
   */
  source_title: string;
  area_path: string[];
  /** 교과서 단원 이름 경로 [대단원, 소단원] */
  unit_path: string[];
  /**
   * 문법 분류에서 **고른 한 경로** (['단어','품사']).
   * ⚠️ 저장 컬럼(`grammar_paths`)은 경로를 여러 개 담지만, 필터는 한 번에 하나만 고른다 —
   *    고른 마디와 그 아래 경로 전부로 펴는 일은 `toProblemQuery` 가 한다.
   */
  grammar_path: string[];
  /**
   * 문항 갈래 — `''`(전체) · `'objective'` · `'subjective'`.
   * ⚠️ 값이 DB 의 `question_type` 이 **아니다**. 갈래는 둘이고 '서술형' 은 '주관식' 갈래에
   *    든다(`question-kind.ts`) — 저장값으로 펴는 일은 `toProblemQuery` 가 한다.
   */
  question_kind: QuestionKindFilter;
  /**
   * 작품명 **한 편**. 자유 텍스트라 '미지정만' 을 쓰지 않는다.
   * ⚠️ 축 이름은 단수 그대로지만 조회는 `problems.work_titles` 배열 포함이다(sql/33) —
   *    `(가)(나)` 를 함께 묻는 문항도 두 작품 어느 쪽으로 훑어도 나온다.
   */
  work_title: string;
  /**
   * '그 작품만 · 그 문법만' — 작품 축이면 그 작품 하나만 묻는 문항, 문법 축이면 문학·독서 지문에
   * 딸리지 않은 문항으로 좁힌다(solo-filter.ts). 축이 없으면 아무 조건도 만들지 않는다.
   * ⚠️ 트리의 축 바꾸기 패치(`*_AXES_CLEARED`)는 이 칸을 건드리지 않는다 — 켜 둔 채 작품을
   *    바꿔 가며 훑는 것이 보통이다. '조건 지우기'(`EMPTY_FILTERS`)만 끈다.
   */
  solo: boolean;
  search: string;
  page: number;
}

export const EMPTY_FILTERS: ProblemFilters = {
  source_type: '', school_name: '', year: '', school_level: '', grade: '', semester: '', exam_type: '', textbook: '',
  source_title: '', area_path: [], unit_path: [], grammar_path: [], question_kind: '', work_title: '', solo: false,
  search: '', page: 0,
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
 * 문법 축을 비우는 패치 — 다른 트리로 넘어갈 때 쓴다.
 *
 * ⚠️ 트리 모듈이 아니라 **여기** 있어야 한다. `school-exam-tree`·`work-tree` 가 이 파일을
 *    import 하고 문법 트리 모듈은 **그 둘을** import 하므로, 트리 쪽에 두면 순환이 된다.
 */
export const GRAMMAR_AXIS_CLEARED: Partial<ProblemFilters> = { grammar_path: [] };

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
  if (filters.school_level) params.set('lvl', filters.school_level);
  if (filters.grade) params.set('grade', filters.grade);
  if (filters.semester) params.set('sem', filters.semester);
  if (filters.exam_type) params.set('exam', filters.exam_type);
  if (filters.textbook) params.set('book', filters.textbook);
  if (filters.source_title) params.set('src', filters.source_title);
  if (filters.area_path.length > 0) params.set('area', filters.area_path.join(AREA_SEPARATOR));
  if (filters.unit_path.length > 0) params.set('unit', filters.unit_path.join(AREA_SEPARATOR));
  if (filters.grammar_path.length > 0) params.set('gram', filters.grammar_path.join(AREA_SEPARATOR));
  if (filters.question_kind) params.set('kind', filters.question_kind);
  if (filters.work_title) params.set('work', filters.work_title);
  if (filters.solo) params.set('solo', '1');
  if (filters.search) params.set('q', filters.search);
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
  const grammar = params.get('gram') ?? '';
  return {
    source_type: params.get('type') ?? '',
    school_name: params.get('school') ?? '',
    year: params.get('year') ?? '',
    school_level: parseSchoolLevel(params.get('lvl')),
    grade: params.get('grade') ?? '',
    semester: params.get('sem') ?? '',
    exam_type: params.get('exam') ?? '',
    textbook: params.get('book') ?? '',
    source_title: params.get('src') ?? '',
    area_path: area ? area.split(AREA_SEPARATOR).filter(Boolean) : [],
    unit_path: unit ? unit.split(AREA_SEPARATOR).filter(Boolean) : [],
    grammar_path: grammar ? grammar.split(AREA_SEPARATOR).filter(Boolean) : [],
    question_kind: parseQuestionKind(params.get('kind')),
    work_title: params.get('work') ?? '',
    solo: params.get('solo') === '1',
    search: params.get('q') ?? '',
    // 주소는 사람이 읽는 1-based, 내부는 0-based
    page: Number.isFinite(rawPage) && rawPage > 1 ? rawPage - 1 : 0,
  };
}

/**
 * '그 작품만 · 그 문법만'(solo-filter.ts) 조건 — 축이 있을 때만, 그리고 **체크박스 이름이 말하는 축
 * 하나만** 건다. 작품·문법 칸을 둘 다 골랐을 때 둘 다 걸면 이름('이 작품만 묻는 문항')이 말하지 않은
 * 조건(문학 지문 문항 빼기)까지 걸려 맞는 문항이 사라진다(코덱스 1R).
 * @param filters - 화면 필터
 * @returns 조회 조건 한 칸, 또는 빈 객체
 */
function soloEntry(filters: ProblemFilters): Pick<ProblemQuery, 'only_work' | 'passage_areas'> {
  if (!filters.solo) return {};
  const axis = soloAxisOf(filters);
  if (axis === 'work') return { only_work: true };
  if (axis === 'grammar') return { passage_areas: [...GRAMMAR_SOLO_PASSAGE_AREAS] };
  return {};
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
    // 학교급을 학년들로 편다 — 학년 칸과 **따로** 건다(둘 다 걸리면 교집합)
    ...(filters.school_level ? { grades: gradesForSchoolLevel(filters.school_level) } : {}),
    ...axisEntry('semester', filters.semester, true),
    ...axisEntry('exam_type', filters.exam_type, true),
    ...axisEntry('textbook', filters.textbook),
    ...axisEntry('source_title', filters.source_title),
    ...(filters.area_path.length > 0 ? { area_path: filters.area_path } : {}),
    ...(filters.unit_path.length > 0 ? { unit_path: filters.unit_path } : {}),
    // 고른 마디와 **그 아래 경로 전부**(중간 마디 포함)로 편다 — 저장값이 경로 문자열이라
    // 배열 포함(@>)으로는 상위 검색이 안 되고, 나열해 겹침(&&)으로 찾아야 한다
    ...(filters.grammar_path.length > 0
      ? { grammar_paths: grammarPathsUnder(filters.grammar_path) } : {}),
    // 갈래 하나를 DB 값들로 편다 — '주관식' 갈래는 '주관식'·'서술형' 둘 다 걸려야 한다
    ...(filters.question_kind
      ? { question_types: [...QUESTION_KIND_TYPES[filters.question_kind]] } : {}),
    // 작품명은 자유 텍스트다 — '미지정만' 을 허용하면 그런 이름의 작품과 겹친다
    ...axisEntry('work_title', filters.work_title),
    ...soloEntry(filters),
    ...(filters.search.trim() ? { search: filters.search.trim() } : {}),
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
    filters.source_type || filters.school_name || filters.year || filters.school_level || filters.grade
    || filters.semester || filters.exam_type || filters.textbook || filters.source_title || filters.area_path.length > 0
    || filters.unit_path.length > 0 || filters.grammar_path.length > 0
    || filters.question_kind || filters.work_title || filters.search
    // 축 없이 켜져만 있는 칸은 조건이 아니다 — 그것 때문에 '조건 지우기' 가 뜨면 눌러도 목록이 그대로다
    || soloApplies(filters),
  );
}
