import { kindOf, QUESTION_KINDS, type QuestionKind } from '@/lib/problem-bank/question-kind';
import { shuffle } from '@/lib/shuffle';
import type { QuestionType } from '@/types/problem-bank';

/**
 * **유형 비율로 담기** 의 계산과 뽑기 (순수 모듈).
 *
 * 선생님이 "객관식 80 · 주관식 20" 처럼 비율만 정하면 지금 조건에 걸린 문항에서 그만큼
 * 무작위로 골라 담는다. 화면은 이 함수들이 돌려준 값을 그리기만 한다.
 */

/**
 * 한 번에 살펴볼 수 있는 풀의 최대 크기.
 *
 * ⚠️ PostgREST 한 요청의 기본 상한과 같다 — 넘으면 **조용히 잘린 목록**을 전부로 보고
 *    뽑게 된다. 그래서 넘치면 뽑지 않고 조건을 좁히라고 말한다(`poolTooBigMessage`).
 */
export const TYPE_MIX_POOL_MAX = 1000;

/** 창을 열 때의 기본 문항 수 */
export const TYPE_MIX_DEFAULT_TOTAL = 20;

/** 창을 열 때의 기본 객관식 비율(%) */
export const TYPE_MIX_DEFAULT_OBJECTIVE_PERCENT = 80;

/** 비율 버튼 — 객관식 비율(%) */
export const TYPE_MIX_PRESETS: readonly { label: string; percent: number }[] = [
  { label: '객관식만', percent: 100 },
  { label: '8 : 2', percent: 80 },
  { label: '7 : 3', percent: 70 },
  { label: '5 : 5', percent: 50 },
  { label: '주관식만', percent: 0 },
];

/**
 * 뽑기에 필요한 최소한의 문항 정보.
 *
 * ⚠️ 본문(`stem_html`)을 읽지 않는다 — 풀이 1,000행이면 그것만으로 몇 메가바이트다.
 *    담을 문항이 정해진 **뒤에** 그 id 로만 전체 행을 읽는다.
 */
export interface TypeMixRow {
  id: string;
  /** 지문 없는 단독 문항은 null */
  passage_id: string | null;
  question_type: QuestionType;
}

/** 갈래별 개수 */
export type KindCounts = Record<QuestionKind, number>;

/** 비율을 문항 수로 옮긴 결과 */
export interface TypeMixPlan {
  /** 비율대로라면 담아야 할 수 */
  want: KindCounts;
  /** 풀에 있는 만큼만 줄인, 실제로 담을 수 */
  take: KindCounts;
  /** 모자란 수 (want - take) */
  short: KindCounts;
}

/** 갈래 칸이 0인 개수표 */
const zeroCounts = (): KindCounts => ({ objective: 0, subjective: 0 });

/**
 * 정수로 가둔다 — 사람이 친 숫자 칸을 그대로 받으므로 NaN·음수·범위 밖이 들어온다.
 * @param value - 들어온 값
 * @param min - 하한
 * @param max - 상한 (하한보다 작으면 하한을 쓴다)
 * @returns 범위 안의 정수
 */
export function clampInt(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  const top = Math.max(min, max);
  return Math.min(top, Math.max(min, Math.trunc(value)));
}

/**
 * 아직 안 담긴 문항을 갈래별로 센다.
 * @param rows - 풀
 * @param added - 이미 담긴 문항 id
 * @returns 갈래별 개수
 */
export function countUnaddedByKind(
  rows: readonly TypeMixRow[], added: ReadonlySet<string>,
): KindCounts {
  const counts = zeroCounts();
  for (const row of rows) {
    if (added.has(row.id)) continue;
    counts[kindOf(row.question_type)] += 1;
  }
  return counts;
}

/**
 * 비율을 갈래별 문항 수로 옮긴다.
 *
 * ⚠️ **모자란 갈래를 다른 갈래로 채우지 않는다.** 주관식이 둘뿐인데 8:2 로 20문항을 부르면
 *    객관식 18개로 채우고 싶어지지만, 그러면 선생님이 정한 비율이 거짓이 된다 —
 *    모자란 만큼 덜 담고 창에서 미리 알린다(`shortfallMessage`).
 * @param total - 담고 싶은 문항 수
 * @param objectivePercent - 객관식 비율 (0~100)
 * @param available - 풀에 남은 갈래별 개수
 * @returns 바란 수·담을 수·모자란 수
 */
export function planTypeMix(
  total: number, objectivePercent: number, available: KindCounts,
): TypeMixPlan {
  const count = clampInt(total, 0, Number.MAX_SAFE_INTEGER);
  const percent = clampInt(objectivePercent, 0, 100);
  // 객관식을 먼저 정하고 **나머지 전부**를 주관식으로 준다 — 둘을 따로 반올림하면
  // 합이 1 모자라거나 남는다(20문항 33% → 7 + 13)
  const objective = Math.round((count * percent) / 100);
  const want: KindCounts = { objective, subjective: count - objective };

  const take = zeroCounts();
  const short = zeroCounts();
  for (const kind of QUESTION_KINDS) {
    take[kind] = Math.min(want[kind], Math.max(0, available[kind]));
    short[kind] = want[kind] - take[kind];
  }
  return { want, take, short };
}

/** 뽑기에 쓰는 한 항목 — 풀에서의 자리를 함께 든다 */
interface Candidate {
  row: TypeMixRow;
  /** 풀에서의 index = 읽는 순서 */
  order: number;
}

/**
 * 갈래별 quota 만큼 무작위로 뽑는다.
 *
 * ⚠️ **지문 묶음 단위로 걷는다.** 여기저기서 한 문항씩 뽑으면 지문 하나에 문항 하나가
 *    실려 쪽만 늘고, 학생은 긴 글을 읽고 한 문제만 푼다. 묶음 순서와 **묶음 안 순서**를
 *    모두 섞어야 어느 지문이든·그 지문의 어느 문항이든 뽑힐 수 있다(묶음 안을 안 섞으면
 *    언제나 그 지문의 앞 문항만 나온다).
 * ⚠️ 고른 것은 **풀의 자리(읽는 순서)로 되돌려** 돌려준다. 풀이 읽는 순서라 같은 지문의
 *    문항은 풀에서 이웃하므로, 되돌리면 캔버스에서 붙어 `isContiguous` 를 지킨다 —
 *    흩어지면 저장할 때 '같은 지문의 문항이 떨어져 있다' 로 막힌다.
 * @param rows - 풀 (읽는 순서)
 * @param take - 갈래별로 뽑을 수
 * @param added - 이미 담긴 문항 id (뽑지 않는다)
 * @param shuffleFn - 섞는 함수 (테스트가 결정적 함수를 넣는다)
 * @returns 읽는 순서로 되돌린 뽑힌 문항
 */
export function sampleTypeMix(
  rows: readonly TypeMixRow[],
  take: KindCounts,
  added: ReadonlySet<string>,
  shuffleFn: <T>(arr: readonly T[]) => T[] = shuffle,
): TypeMixRow[] {
  const left: KindCounts = { ...take };
  if (left.objective <= 0 && left.subjective <= 0) return [];

  // 읽는 순서 그대로 지문 묶음을 만든다. 지문 없는 문항은 저마다 홀로 선 묶음이다
  const groups: Candidate[][] = [];
  const byPassage = new Map<string, Candidate[]>();
  rows.forEach((row, order) => {
    if (added.has(row.id)) return;
    const candidate: Candidate = { row, order };
    if (row.passage_id === null) {
      groups.push([candidate]);
      return;
    }
    const group = byPassage.get(row.passage_id);
    if (group) group.push(candidate);
    else {
      const fresh = [candidate];
      byPassage.set(row.passage_id, fresh);
      groups.push(fresh);
    }
  });

  const picks: Candidate[] = [];
  for (const group of shuffleFn(groups)) {
    if (left.objective <= 0 && left.subjective <= 0) break;
    for (const candidate of shuffleFn(group)) {
      const kind = kindOf(candidate.row.question_type);
      if (left[kind] <= 0) continue;
      left[kind] -= 1;
      picks.push(candidate);
    }
  }

  return picks.sort((a, b) => a.order - b.order).map((c) => c.row);
}

/**
 * 풀이 한 번에 살펴볼 수 있는 크기를 넘었을 때의 안내 — 괜찮으면 null.
 * @param total - 조건에 걸린 전체 문항 수
 * @returns 안내 문구. 살펴볼 수 있으면 null
 */
export function poolTooBigMessage(total: number): string | null {
  if (total <= TYPE_MIX_POOL_MAX) return null;
  return `이 조건에 ${total}문항이 걸려 한 번에 살펴볼 수 없어요`
    + ` (${TYPE_MIX_POOL_MAX}문항까지).`
    + ' 학년·시험처럼 조건을 더 걸어 좁혀 주세요.';
}

/**
 * 비율대로 채우지 못했을 때의 안내 — 다 채웠으면 null.
 *
 * 담기 **전에** 말해 준다. 담고 나서 개수만 다르면 왜 적게 들어왔는지 알 수 없다.
 * @param plan - 계산 결과
 * @returns 안내 문구. 모자람이 없으면 null
 */
export function shortfallMessage(plan: TypeMixPlan): string | null {
  const parts = QUESTION_KINDS
    .filter((kind) => plan.short[kind] > 0)
    .map((kind) => `${kind === 'objective' ? '객관식' : '주관식'} ${plan.short[kind]}문항`);
  if (parts.length === 0) return null;
  return `${parts.join(' · ')}이 모자라요 — 그만큼 덜 담습니다.`
    + ' 다른 갈래로 채우지 않아요(비율이 달라집니다).';
}
