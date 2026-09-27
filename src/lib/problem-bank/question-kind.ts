import type { QuestionType } from '@/types/problem-bank';

/**
 * 문항 **갈래** — 선생님이 말하는 '객관식/주관식' 두 가지 (순수 모듈).
 *
 * ⚠️ DB 의 `question_type` 은 셋(`'객관식'·'주관식'·'서술형'`)인데 갈래는 **둘**이다.
 *    '서술형' 은 '주관식' 갈래에 든다 — 선생님이 비율을 말할 때 그 둘을 가르지 않고,
 *    인쇄도 비객관식을 한 모양(답 쓰는 빈칸)으로 그린다.
 * ⚠️ 이 지도를 **여기 한 곳**에만 둔다. 필터 축(`filters.ts`)과 비율 담기(`type-mix.ts`)가
 *    각자 들고 있으면 언젠가 한쪽만 고쳐져 "필터로는 걸리는데 비율 담기에는 안 걸리는"
 *    문항이 생긴다.
 */

/** 문항 갈래 */
export type QuestionKind = 'objective' | 'subjective';

/** 갈래 필터 값. `''` 는 **전체**(조건을 만들지 않는다) */
export type QuestionKindFilter = '' | QuestionKind;

/** 갈래 → DB 의 `question_type` 값들 */
export const QUESTION_KIND_TYPES: Record<QuestionKind, readonly QuestionType[]> = {
  objective: ['객관식'],
  subjective: ['주관식', '서술형'],
};

/** 갈래 → 화면에 쓰는 이름 */
export const QUESTION_KIND_LABELS: Record<QuestionKind, string> = {
  objective: '객관식',
  subjective: '주관식·서술형',
};

/** 고르는 차례 — 객관식이 먼저다(문제지에 그 순서로 실린다) */
export const QUESTION_KINDS: readonly QuestionKind[] = ['objective', 'subjective'];

/**
 * 이 문항이 어느 갈래인가.
 * @param type - DB 의 문항 유형
 * @returns 갈래 ('객관식' 만 objective, 나머지는 전부 subjective)
 */
export function kindOf(type: QuestionType): QuestionKind {
  return type === '객관식' ? 'objective' : 'subjective';
}

/**
 * 주소·저장값에서 갈래 필터를 복원한다.
 *
 * 모르는 값은 **전체**로 본다 — 주소는 사람이 고쳐 칠 수 있는 자리라, 오타 하나로
 * 목록이 0건이 되면 왜 비었는지 알 수 없다.
 * @param raw - 주소 파라미터 값
 * @returns 갈래 필터
 */
export function parseQuestionKind(raw: string | null | undefined): QuestionKindFilter {
  return raw === 'objective' || raw === 'subjective' ? raw : '';
}
