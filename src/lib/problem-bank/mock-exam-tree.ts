import type { FacetTreeNode, SchoolExamFacet } from './school-exam-tree';
import { isKiceRound } from './source-form';

/**
 * 기출 트리의 **모의고사·수능** 가지 (순수 함수).
 *
 * 모의고사는 전국 공통이라 학교·학기가 없다. 그래서 **학년 › 학년도 › 회차** 세 단계로 묶는다
 * (2026-10-21 사용자 요청 — "모의고사란에서 고1, 고2, 고3 은 나눠야" — 교육청 학평 고1·고2 54회를
 * 올리자 한 학년도 폴더에 고1·고2·고3 잎이 뒤섞였다). 회차는 `exam_type`('수능'·'6월 모평'·
 * '3월 학평' …, source-form.ts 의 `MOCK_EXAM_TYPE_OPTIONS`)이다.
 *
 * 평가원 회차는 전부 고3 시험이라 **고3 폴더**에 둔다. 갈래를 모을 때 school-exam-tree.ts 가
 * 평가원 회차의 학년을 지우므로(학년이 빈 출처와 '고3' 출처를 한 잎으로) 여기서 학년을 되살린다.
 * 선택과목(공통·화법과 작문·언어와 매체)이나 A형·B형은 출처가 따로라도 **한 회차 잎**에 모인다 —
 * 잎을 고르면 그 시험의 문항이 전부 나온다.
 *
 * ⚠️ 타입만 가져온다 — school-exam-tree.ts 가 이 파일을 부르므로 값까지 가져오면 순환한다.
 *    잎 id 를 만드는 함수는 인자로 받는다.
 */

/** 회차가 빈 잎의 이름 */
const UNSPECIFIED_ROUND = '회차 미지정';

/** 학년도가 빈 폴더의 이름 (학교 가지와 같은 말) */
const UNSPECIFIED_YEAR = '미지정';

/** 학년이 빈 교육청 학평 폴더의 이름 */
const UNSPECIFIED_GRADE = '학년 미지정';

/** 평가원 회차가 들어갈 학년 — 수능·모평은 전부 고3 시험이다 */
const KICE_GRADE = '고3';

/**
 * 잎 순서 — 수능이 먼저, 그다음 **늦은 달부터**(학년도 폴더를 최근부터 두는 것과 같은 결).
 * 목록에 없는 회차는 맨 뒤.
 */
const ROUND_ORDER: readonly string[] = [
  '수능', '11월 학평', '10월 학평', '9월 모평', '9월 학평', '7월 학평', '6월 모평', '6월 학평',
  '5월 학평', '4월 학평', '3월 학평', '모평', '예비시행', '예비평가', '예시문항',
];

/** 학년 폴더 순서 — 고1 → 고2 → 고3 (학교 기출 가지의 학년 순서와 같다). 목록 밖·빈 학년은 맨 뒤 */
const GRADE_ORDER: readonly string[] = ['고1', '고2', '고3'];

/** 목록 순위 — 없으면 맨 뒤 */
function rankIn(order: readonly string[], value: string): number {
  const index = order.indexOf(value);
  return index >= 0 ? index : order.length;
}

/**
 * 모의고사 갈래가 들어갈 학년 폴더.
 * @param facet - 학년·회차가 있는 갈래
 * @returns 평가원 회차면 '고3', 그 밖은 저장된 학년('' = 학년 미지정)
 */
export function mockExamGrade(facet: Pick<SchoolExamFacet, 'grade' | 'exam_type'>): string {
  return isKiceRound(facet.exam_type) ? KICE_GRADE : facet.grade;
}

/**
 * 모의고사 잎에 보여 줄 이름 — 학년은 폴더가 말하므로 회차만 적는다.
 * @param facet - 회차가 있는 갈래
 * @returns '수능' / '3월 학평' / '회차 미지정'
 */
export function mockExamLeafLabel(facet: Pick<SchoolExamFacet, 'exam_type'>): string {
  return facet.exam_type || UNSPECIFIED_ROUND;
}

/** 잎 정렬: 평가원 회차 먼저 → 회차 순위 → 이름 */
function compareMockLeaf(a: SchoolExamFacet, b: SchoolExamFacet): number {
  const kice = Number(!isKiceRound(a.exam_type)) - Number(!isKiceRound(b.exam_type));
  if (kice !== 0) return kice;
  const round = rankIn(ROUND_ORDER, a.exam_type) - rankIn(ROUND_ORDER, b.exam_type);
  if (round !== 0) return round;
  return mockExamLeafLabel(a).localeCompare(mockExamLeafLabel(b), 'ko');
}

/** 학년 폴더 정렬: 고1 → 고2 → 고3 → 목록 밖(가나다) → 학년 미지정 */
function compareGrade(a: string, b: string): number {
  if (!a || !b) return Number(!a) - Number(!b);
  const rank = rankIn(GRADE_ORDER, a) - rankIn(GRADE_ORDER, b);
  return rank !== 0 ? rank : a.localeCompare(b, 'ko');
}

/** 학년도 폴더 정렬: 최근부터, 빈 학년도는 맨 뒤 */
function compareYear(a: string, b: string): number {
  if (!a || !b) return Number(!a) - Number(!b);
  return b.localeCompare(a, 'ko');
}

/** 값으로 묶는다 — 넣은 차례를 지킨다 */
function groupBy(rows: readonly SchoolExamFacet[], keyFn: (row: SchoolExamFacet) => string) {
  const out = new Map<string, SchoolExamFacet[]>();
  for (const row of rows) {
    const key = keyFn(row);
    const list = out.get(key);
    if (list) list.push(row);
    else out.set(key, [row]);
  }
  return out;
}

/**
 * 모의고사 갈래들을 학년 › 학년도 › 회차 로 묶는다.
 * @param rows - 모의고사 갈래 (중복 없음, 평가원 회차는 학년이 이미 지워져 있다)
 * @param keyOf - 잎 id — 학교 가지와 같은 함수여야 선택 강조가 맞는다
 * @returns 학년부터 시작하는 노드 (고1 → 고2 → 고3, 학년 미지정은 맨 뒤)
 */
export function buildMockExamNodes(
  rows: readonly SchoolExamFacet[],
  keyOf: (facet: SchoolExamFacet) => string,
): FacetTreeNode<SchoolExamFacet>[] {
  return [...groupBy(rows, mockExamGrade).entries()]
    .sort(([a], [b]) => compareGrade(a, b))
    .map(([grade, gradeRows]) => ({
      id: `mock-grade:${JSON.stringify([grade])}`,
      label: grade || UNSPECIFIED_GRADE,
      children: [...groupBy(gradeRows, (row) => row.year).entries()]
        .sort(([a], [b]) => compareYear(a, b))
        .map(([year, yearRows]) => ({
          // 같은 학년도가 학년마다 있으므로 id 에 학년을 함께 넣는다
          id: `mock-year:${JSON.stringify([grade, year])}`,
          label: year ? `${year}학년도` : UNSPECIFIED_YEAR,
          children: [...yearRows].sort(compareMockLeaf).map((row) => ({
            id: keyOf(row),
            label: mockExamLeafLabel(row),
            children: [],
            value: row,
          })),
        })),
    }));
}
