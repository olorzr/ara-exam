import type { Passage, Problem } from '@/types/problem-bank';
import { sortByReadingOrder } from './reading-order';

/**
 * 읽기 전용 시험 보기(`/problems/sets/exam/[id]`)의 차례와 묶기 (순수 함수).
 *
 * 규칙은 기출 공유 사이트의 시험 보기(exam-share `groupExam` + 서술형 뒤로 정렬)와 같다 — 시험지를 **처음부터
 * 끝까지 읽는** 화면이라:
 *  - 객관식·주관식이 먼저 번호 차례로, 서술형은 그 뒤에 번호 차례로 온다.
 *  - 같은 지문에 딸린 문항이 이어지면 한 덩어리다(지문을 한 번 찍고 문항을 잇는다).
 *  - 앞에서 이미 찍은 지문이 다시 나오면(보통 서술형) 본문을 또 찍지 않고 `repeatOf` 로 가리킨다.
 *  - 지문 없는 문항은 제자리에 둔다(이어지면 한 덩어리). 문항이 하나도 없는 지문은 읽는 차례로 맨 뒤에.
 * ⚠️ 문제 아카이브의 묶기(`groupByPassageInPlace`)·검수 화면의 차례를 쓰지 않는 까닭: 앞의 것은 떨어진 같은 지문을
 *    첫 자리로 모아 서술형을 객관식 사이로 끌어올리고, 뒤의 것은 지문 없는 문항을 전부 맨 뒤로 보낸다.
 */

/** 차례에 필요한 문항 칸 */
type OrderedProblem = Pick<Problem, 'id' | 'passage_id' | 'number' | 'question_type' | 'page_no'>;

/** 묶기에 필요한 지문 칸 */
type GroupedPassage = Pick<Passage, 'id' | 'page_no' | 'bbox'>;

/** 화면의 한 덩어리 */
export interface ExamViewBlock<P, Q> {
  /** 본문을 찍을 지문 — 처음 나올 때만 */
  passage: P | null;
  /** 앞에서 이미 찍은 지문을 다시 가리킬 때 — 본문 없이 '앞의 지문' 안내만 */
  repeatOf: P | null;
  problems: Q[];
}

/**
 * 문항 차례 — 서술형은 뒤로, 그 안에서 번호 차례(번호 없는 것은 뒤), 같으면 쪽 → id.
 * @param a - 문항
 * @param b - 문항
 * @returns 정렬 비교값
 */
export function compareExamProblems(a: OrderedProblem, b: OrderedProblem): number {
  const essay = Number(a.question_type === '서술형') - Number(b.question_type === '서술형');
  if (essay !== 0) return essay;
  if (a.number !== b.number) {
    if (a.number === null) return 1;
    if (b.number === null) return -1;
    return a.number - b.number;
  }
  return (a.page_no - b.page_no) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

/**
 * 지문과 문항을 화면 덩어리로 묶는다.
 * @param passages - 그 시험의 지문 전부
 * @param problems - 그 시험의 문항 전부(차례는 상관없다 — 여기서 정한다)
 * @returns 위에서 아래로 그릴 덩어리들
 */
export function groupExamItems<P extends GroupedPassage, Q extends OrderedProblem>(
  passages: readonly P[],
  problems: readonly Q[],
): ExamViewBlock<P, Q>[] {
  const byId = new Map(passages.map((p) => [p.id, p]));
  const shown = new Set<string>();
  const blocks: ExamViewBlock<P, Q>[] = [];

  for (const problem of [...problems].sort(compareExamProblems)) {
    const passage = problem.passage_id ? byId.get(problem.passage_id) ?? null : null;
    const last = blocks[blocks.length - 1];
    const lastPassage = last ? (last.passage ?? last.repeatOf) : null;
    // 같은 지문(또는 지문 없음)이 이어지면 그 덩어리에 잇는다
    if (last && (passage ? lastPassage?.id === passage.id : lastPassage === null)) {
      last.problems.push(problem);
      continue;
    }
    if (!passage) {
      blocks.push({ passage: null, repeatOf: null, problems: [problem] });
      continue;
    }
    const again = shown.has(passage.id);
    blocks.push({ passage: again ? null : passage, repeatOf: again ? passage : null, problems: [problem] });
    shown.add(passage.id);
  }

  for (const passage of sortByReadingOrder(passages.filter((p) => !shown.has(p.id)))) {
    blocks.push({ passage, repeatOf: null, problems: [] });
  }
  return blocks;
}
