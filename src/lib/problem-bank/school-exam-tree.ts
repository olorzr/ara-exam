import { SEMESTER_OPTIONS } from '@/lib/constants';
import { naturalCompare } from '@/lib/category-tree';
import { EXAM_TYPE_OPTIONS, isKiceRound, levelFromGrade, type SchoolLevel } from './source-form';
import { GRAMMAR_AXIS_CLEARED, UNSPECIFIED_AXIS, type ProblemFilters } from './filters';
import { buildMockExamNodes } from './mock-exam-tree';

/**
 * 기출 트리 (순수 함수).
 *
 * 맨 위를 **고등 / 중등 / 모의고사·수능** 으로 가른다(2026-09-29 사용자 요청 — 탭 이름도
 * '학교 기출' → '기출'). 학교 기출은 그 아래 **학교 › 학년도 › 학년 › 학기·시험**,
 * 모의고사는 **학년도 › 회차**(mock-exam-tree.ts). 교과서·단원 트리와 나란한 또 하나의
 * 진입로다 — 같은 문항을 "천재 3단원" 으로도, "상현중 2026 2학기 기말" 로도 찾을 수 있어야 한다.
 *
 * ⚠️ 트리는 **실제로 읽어 둔 출처**(패싯)로만 만든다. 학교 마스터(`public.schools`)
 *    전체를 그리면 문항이 하나도 없는 학교가 잔뜩 나온다(영역 필터와 같은 규약).
 * ⚠️ 노드 키는 `JSON.stringify` 로 만든다. 학교·단원 이름은 자유 텍스트라
 *    `'|'` 같은 구분자를 쓰면 이름에 그 글자가 들어간 순간 키가 섞인다.
 * ⚠️ 값이 빈 갈래('미지정')는 필터에 `UNSPECIFIED_AXIS` 를 싣는다. 빈 문자열을 그대로
 *    실으면 필터가 '전체'로 읽어 **그 축의 모든 기출**이 함께 나온다(코덱스 리뷰 2R).
 */

/** 기출 한 갈래 — 출처 행에서 뽑은 값 묶음 */
export interface SchoolExamFacet {
  /** '내신기출' 또는 '모의고사' — 어느 가지에 달릴지 정한다 */
  source_type: string;
  school_name: string;
  year: string;
  grade: string;
  semester: string;
  exam_type: string;
}

/** 어떤 값이든 잎에 달 수 있는 트리 노드 */
export interface FacetTreeNode<T> {
  id: string;
  label: string;
  children: FacetTreeNode<T>[];
  /** 잎에만 있다 — 다만 문법 트리는 가지에도 '(전체)' 잎을 달아 가지를 고르게 한다 */
  value?: T;
  /** 문항 0건 — 흐리게 그린다(고를 수는 있다). 문법 트리만 쓴다 */
  dimmed?: boolean;
}

/** 학교 가지가 다루는 출처 유형 — 학교 기출만 학교·학기·시험이 다 채워진다 */
export const SCHOOL_EXAM_SOURCE_TYPE = '내신기출';

/** 모의고사·수능 가지가 다루는 출처 유형 — 학교·학기가 없고 회차(`exam_type`)로 갈린다 */
export const MOCK_EXAM_SOURCE_TYPE = '모의고사';

/** 맨 위 가지 순서 — 사용자가 적어 준 순서 그대로다 */
const LEVEL_ROOTS: readonly SchoolLevel[] = ['고등', '중등'];

/** 모의고사·수능 가지 이름 */
export const MOCK_ROOT_LABEL = '모의고사·수능';

/** 값이 비었을 때 폴더에 쓰는 이름 (categories 와 같은 규약: '' = 미지정) */
const UNSPECIFIED = '미지정';

/** 빈 값이면 '미지정만' 을 뜻하는 값으로 바꾼다 */
function axisValue(value: string): string {
  return value === '' ? UNSPECIFIED_AXIS : value;
}

/** 학교 축을 통째로 비우는 패치 — 다른 트리로 넘어갈 때 쓴다 */
export const SCHOOL_AXES_CLEARED: Partial<ProblemFilters> = {
  source_type: '', school_name: '', year: '', grade: '', semester: '', exam_type: '',
};

/**
 * 한 갈래를 가리키는 고유 키.
 * @param facet - 학교 기출 갈래
 * @returns 중복 판정·강조에 쓰는 문자열
 */
export function schoolExamKey(facet: SchoolExamFacet): string {
  return JSON.stringify([
    facet.source_type, facet.school_name, facet.year, facet.grade, facet.semester, facet.exam_type,
  ]);
}

/**
 * 잎에 보여 줄 이름.
 * @param facet - 학기·시험이 있는 갈래
 * @returns '1학기 중간' / '미지정 시험 미지정'
 */
export function schoolExamLeafLabel(
  facet: Pick<SchoolExamFacet, 'semester' | 'exam_type'>,
): string {
  const semester = facet.semester || UNSPECIFIED;
  const examType = facet.exam_type || `시험 ${UNSPECIFIED}`;
  return `${semester} ${examType}`;
}

/** 옵션 순서대로 → 목록에 없는 값(미지정 포함)은 맨 뒤 */
function rankIn(options: readonly string[], value: string): number {
  const index = options.indexOf(value);
  return index >= 0 ? index : options.length;
}

/** 잎 정렬: 학기 → 시험 순, 미지정은 각각 맨 뒤 */
function compareLeaf(a: SchoolExamFacet, b: SchoolExamFacet): number {
  const semester = rankIn(SEMESTER_OPTIONS, a.semester) - rankIn(SEMESTER_OPTIONS, b.semester);
  if (semester !== 0) return semester;
  const exam = rankIn(EXAM_TYPE_OPTIONS, a.exam_type) - rankIn(EXAM_TYPE_OPTIONS, b.exam_type);
  if (exam !== 0) return exam;
  return a.semester.localeCompare(b.semester, 'ko');
}

/** 빈 값을 맨 뒤로 보내면서 주어진 비교를 쓴다 */
function compareWithEmptyLast(a: string, b: string, compare: (x: string, y: string) => number) {
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  return compare(a, b);
}

function groupBy<T>(items: T[], keyFn: (item: T) => string): Map<string, T[]> {
  const out = new Map<string, T[]>();
  for (const item of items) {
    const key = keyFn(item);
    const list = out.get(key);
    if (list) list.push(item);
    else out.set(key, [item]);
  }
  return out;
}

/**
 * 학교마다 학교급을 하나로 정한다 — 학년이 빈 출처가 섞여도 그 학교는 한 가지에만 달린다.
 * @param rows - 학교 기출 갈래
 * @returns 학교 → 학교급 (학년이 모두 비었으면 없음)
 */
function levelBySchool(rows: readonly SchoolExamFacet[]): Map<string, SchoolLevel> {
  const out = new Map<string, SchoolLevel>();
  for (const row of rows) {
    const level = levelFromGrade(row.grade);
    if (level && !out.has(row.school_name)) out.set(row.school_name, level);
  }
  return out;
}

/**
 * 학교 기출 갈래들을 학교 › 학년도 › 학년 › 학기·시험 으로 묶는다.
 * @param rows - 한 학교급의 갈래 (중복 없음)
 * @param level - 노드 id 에 넣을 학교급 — 같은 학교가 두 가지에 그려질 일은 없지만 id 는 가지마다 고유해야 한다
 * @returns 학교부터 시작하는 노드
 */
function buildSchoolNodes(
  rows: readonly SchoolExamFacet[], level: string,
): FacetTreeNode<SchoolExamFacet>[] {
  return [...groupBy([...rows], (r) => r.school_name).entries()]
    .sort(([a], [b]) => a.localeCompare(b, 'ko'))
    .map(([school, schoolRows]) => ({
      id: `school:${JSON.stringify([level, school])}`,
      label: school,
      children: [...groupBy(schoolRows, (r) => r.year).entries()]
        // 최근 학년도부터 — 올해 기출을 가장 먼저 찾는다
        .sort(([a], [b]) => compareWithEmptyLast(a, b, (x, y) => y.localeCompare(x, 'ko')))
        .map(([year, yearRows]) => ({
          id: `year:${JSON.stringify([level, school, year])}`,
          label: year ? `${year}학년도` : UNSPECIFIED,
          children: [...groupBy(yearRows, (r) => r.grade).entries()]
            .sort(([a], [b]) => compareWithEmptyLast(a, b, naturalCompare))
            .map(([grade, gradeRows]) => ({
              id: `grade:${JSON.stringify([level, school, year, grade])}`,
              label: grade || UNSPECIFIED,
              children: [...gradeRows].sort(compareLeaf).map((row) => ({
                id: schoolExamKey(row),
                label: schoolExamLeafLabel(row),
                children: [],
                value: row,
              })),
            })),
        })),
    }));
}

/**
 * 기출 갈래들을 **고등 / 중등 / 모의고사·수능** 가지로 묶는다.
 *
 * 비어 있는 가지는 그리지 않는다(패싯으로만 만드는 트리의 규약). 학년이 모두 비어 학교급을
 * 알 수 없는 학교는 맨 뒤 '학교급 미지정' 가지에 둔다 — 버리면 그 학교 기출을 찾을 길이 없다.
 * @param tuples - 패싯에서 모은 갈래 (중복·학교명 빈 값이 섞여 있어도 된다)
 * @returns 학교급·모의고사 가지부터 시작하는 트리
 */
export function buildSchoolExamTree(
  tuples: readonly SchoolExamFacet[],
): FacetTreeNode<SchoolExamFacet>[] {
  const seen = new Set<string>();
  const schoolRows: SchoolExamFacet[] = [];
  const mockRows: SchoolExamFacet[] = [];
  for (const raw of tuples) {
    const isMock = raw.source_type === MOCK_EXAM_SOURCE_TYPE;
    // 학교 이름이 없는 내신 기출은 어느 학교 기출인지 알 수 없어 트리에 자리를 줄 수 없다
    if (!isMock && (raw.source_type !== SCHOOL_EXAM_SOURCE_TYPE || !raw.school_name)) continue;
    // 모의고사는 학년도·학년·회차로만 가른다. 예전에 저장된 행에 학교·학기가 남아 있어도
    // 같은 회차 잎이 둘로 갈리지 않게 지운다 — 잎의 필터도 두 칸을 '전체' 로 둔다(코덱스 리뷰 1R).
    // 평가원 회차는 학년도 지운다: 학년이 빈 출처와 '고3' 출처가 한 시험의 두 잎으로 갈렸다(3R)
    const tuple = isMock
      ? { ...raw, school_name: '', semester: '', grade: isKiceRound(raw.exam_type) ? '' : raw.grade }
      : raw;
    const key = schoolExamKey(tuple);
    if (seen.has(key)) continue;
    seen.add(key);
    (isMock ? mockRows : schoolRows).push(tuple);
  }

  const levels = levelBySchool(schoolRows);
  const roots: FacetTreeNode<SchoolExamFacet>[] = [];
  for (const level of LEVEL_ROOTS) {
    const rows = schoolRows.filter((r) => levels.get(r.school_name) === level);
    if (rows.length > 0) roots.push({ id: `level:${level}`, label: level, children: buildSchoolNodes(rows, level) });
  }
  const unknown = schoolRows.filter((r) => !levels.has(r.school_name));
  if (unknown.length > 0) {
    roots.push({ id: 'level:', label: `학교급 ${UNSPECIFIED}`, children: buildSchoolNodes(unknown, '') });
  }
  if (mockRows.length > 0) {
    roots.push({ id: 'mock', label: MOCK_ROOT_LABEL, children: buildMockExamNodes(mockRows, schoolExamKey) });
  }
  return roots;
}

/**
 * 잎을 골랐을 때 걸 필터.
 *
 * 교과서·단원 축을 **비운다** — 두 트리는 탭으로 갈린 대안 경로라, 남겨 두면
 * "상현중 기출 ∩ 천재 3단원" 이 조용히 0건이 되고 왜 비었는지 화면에 단서가 없다.
 * 일부러 겹쳐 보고 싶으면 위쪽 필터 줄에서 교과서를 다시 고르면 된다.
 * @param facet - 고른 갈래
 * @returns 필터 패치
 */
export function schoolExamFilterPatch(facet: SchoolExamFacet): Partial<ProblemFilters> {
  if (facet.source_type === MOCK_EXAM_SOURCE_TYPE) return mockExamFilterPatch(facet);
  return {
    source_type: SCHOOL_EXAM_SOURCE_TYPE,
    school_name: facet.school_name,
    // 빈 값은 '전체' 가 아니라 '미지정인 것만' 이다
    year: axisValue(facet.year),
    grade: axisValue(facet.grade),
    // 학년을 이 갈래로 못 박으니 학교급은 푼다 — 남기면 '고등 ∩ 중2' 가 조용히 0건이 된다
    school_level: '',
    semester: axisValue(facet.semester),
    exam_type: axisValue(facet.exam_type),
    textbook: '',
    unit_path: [],
    // 작품·문법 트리도 같은 이유로 비운다 — 네 트리는 서로의 축을 남기지 않는다
    work_title: '',
    ...GRAMMAR_AXIS_CLEARED,
    page: 0,
  };
}

/**
 * 모의고사 잎의 필터 — 학교·학기는 비우고(전국 공통이라 없다) 학년도·회차를 건다.
 * 학년은 교육청 학평에만 건다(평가원 회차는 전부 고3).
 * 나머지 축을 비우는 규약은 학교 잎과 같다.
 * @param facet - 모의고사 갈래
 * @returns 필터 패치
 */
function mockExamFilterPatch(facet: SchoolExamFacet): Partial<ProblemFilters> {
  return {
    source_type: MOCK_EXAM_SOURCE_TYPE,
    school_name: '',
    year: axisValue(facet.year),
    // 평가원 회차는 학년을 걸지 않는다('전체') — 학년이 빈 출처도 같은 시험이다
    grade: isKiceRound(facet.exam_type) ? '' : axisValue(facet.grade),
    school_level: '',
    semester: '',
    exam_type: axisValue(facet.exam_type),
    textbook: '',
    unit_path: [],
    work_title: '',
    ...GRAMMAR_AXIS_CLEARED,
    page: 0,
  };
}

/** 아카이브 왼쪽 패널의 탭 */
export type ArchiveSideTab = 'units' | 'schools' | 'works' | 'grammar';

/**
 * 주소로 들어왔을 때 왼쪽 패널의 첫 탭.
 *
 * 링크를 받아 열었는데 엉뚱한 트리가 켜져 있으면 왜 이 목록인지 알 수 없다 —
 * 걸린 조건을 만든 트리를 보여 준다.
 * @param filters - 주소에서 복원한 필터
 * @returns 켤 탭
 */
export function initialSideTab(
  filters: Pick<ProblemFilters, 'source_type' | 'school_name' | 'unit_path' | 'work_title' | 'grammar_path'>,
): ArchiveSideTab {
  // 문법을 가장 먼저 본다 — 다른 세 축은 위쪽 필터 줄에도 드러나지만, 문법 개념은
  // 트리에서 봐야 어느 가지인지 알 수 있다
  if (filters.grammar_path.length > 0 && filters.unit_path.length === 0) return 'grammar';
  if (filters.work_title && filters.unit_path.length === 0) return 'works';
  // 모의고사는 학교가 없다 — 유형만으로 기출 탭을 켠다(그 트리에 모의고사·수능 가지가 있다)
  const examPicked = Boolean(filters.school_name) || filters.source_type === MOCK_EXAM_SOURCE_TYPE;
  return examPicked && filters.unit_path.length === 0 ? 'schools' : 'units';
}
