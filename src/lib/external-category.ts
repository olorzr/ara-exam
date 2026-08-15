import { MIDDLE_SCHOOL_GRADES, HIGH_SCHOOL_GRADES } from './constants';
import { kstYear } from './kst-year';

/**
 * 년도/학년이 정해지지 않은 상태를 나타내는 Select 표시값.
 * DB 에는 빈 문자열('')로 저장한다 — base-ui Select 는 빈 문자열 value 를 다루기
 * 까다롭고 onValueChange 가 `string | null` 을 주므로(CLAUDE.md Known Issues),
 * 센티널 문자열 ↔ '' 변환을 이 모듈 한 곳에서만 처리한다.
 * '미지정' 은 실제 년도('2026')나 학년('중2')과 겹칠 수 없어 안전하다.
 */
export const UNSPECIFIED_OPTION = '미지정';

/** 년도 Select 에 항상 노출할 롤링 윈도 범위 (올해 기준 앞뒤) */
const YEAR_WINDOW_FORWARD = 1;
const YEAR_WINDOW_BACK = 4;

/**
 * 외부지문 학년 옵션. 학교가 중학교일 수도 고등학교일 수도 있어 중등·고등을 모두 제공한다.
 */
export const EXTERNAL_GRADE_OPTIONS: string[] = [
  ...MIDDLE_SCHOOL_GRADES,
  ...HIGH_SCHOOL_GRADES,
  UNSPECIFIED_OPTION,
];

/**
 * Select 표시값을 DB 저장값으로 변환한다('미지정' → '').
 * @param value - Select 에서 선택된 표시값
 * @returns DB 에 저장할 값
 */
export function toStoredValue(value: string): string {
  return value === UNSPECIFIED_OPTION ? '' : value;
}

/**
 * DB 저장값을 Select 표시값으로 변환한다('' → '미지정').
 * @param value - DB 에서 읽은 값
 * @returns Select 에 넘길 표시값
 */
export function toOptionValue(value: string): string {
  return value === '' ? UNSPECIFIED_OPTION : value;
}

/**
 * 년도 Select 옵션 목록을 만든다.
 * 올해 기준 롤링 윈도(내년 ~ 4년 전)에, **데이터에 실제로 존재하는 년도를 합집합**으로
 * 더한다. 윈도만 쓰면 오래된 년도에 등록된 프린트가 목록에서 영영 안 보이게 된다.
 * @param present - 현재 데이터에 존재하는 년도 값들(DB 저장 형식, '' 포함 가능)
 * @returns 내림차순 년도 목록 + 마지막에 '미지정'
 */
export function buildYearOptions(present: string[]): string[] {
  const base = kstYear();
  const years = new Set<string>();

  for (let y = base + YEAR_WINDOW_FORWARD; y >= base - YEAR_WINDOW_BACK; y--) {
    years.add(String(y));
  }
  for (const value of present) {
    if (value !== '') years.add(value);
  }

  const sorted = [...years].sort((a, b) => Number(b) - Number(a));
  return [...sorted, UNSPECIFIED_OPTION];
}
