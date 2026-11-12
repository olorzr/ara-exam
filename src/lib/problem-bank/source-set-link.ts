import { EMPTY_FILTERS, filtersToQueryString } from './filters';
import { mockExamGrade } from './mock-exam-tree';
import { MOCK_EXAM_SOURCE_TYPE, schoolExamFilterPatch } from './school-exam-tree';
import { isKiceRound } from './source-form';
import type { SourceListQuery } from './source-list-filters';
import { isSetSourceType } from './source-sets-payload';
import type { SourceSetKey } from './source-sets';

/**
 * 세트 ↔ 주소 · 조회 조건 (순수 함수).
 *
 * ⚠️ 세트 한 장의 주소는 칸을 **글자 그대로** 싣는다. 세트에는 '전체' 라는 뜻이 없어서 `book=`(빈 값)은 언제나
 *    '교과서가 빈 출처만' 이다 — 아카이브 필터처럼 '미지정' 센티널(`UNSPECIFIED_AXIS`)을 쓰지 않는다.
 * ⚠️ 그래서 아카이브로 넘길 수 없는 세트가 있다: 아카이브의 교과서 칸은 자유 텍스트라 '미지정만' 을 받지 않는다
 *    (filters.ts — 빈 값은 '전체'). 교과서가 빈 내신 세트를 넘기면 같은 학년·시험의 **다른 세트 문항까지** 나온다.
 *    `setArchiveHref` 가 그때 null 이다(2026-11-13 내신 141장 중 80장).
 */

/** 세트 목록 */
export const SETS_PATH = '/problems/sets';

/** 세트 한 장 */
export const SET_VIEW_PATH = '/problems/sets/view';

/**
 * 세트 한 장의 주소.
 * @param set - 세트 칸
 * @returns '/problems/sets/view?type=…'
 */
export function setViewHref(set: SourceSetKey): string {
  const params = new URLSearchParams();
  params.set('type', set.source_type);
  params.set('year', set.year);
  params.set('grade', set.grade);
  params.set('exam', set.exam_type);
  if (set.source_type === MOCK_EXAM_SOURCE_TYPE) {
    params.set('board', set.publisher);
  } else {
    params.set('sem', set.semester);
    params.set('book', set.textbook);
  }
  return `${SET_VIEW_PATH}?${params.toString()}`;
}

/**
 * 주소에서 세트를 되살린다.
 * @param params - 주소 쿼리
 * @returns 세트 칸. 유형이 세트가 아니면 null
 */
export function setFromParams(params: URLSearchParams): SourceSetKey | null {
  const type = params.get('type');
  if (!isSetSourceType(type)) return null;
  const read = (key: string) => params.get(key) ?? '';
  if (type === MOCK_EXAM_SOURCE_TYPE) {
    const exam_type = read('exam');
    return {
      source_type: type, year: read('year'), grade: mockExamGrade({ grade: read('grade'), exam_type }),
      semester: '', exam_type, textbook: '', publisher: read('board'),
    };
  }
  return {
    source_type: type, year: read('year'), grade: read('grade'), semester: read('sem'),
    exam_type: read('exam'), textbook: read('book'), publisher: '',
  };
}

/**
 * 세트에 든 출처를 읽는 조건 — `fetchSources` 에 넘긴다.
 *
 * `toSourceListQuery` 를 거치지 않는다: 그 길은 아카이브 필터 규칙이라 교과서 `''` 를 '전체' 로 읽는다.
 * 여기서는 `''` 를 그대로 실어 `applySourceAxes` 가 '빈 값인 출처만' 으로 건다.
 * 모의고사는 학기·교과서를 걸지 않고(sql/107 이 접는다), 평가원 회차는 학년도 걸지 않는다(학년 빈 출처도 같은 시험).
 * 주관은 출처 조건에 칸이 없어 `fetchSetSources` 가 받은 뒤 거른다.
 * @param set - 세트 칸
 * @returns 조회 조건
 */
export function setSourceQuery(set: SourceSetKey): SourceListQuery {
  if (set.source_type === MOCK_EXAM_SOURCE_TYPE) {
    return {
      sort: 'exam', source_type: set.source_type, year: set.year, exam_type: set.exam_type,
      ...(isKiceRound(set.exam_type) ? {} : { grade: set.grade }),
    };
  }
  return {
    sort: 'exam', source_type: set.source_type, year: set.year, grade: set.grade,
    semester: set.semester, exam_type: set.exam_type, textbook: set.textbook,
  };
}

/**
 * 이 세트의 문항을 문제 아카이브에서 보는 주소.
 *
 * 기출 트리의 잎과 같은 필터(`schoolExamFilterPatch` — 학교는 비워 '전체')에 교과서를 더한다.
 * 모의고사는 주관 칸이 없지만 회차 이름이 주관을 가른다(학평은 교육청, 모평·수능은 평가원).
 * @param set - 세트 칸
 * @returns 주소. 아카이브가 같은 범위를 못 거르면(교과서가 빈 내신 세트) null
 */
export function setArchiveHref(set: SourceSetKey): string | null {
  const mock = set.source_type === MOCK_EXAM_SOURCE_TYPE;
  if (!mock && !set.textbook) return null;
  const patch = schoolExamFilterPatch({
    source_type: set.source_type, school_name: '', year: set.year, grade: set.grade,
    semester: set.semester, exam_type: set.exam_type,
  });
  return `/problems/archive${filtersToQueryString({ ...EMPTY_FILTERS, ...patch, ...(mock ? {} : { textbook: set.textbook }) })}`;
}

/**
 * 읽기 전용 시험 보기 주소.
 * @param id - 출처 id
 * @returns '/problems/sets/exam/<id>'
 */
export function examViewHref(id: string): string {
  return `${SETS_PATH}/exam/${encodeURIComponent(id)}`;
}
