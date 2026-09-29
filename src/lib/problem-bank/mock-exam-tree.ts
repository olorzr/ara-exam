import type { FacetTreeNode, SchoolExamFacet } from './school-exam-tree';
import { isKiceRound } from './source-form';

/**
 * 기출 트리의 **모의고사·수능** 가지 (순수 함수).
 *
 * 모의고사는 전국 공통이라 학교·학기가 없다. 같은 학년도 안에서 시험을 가르는 것은 회차
 * (`exam_type` — '수능'·'6월 모평' …, source-form.ts 의 `MOCK_EXAM_TYPE_OPTIONS`)뿐이라
 * **학년도 › 회차** 두 단계로 묶는다. 평가원 회차는 학년을 보지 않는다(갈래를 모을 때
 * school-exam-tree.ts 가 학년을 지운다). 선택과목(공통·화법과 작문·언어와 매체)이나 A형·B형은
 * 출처가 따로라도 **한 회차 잎**에 모인다 — 잎을 고르면 그 시험의 문항이 전부 나온다.
 *
 * ⚠️ 타입만 가져온다 — school-exam-tree.ts 가 이 파일을 부르므로 값까지 가져오면 순환한다.
 *    잎 id 를 만드는 함수는 인자로 받는다.
 */

/** 회차가 빈 잎의 이름 */
const UNSPECIFIED_ROUND = '회차 미지정';

/** 학년도가 빈 폴더의 이름 (학교 가지와 같은 말) */
const UNSPECIFIED_YEAR = '미지정';

/** 학년이 빈 교육청 학평 잎의 앞말 */
const UNSPECIFIED_GRADE = '학년 미지정';

/**
 * 잎 순서 — 수능이 먼저, 그다음 **늦은 달부터**(학년도 폴더를 최근부터 두는 것과 같은 결).
 * 목록에 없는 회차는 맨 뒤.
 */
const ROUND_ORDER: readonly string[] = [
  '수능', '11월 학평', '10월 학평', '9월 모평', '9월 학평', '7월 학평', '6월 모평', '6월 학평',
  '5월 학평', '4월 학평', '3월 학평', '모평', '예비시행', '예비평가', '예시문항',
];

/** 학년 순서 — 고3 먼저 */
const GRADE_ORDER: readonly string[] = ['고3', '고2', '고1'];

/** 목록 순위 — 없으면 맨 뒤 */
function rankIn(order: readonly string[], value: string): number {
  const index = order.indexOf(value);
  return index >= 0 ? index : order.length;
}

/**
 * 모의고사 잎에 보여 줄 이름.
 *
 * 평가원 회차는 학년을 안 붙인다(전부 고3 이고, 트리가 학년으로 가르지 않는다).
 * 그 밖(교육청 학평·회차 미지정)은 **늘** 학년을 붙인다 — 고3 만 빼면 학년이 빈 출처와
 * 이름이 같아져 같은 이름의 잎이 둘 생긴다(코덱스 리뷰 3R).
 * @param facet - 학년·회차가 있는 갈래
 * @returns '수능' / '고1 3월 학평' / '학년 미지정 회차 미지정'
 */
export function mockExamLeafLabel(facet: Pick<SchoolExamFacet, 'grade' | 'exam_type'>): string {
  if (isKiceRound(facet.exam_type)) return facet.exam_type;
  return `${facet.grade || UNSPECIFIED_GRADE} ${facet.exam_type || UNSPECIFIED_ROUND}`;
}

/** 잎 정렬: 평가원 회차 먼저 → 학년(고3 먼저) → 회차 순위 → 이름 */
function compareMockLeaf(a: SchoolExamFacet, b: SchoolExamFacet): number {
  const kice = Number(!isKiceRound(a.exam_type)) - Number(!isKiceRound(b.exam_type));
  if (kice !== 0) return kice;
  const grade = rankIn(GRADE_ORDER, a.grade) - rankIn(GRADE_ORDER, b.grade);
  if (grade !== 0) return grade;
  const round = rankIn(ROUND_ORDER, a.exam_type) - rankIn(ROUND_ORDER, b.exam_type);
  if (round !== 0) return round;
  return mockExamLeafLabel(a).localeCompare(mockExamLeafLabel(b), 'ko');
}

/**
 * 모의고사 갈래들을 학년도 › 회차 로 묶는다.
 * @param rows - 모의고사 갈래 (중복 없음, 평가원 회차는 학년이 이미 지워져 있다)
 * @param keyOf - 잎 id — 학교 가지와 같은 함수여야 선택 강조가 맞는다
 * @returns 학년도부터 시작하는 노드 (최근 학년도 먼저, 빈 학년도는 맨 뒤)
 */
export function buildMockExamNodes(
  rows: readonly SchoolExamFacet[],
  keyOf: (facet: SchoolExamFacet) => string,
): FacetTreeNode<SchoolExamFacet>[] {
  const byYear = new Map<string, SchoolExamFacet[]>();
  for (const row of rows) {
    const list = byYear.get(row.year);
    if (list) list.push(row);
    else byYear.set(row.year, [row]);
  }
  return [...byYear.entries()]
    .sort(([a], [b]) => {
      if (!a || !b) return Number(!a) - Number(!b);
      return b.localeCompare(a, 'ko');
    })
    .map(([year, yearRows]) => ({
      id: `mock-year:${JSON.stringify([year])}`,
      label: year ? `${year}학년도` : UNSPECIFIED_YEAR,
      children: [...yearRows].sort(compareMockLeaf).map((row) => ({
        id: keyOf(row),
        label: mockExamLeafLabel(row),
        children: [],
        value: row,
      })),
    }));
}
