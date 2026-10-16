import type { ExamWord } from '@/types';

/**
 * 단어 시험지 화면이 읽어 온 문항 스냅샷(`exam_words`)을 믿어도 되는가 (2026-10-15 리뷰 6번).
 *
 * ⚠️ 예전 화면은 시험 메타 조회의 오류만 보고, 문항 조회가 실패해도 `null` 을 빈 배열로 바꿔
 *    **빈 시험지를 정상처럼** 그리고 인쇄까지 열어 두었다. 메타에는 20문항이라고 적혀 있는데
 *    문제·정답·단어장이 비거나 모자란 채로 나간다. 그래서 세 가지를 가른다:
 *    - 조회 자체가 실패했다(`failed`)
 *    - 읽은 개수가 메타의 문항 수와 다르다(`count`) — 잘렸거나 일부만 왔다
 *    - 순서 번호가 0..n-1 로 이어지지 않는다(`order`) — 출제 순서를 믿을 수 없다
 *    셋 다 시험지·객관식 선지·정답을 **아예 만들지 않는다.** 부분 목록으로 선지를 다시 계산하면
 *    정상 정답처럼 보이는데 실제 시험과 어긋난다.
 *
 * 순서 규약은 `create_exam_with_words` 가 서버에서 `order_index = 배열 위치(0부터)` 로 굳힌다
 * (sql/10). 2026-10-15 운영 확인: 시험 180건 전부 개수가 맞고 순서가 0..n-1 로 이어진다.
 */

/** 문항 스냅샷이 쓸 수 없는 까닭 */
export type ExamWordsIssue =
  | { kind: 'failed' }
  | { kind: 'count'; expected: number; actual: number }
  | { kind: 'order' };

/**
 * 읽은 문항이 시험 메타와 맞는지 본다.
 * @param expected - 시험 메타의 문항 수(`exams.total_questions`)
 * @param rows - `order_index` 오름차순으로 읽은 문항
 * @returns 문제가 없으면 null
 */
export function checkExamWords(
  expected: number,
  rows: readonly Pick<ExamWord, 'order_index'>[],
): ExamWordsIssue | null {
  if (rows.length !== expected) return { kind: 'count', expected, actual: rows.length };
  for (let i = 0; i < rows.length; i += 1) {
    if (rows[i].order_index !== i) return { kind: 'order' };
  }
  return null;
}

/**
 * 사람에게 보일 말.
 * @param issue - `checkExamWords` 의 결과(또는 조회 실패)
 * @returns 안내 문장
 */
export function examWordsIssueMessage(issue: ExamWordsIssue): string {
  switch (issue.kind) {
    case 'failed':
      return '문항을 불러오지 못했어요. 이 상태로는 시험지와 정답을 만들 수 없어요.';
    case 'count':
      return `문항 ${issue.expected}개 중 ${issue.actual}개만 읽었어요. 빠진 채로 인쇄하면 문제와 정답이 어긋나요.`;
    case 'order':
      return '문항 순서를 확인하지 못했어요. 이 상태로 인쇄하면 정답이 어긋날 수 있어요.';
  }
}
