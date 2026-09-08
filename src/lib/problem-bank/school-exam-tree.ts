import { SEMESTER_OPTIONS } from '@/lib/constants';
import { naturalCompare } from '@/lib/category-tree';
import { EXAM_TYPE_OPTIONS } from './source-form';
import { UNSPECIFIED_AXIS, type ProblemFilters } from './filters';

/**
 * 학교 기출 트리 (순수 함수).
 *
 * 아카이브를 **학교 › 학년도 › 학년 › 학기·시험** 으로 훑는다. 교과서·단원 트리와
 * 나란한 또 하나의 진입로다 — 같은 문항을 "천재 3단원" 으로도, "상현중 2026 2학기 기말"
 * 로도 찾을 수 있어야 한다.
 *
 * ⚠️ 트리는 **실제로 읽어 둔 출처**(패싯)로만 만든다. 학교 마스터(`public.schools`)
 *    전체를 그리면 문항이 하나도 없는 학교가 잔뜩 나온다(영역 필터와 같은 규약).
 * ⚠️ 노드 키는 `JSON.stringify` 로 만든다. 학교·단원 이름은 자유 텍스트라
 *    `'|'` 같은 구분자를 쓰면 이름에 그 글자가 들어간 순간 키가 섞인다.
 * ⚠️ 값이 빈 갈래('미지정')는 필터에 `UNSPECIFIED_AXIS` 를 싣는다. 빈 문자열을 그대로
 *    실으면 필터가 '전체'로 읽어 **그 축의 모든 기출**이 함께 나온다(코덱스 리뷰 2R).
 */

/** 학교 기출 한 갈래 — 출처 행에서 뽑은 값 묶음 */
export interface SchoolExamFacet {
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
  /** 잎에만 있다 */
  value?: T;
}

/** 이 트리가 다루는 출처 유형 — 학교 기출만 학교·학기·시험이 다 채워진다 */
export const SCHOOL_EXAM_SOURCE_TYPE = '내신기출';

/** 값이 비었을 때 폴더에 쓰는 이름 (categories 와 같은 규약: '' = 미지정) */
const UNSPECIFIED = '미지정';

/** 빈 값이면 '미지정만' 을 뜻하는 값으로 바꾼다 */
function axisValue(value: string): string {
  return value === '' ? UNSPECIFIED_AXIS : value;
}

/** 학교 축을 통째로 비우는 패치 — 교과서 트리로 넘어갈 때 쓴다 */
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
    facet.school_name, facet.year, facet.grade, facet.semester, facet.exam_type,
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
 * 학교 기출 갈래들을 학교 › 학년도 › 학년 › 학기·시험 트리로 묶는다.
 * @param tuples - 패싯에서 모은 갈래 (중복·학교명 빈 값이 섞여 있어도 된다)
 * @returns 학교부터 시작하는 트리
 */
export function buildSchoolExamTree(
  tuples: readonly SchoolExamFacet[],
): FacetTreeNode<SchoolExamFacet>[] {
  const seen = new Set<string>();
  const rows: SchoolExamFacet[] = [];
  for (const tuple of tuples) {
    // 학교 이름이 없으면 어느 학교 기출인지 알 수 없어 트리에 자리를 줄 수 없다
    if (!tuple.school_name) continue;
    const key = schoolExamKey(tuple);
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push(tuple);
  }

  return [...groupBy(rows, (r) => r.school_name).entries()]
    .sort(([a], [b]) => a.localeCompare(b, 'ko'))
    .map(([school, schoolRows]) => ({
      id: `school:${JSON.stringify([school])}`,
      label: school,
      children: [...groupBy(schoolRows, (r) => r.year).entries()]
        // 최근 학년도부터 — 올해 기출을 가장 먼저 찾는다
        .sort(([a], [b]) => compareWithEmptyLast(a, b, (x, y) => y.localeCompare(x, 'ko')))
        .map(([year, yearRows]) => ({
          id: `year:${JSON.stringify([school, year])}`,
          label: year ? `${year}학년도` : UNSPECIFIED,
          children: [...groupBy(yearRows, (r) => r.grade).entries()]
            .sort(([a], [b]) => compareWithEmptyLast(a, b, naturalCompare))
            .map(([grade, gradeRows]) => ({
              id: `grade:${JSON.stringify([school, year, grade])}`,
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
 * 잎을 골랐을 때 걸 필터.
 *
 * 교과서·단원 축을 **비운다** — 두 트리는 탭으로 갈린 대안 경로라, 남겨 두면
 * "상현중 기출 ∩ 천재 3단원" 이 조용히 0건이 되고 왜 비었는지 화면에 단서가 없다.
 * 일부러 겹쳐 보고 싶으면 위쪽 필터 줄에서 교과서를 다시 고르면 된다.
 * @param facet - 고른 갈래
 * @returns 필터 패치
 */
export function schoolExamFilterPatch(facet: SchoolExamFacet): Partial<ProblemFilters> {
  return {
    source_type: SCHOOL_EXAM_SOURCE_TYPE,
    school_name: facet.school_name,
    // 빈 값은 '전체' 가 아니라 '미지정인 것만' 이다
    year: axisValue(facet.year),
    grade: axisValue(facet.grade),
    semester: axisValue(facet.semester),
    exam_type: axisValue(facet.exam_type),
    textbook: '',
    unit_path: [],
    page: 0,
  };
}

/**
 * 주소로 들어왔을 때 왼쪽 패널의 첫 탭.
 * @param filters - 주소에서 복원한 필터
 * @returns 학교 조건만 있으면 'schools', 그 밖에는 'units'
 */
export function initialSideTab(
  filters: Pick<ProblemFilters, 'school_name' | 'unit_path'>,
): 'units' | 'schools' {
  return filters.school_name && filters.unit_path.length === 0 ? 'schools' : 'units';
}
