import { normalizeCategoryName } from '@/lib/category-name';

/**
 * 작품명·지은이 표기 정규화 (순수 함수).
 *
 * ⚠️ `sql/20_problem_bank_works.sql` 의 `exam.normalize_work_title()` 과 **완전히 같은
 * 규칙**이어야 한다. 한쪽만 바꾸면 앱이 저장한 값과 트리거가 옮긴 값이 갈라져
 * 작품 트리에 같은 작품이 두 폴더로 보인다(`category-name.ts` ↔ sql/16 과 같은 계약).
 *
 * 배경: 작품 축은 문자열 완전 일치로 묶인다. 시험지는 작품명을 `「동백꽃」`·`<동백꽃>`·
 * `"동백꽃"` 등 제각각으로 인쇄하고 모델도 본 대로 옮기므로, 감싼 기호를 벗기지 않으면
 * 같은 작품이 서너 갈래로 쪼개진다.
 *
 * 안쪽 기호는 건드리지 않는다 — `봄봄 「동백꽃」` 처럼 두 작품을 한 칸에 적은 경우
 * 가운데 기호는 뜻이 있다.
 */

/** 작품명을 감싸는 기호들 — 낫표·겹낫표·꺾쇠·따옴표 */
const WRAPPER_CHARS = '「」『』〈〉《》＜＞<>“”‘’"\'';

/** 앞뒤에 붙은 감싸는 기호와 공백 */
const LEADING_WRAPPERS = new RegExp(`^[${WRAPPER_CHARS}\\s]+`);
const TRAILING_WRAPPERS = new RegExp(`[${WRAPPER_CHARS}\\s]+$`);

/**
 * 작품명·지은이를 표준 표기로.
 *
 * 감싼 기호 제거 → `normalizeCategoryName`(폭 없는 문자·NFC·전각 괄호·공백·괄호 주변).
 * 멱등이다.
 * @param name - 모델이 읽었거나 사람이 친 이름
 * @returns 표준 표기
 */
export function normalizeWorkTitle(name: string): string {
  return normalizeCategoryName(
    name.replace(LEADING_WRAPPERS, '').replace(TRAILING_WRAPPERS, ''),
  );
}
