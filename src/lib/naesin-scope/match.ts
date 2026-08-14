import type { Category } from '@/types';
import type { MatchOutcome, PublicTextbook } from './types';

/**
 * 내신 시험범위(단원 키 배열) → 단어 카테고리(exam.categories) 매칭 (순수 함수).
 *
 * 단원 키 규약(ara-system curriculumTextbooks.ts 와 동일):
 *   "대단원제목"                → 그 대단원의 모든 카테고리(소단원 전부)
 *   "대단원제목 > 소단원제목"   → 해당 소단원 카테고리만
 *
 * 제목은 텍스트 매칭이라 표기 차이에 취약하다 — 매칭 실패 키는 unmatchedUnits 로
 * 반드시 반환하며, 호출처는 이를 UI 에 표면화해야 한다(조용한 유실 금지).
 */

const SUB_UNIT_SEP = ' > ';

/** 공백 전부 제거 — 출판사 비교용 ('천재 교과서' ↔ '천재교과서') */
const stripAllWs = (s: string | null | undefined): string => (s ?? '').replace(/\s+/g, '');

/** trim + 내부 공백 collapse — 단원 제목 비교용 */
const norm = (s: string | null | undefined): string => (s ?? '').trim().replace(/\s+/g, ' ');

/** '1학기'·'2학기' 류 텍스트에서 학기 숫자 추출. 없으면 null(미지정 — 필터 통과) */
const semDigit = (s: string | null | undefined): string | null => {
  const m = (s ?? '').match(/[12]/);
  return m ? m[0] : null;
};

/**
 * 시험범위 단원 키들을 카테고리 목록과 대조해 자동 선택할 id 와 미매칭 키를 반환한다.
 * @param units 단원 키 배열 (school_exam_scopes.units)
 * @param textbook 슬롯에 연결된 교과서 — level/grade/publisher 가 후보 풀 필터 키
 * @param slotSemester 시험 슬롯의 학기 (카테고리 semester 가 다른 학기면 제외, 미지정은 통과)
 * @param categories 전체 카테고리 (exam/create 페이지가 이미 로드한 목록)
 */
export function matchScopeToCategories(
  units: string[],
  textbook: PublicTextbook,
  slotSemester: 1 | 2,
  categories: Category[],
): MatchOutcome {
  const pool = categories.filter(
    (c) =>
      c.level === textbook.school_level &&
      c.grade === textbook.grade &&
      stripAllWs(c.publisher) === stripAllWs(textbook.publisher) &&
      (semDigit(c.semester) === null || semDigit(c.semester) === String(slotSemester)),
  );

  const matchedIds = new Set<string>();
  const unmatchedUnits: string[] = [];

  for (const unit of units) {
    const sepIdx = unit.indexOf(SUB_UNIT_SEP);
    const found =
      sepIdx >= 0
        ? pool.filter(
            (c) =>
              norm(c.chapter) === norm(unit.slice(0, sepIdx)) &&
              norm(c.sub_chapter) === norm(unit.slice(sepIdx + SUB_UNIT_SEP.length)),
          )
        : pool.filter((c) => norm(c.chapter) === norm(unit));

    if (found.length === 0) unmatchedUnits.push(unit);
    else found.forEach((c) => matchedIds.add(c.id));
  }

  return { matchedIds: [...matchedIds], unmatchedUnits };
}
