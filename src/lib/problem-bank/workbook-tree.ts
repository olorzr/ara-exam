import { SEMESTER_OPTIONS } from '@/lib/constants';
import { naturalCompare } from '@/lib/category-tree';
import { GRAMMAR_AXIS_CLEARED, UNSPECIFIED_AXIS, type ProblemFilters } from './filters';
import type { FacetTreeNode, SchoolExamFacet } from './school-exam-tree';
import { WORKBOOK_SOURCE_TYPE } from './source-form';

/**
 * 기출 트리의 **평가문제집** 가지 (순수 함수, 2026-10-28).
 *
 * 평가문제집(sql/80)은 학교·시험이 없고 소단원 하나가 출처 하나다. 그래서 학교 가지와 달리
 * **교과서 › 학년·학기 › 책(출처 제목)** 으로 가른다 — "동아 중2 1학기 평가문제집 2-(1) 시와 화자" 가 잎이다.
 * 잎은 출처 제목 **같음**(`source_title`, sql/82)까지 건다.
 *
 * ⚠️ 타입·상수만 school-exam-tree 에서 가져온다(값 import 는 순환이 된다 — mock-exam-tree 와 같은 규약).
 * ⚠️ 잎 id 는 `workbookKey` 다 — 학교 잎 열쇠(`schoolExamKey`)의 모양은 테스트가 고정해 바꾸지 않는다.
 */

/** 평가문제집 한 권(출처 하나) — 패싯의 출처 행에서 뽑는다 */
export interface WorkbookFacet extends SchoolExamFacet {
  textbook: string;
  /** 출처 제목 — 패싯이 평가문제집에만 싣는다(sql/82) */
  title: string;
}

/** 가지 이름 */
export const WORKBOOK_ROOT_LABEL = '평가문제집';

/** 빈 값 폴더 이름 */
const UNSPECIFIED = '미지정';

/** 빈 값이면 '미지정만' 을 뜻하는 값으로 */
const axisValue = (value: string): string => (value === '' ? UNSPECIFIED_AXIS : value);

/**
 * 잎 하나를 가리키는 열쇠.
 * @param facet - 평가문제집 한 권
 * @returns 열쇠
 */
export function workbookKey(facet: Pick<WorkbookFacet, 'textbook' | 'grade' | 'semester' | 'title'>): string {
  return JSON.stringify(['workbook', facet.textbook, facet.grade, facet.semester, facet.title]);
}

/** 빈 값은 맨 뒤 */
function emptyLast(a: string, b: string, compare: (x: string, y: string) => number): number {
  if (!a || !b) return Number(!a) - Number(!b);
  return compare(a, b);
}

/** 학년 › 학기 순 — 학기는 1학기·2학기 차례, 미지정은 맨 뒤 */
function compareGradeSemester(a: WorkbookFacet, b: WorkbookFacet): number {
  const grade = emptyLast(a.grade, b.grade, naturalCompare);
  if (grade !== 0) return grade;
  const terms: readonly string[] = SEMESTER_OPTIONS;
  const rank = (s: string) => { const i = terms.indexOf(s); return i >= 0 ? i : terms.length; };
  return rank(a.semester) - rank(b.semester);
}

/**
 * 평가문제집 갈래들을 교과서 › 학년·학기 › 책 으로 묶는다.
 * @param rows - 평가문제집 갈래 (중복이 섞여 있어도 된다)
 * @returns 교과서 폴더들
 */
export function buildWorkbookNodes(rows: readonly WorkbookFacet[]): FacetTreeNode<SchoolExamFacet>[] {
  const seen = new Map<string, WorkbookFacet>();
  for (const row of rows) {
    if (row.source_type !== WORKBOOK_SOURCE_TYPE) continue;
    seen.set(workbookKey(row), row);
  }
  const byTextbook = new Map<string, WorkbookFacet[]>();
  for (const row of seen.values()) {
    const list = byTextbook.get(row.textbook);
    if (list) list.push(row); else byTextbook.set(row.textbook, [row]);
  }
  return [...byTextbook.entries()]
    .sort(([a], [b]) => emptyLast(a, b, (x, y) => x.localeCompare(y, 'ko')))
    .map(([textbook, books]) => {
      const byTerm = new Map<string, WorkbookFacet[]>();
      for (const book of [...books].sort(compareGradeSemester)) {
        const term = JSON.stringify([book.grade, book.semester]);
        const list = byTerm.get(term);
        if (list) list.push(book); else byTerm.set(term, [book]);
      }
      return {
        id: `workbook:${JSON.stringify([textbook])}`,
        label: textbook || `교과서 ${UNSPECIFIED}`,
        children: [...byTerm.values()].map((term) => ({
          id: `workbook:${JSON.stringify([textbook, term[0].grade, term[0].semester])}`,
          label: [term[0].grade || UNSPECIFIED, term[0].semester || `학기 ${UNSPECIFIED}`].join(' '),
          // 제목은 '1-(1) …' 처럼 단원 번호가 앞에 있어 자연순이 곧 단원 차례다
          children: [...term].sort((a, b) => naturalCompare(a.title, b.title)).map((book) => ({
            id: workbookKey(book),
            label: book.title.replace(/^.*?평가문제집\s*/, '') || book.title,
            children: [],
            value: book,
          })),
        })),
      };
    });
}

/**
 * 잎(책)을 골랐을 때 걸 필터 — 그 출처의 문항만. 다른 트리의 축(학교·시험·단원·작품·문법)은 비운다
 * (네 트리는 서로의 축을 남기지 않는다 — school-exam-tree 와 같은 규약).
 * @param facet - 고른 책
 * @returns 필터 패치
 */
export function workbookFilterPatch(facet: SchoolExamFacet): Partial<ProblemFilters> {
  const book = facet as Partial<WorkbookFacet>;
  return {
    source_type: WORKBOOK_SOURCE_TYPE,
    school_name: '',
    year: '',
    school_level: '',
    grade: axisValue(facet.grade),
    semester: axisValue(facet.semester),
    exam_type: '',
    textbook: book.textbook ?? '',
    source_title: book.title ?? '',
    unit_path: [],
    work_title: '',
    ...GRAMMAR_AXIS_CLEARED,
    page: 0,
  };
}
