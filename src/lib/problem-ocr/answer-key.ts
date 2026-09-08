import { OCR_MAX_WARNINGS } from './constants';
import type { AnswerKeyRow } from './schema';
import type { ProblemDraft } from './merge';

/**
 * 정답표에서 읽은 값을 문항에 붙인다 (순수 함수).
 *
 * 문제 쪽과 정답표 쪽은 따로 읽는다 — 정답표는 시험지 맨 뒤나 별지에 있고,
 * 본문 OCR 과 같은 프롬프트로 읽으면 모델이 "문제를 풀어" 채우려는 유혹에 빠진다.
 *
 * ⚠️ **이미 있는 값은 덮어쓰지 않는다.** 사람이 검수하며 고친 정답을
 *    나중에 돌린 정답표 읽기가 되돌리면 안 된다.
 *
 * 배점은 붙이지 않는다(2026-09-08) — 인쇄에 쓰지 않으므로 읽지도 않는다.
 */

/** 붙이기 결과 */
export interface ApplyAnswerKeyResult {
  /** 정답이 채워진 문항 수 */
  filled: number;
  /** 정답표에는 있는데 붙일 문항을 못 찾은 번호 */
  unmatched: number[];
  /** 이미 있던 값과 정답표가 다른 문항 — 덮어쓰지 않고 알리기만 한다 */
  conflicts: { number: number; current: string; fromKey: string }[];
  warnings: string[];
}

/** 객관식 정답으로 인정하는 형태 */
const CHOICE_ANSWER = /^[1-5]$/;

/**
 * 정답표 값을 문항 목록에 반영한다. 목록은 **제자리에서** 수정된다.
 * @param problems - 대상 문항 (merge 결과 또는 DB 에서 읽은 행)
 * @param answers - 정답표에서 읽은 줄
 * @returns 채운 개수·못 붙인 번호·충돌 목록
 */
export function applyAnswerKey(
  problems: ProblemDraft[],
  answers: AnswerKeyRow[],
): ApplyAnswerKeyResult {
  const byNumber = new Map<number, ProblemDraft[]>();
  for (const p of problems) {
    if (p.number === null) continue;
    const list = byNumber.get(p.number);
    if (list) list.push(p);
    else byNumber.set(p.number, [p]);
  }

  const result: ApplyAnswerKeyResult = {
    filled: 0,
    unmatched: [],
    conflicts: [],
    warnings: [],
  };

  for (const row of answers) {
    const targets = byNumber.get(row.no);
    if (!targets || targets.length === 0) {
      result.unmatched.push(row.no);
      continue;
    }

    // 같은 번호가 여럿이면(문제집처럼 절마다 번호가 반복) 어느 것인지 알 수 없다.
    // 잘못 붙이는 것보다 안 붙이는 게 낫다.
    if (targets.length > 1) {
      result.warnings.push(
        `${row.no}번이 여러 곳에 있어 정답을 붙이지 않았어요. 검수에서 직접 넣어 주세요.`,
      );
      continue;
    }

    const target = targets[0];
    let touched = false;

    if (target.answer === null || target.answer === '') {
      target.answer = row.answer;
      // 정답 모양으로 유형을 바로잡는다 — 본문만 보고 유형을 잘못 판단했을 수 있다
      if (CHOICE_ANSWER.test(row.answer)) {
        if (target.choices.length > 0) target.question_type = '객관식';
      } else if (target.question_type === '객관식') {
        target.question_type = '주관식';
      }
      touched = true;
    } else if (target.answer !== row.answer) {
      result.conflicts.push({ number: row.no, current: target.answer, fromKey: row.answer });
    }

    if (touched) result.filled += 1;
  }

  if (result.unmatched.length > 0) {
    result.warnings.push(
      `정답표에는 있는데 문항을 못 찾은 번호가 있어요: ${listSome(result.unmatched)}번`,
    );
  }
  if (result.conflicts.length > 0) {
    result.warnings.push(
      `이미 입력된 정답과 다른 문항이 있어요(덮어쓰지 않았어요): `
      + `${listSome(result.conflicts.map((c) => c.number))}번`,
    );
  }

  result.warnings = result.warnings.slice(0, OCR_MAX_WARNINGS);
  return result;
}

/** 번호를 몇 개만 보여 준다 — 20개가 줄줄이 나오면 아무도 안 읽는다 */
function listSome(numbers: number[], limit = 8): string {
  const uniq = [...new Set(numbers)].sort((a, b) => a - b);
  const head = uniq.slice(0, limit).join(', ');
  return uniq.length > limit ? `${head} 외 ${uniq.length - limit}개` : head;
}
