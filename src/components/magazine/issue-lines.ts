/** 영문 달 이름 — 머리띠 오른쪽 위의 'NOVEMBER' */
const MONTHS_EN = [
  'JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE',
  'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER',
] as const;

/**
 * 잡지 머리띠 오른쪽 위의 호수 두 줄 — 달이 곧 호수다(NO. 11 / 2026 NOVEMBER).
 * @param date - 기준 날짜
 * @returns [호수 줄, 연·달 줄]
 */
export function issueLines(date: Date): [string, string] {
  const month = date.getMonth();
  return [`NO. ${String(month + 1).padStart(2, '0')}`, `${date.getFullYear()} ${MONTHS_EN[month]}`];
}
