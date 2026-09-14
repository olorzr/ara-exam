import { PERCENTAGE_BASE } from './constants';

/**
 * 합격 기준 개수 — 백분율과 문항 수로 계산한다.
 *
 * ⚠️ **네 곳이 1:1 미러다.** 하나만 바꾸면 인쇄물의 '합격 N개 이상' 과 학원 성적의
 *    합격/불합격 판정이 어긋난다(선생님은 시험지를 믿고 학부모는 성적표를 믿는다):
 *      ① exam.create_exam_with_words RPC — `CEIL(p_pass_percentage::numeric / 100 * v_total)`
 *      ② 이 함수
 *      ③ ara-system migration 477 (register_concept_exam 의 v_pass)
 *      ④ ara-system scripts/backfill-araexam-grades.js
 *
 * 올림(CEIL)인 이유: 80% 기준에 17문항이면 13.6개 → 14개를 맞아야 합격이다.
 * 내림이면 13개(76%)로도 합격이 되어 기준보다 느슨해진다.
 *
 * ⚠️ **반드시 곱한 뒤에 나눈다.** `(pct / 100) * total` 로 쓰면 2진 부동소수 오차가 먼저 생겨
 *    55% × 100문항이 `55.00000000000001` 이 되고 올림에서 **56** 이 된다(실측).
 *    Postgres 는 numeric(10진) 이라 정확히 55 를 주므로, 그대로 두면 인쇄물과 성적의
 *    합격 기준이 딱 떨어지는 숫자에서만 하나씩 어긋난다 — 가장 찾기 어려운 종류의 불일치다.
 *
 * @param passPercentage - 합격 기준 백분율(0~100)
 * @param totalQuestions - 전체 문항 수
 * @returns 합격에 필요한 최소 정답 개수 (문항이 없으면 0)
 */
export function passCountOf(passPercentage: number, totalQuestions: number): number {
  if (!Number.isFinite(passPercentage) || !Number.isFinite(totalQuestions)) return 0;
  if (totalQuestions <= 0) return 0;
  const pct = Math.max(0, Math.min(PERCENTAGE_BASE, passPercentage));
  return Math.ceil((pct * totalQuestions) / PERCENTAGE_BASE);
}

/**
 * 합격 기준 백분율 정리 — 입력칸·저장값 공용. 정수 0~100 밖은 기본값으로 되돌린다.
 *
 * @param value - 사용자가 친 값(빈 칸·문자열·범위 밖 가능)
 * @param fallback - 값이 쓸 수 없을 때 쓸 기본값
 * @returns 0~100 정수
 */
export function clampPassPercentage(value: unknown, fallback: number): number {
  const num = typeof value === 'number' ? value : parseFloat(String(value ?? ''));
  if (!Number.isFinite(num)) return fallback;
  return Math.max(0, Math.min(PERCENTAGE_BASE, Math.round(num)));
}
