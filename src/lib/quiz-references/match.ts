import { KIND_BONUS, MATCH_MIN_SCORE, MATCH_WEIGHTS } from './constants';
import type { CandidateHit, MatchHit, MatchSignal, RankedReference } from './types';

/**
 * 찾아 온 자료들에 점수를 매겨 줄 세운다 (순수 함수).
 *
 * 조회는 신호마다 따로 돈다(`.or()` 를 못 쓰므로) — 그래서 같은 자료가 여러 번 온다.
 * 여기서 `key` 로 합치고, **신호 하나는 한 번만** 센다(같은 신호의 쿼리가 둘이어도
 * 점수가 두 배가 되지 않는다).
 *
 * ⚠️ 자동으로 붙이는 이상 **왜 골랐는지 반드시 함께 돌려준다**(`reason`). 근거 없이 붙으면
 *    엉뚱한 자료가 끼었을 때 선생님이 고칠 실마리가 없다.
 */

/** 까닭을 적을 때의 신호 순서 — 강한 것부터 */
const REASON_ORDER: MatchSignal[] = ['title', 'unit', 'school', 'author', 'body'];

/**
 * 맞은 신호들을 한 줄 까닭으로.
 * @param hits - 그 자료가 걸린 신호들
 * @returns `제목에 '봄봄' · 같은 단원 (천재 · 1. 문학의 갈래)`
 */
export function matchReason(hits: readonly MatchHit[]): string {
  const seen = new Map<MatchSignal, string>();
  for (const hit of hits) if (!seen.has(hit.signal)) seen.set(hit.signal, hit.detail);
  return REASON_ORDER.filter((signal) => seen.has(signal))
    .map((signal) => seen.get(signal)!)
    .join(' · ');
}

/** 줄 세울 때 뺄 것들 */
export interface RankOptions {
  /** 사람이 뺀 자료 — 다시 붙이지 않는다 */
  dismissed: ReadonlySet<string>;
  /** 이미 붙어 있는 자료 */
  attached: ReadonlySet<string>;
  /** 몇 건까지 고를 것인가 */
  limit: number;
}

/**
 * 후보를 합치고 점수를 매겨 고른다.
 * @param hits - 신호별 조회 결과를 이어 붙인 것
 * @param options - 뺄 자료와 개수
 * @returns 점수 높은 순으로 고른 자료들 (문턱 미만은 빠진다)
 */
export function rankReferenceCandidates(
  hits: readonly CandidateHit[],
  options: RankOptions,
): RankedReference[] {
  const grouped = new Map<string, { candidate: CandidateHit['candidate']; hits: MatchHit[] }>();
  for (const { candidate, hit } of hits) {
    // 사람이 뺐거나 이미 붙어 있으면 아예 세지 않는다
    if (options.dismissed.has(candidate.key) || options.attached.has(candidate.key)) continue;
    const found = grouped.get(candidate.key);
    if (found) found.hits.push(hit);
    else grouped.set(candidate.key, { candidate, hits: [hit] });
  }

  const ranked: RankedReference[] = [];
  for (const { candidate, hits: found } of grouped.values()) {
    // 같은 신호를 두 번 세지 않는다 — 쿼리가 둘이어도 '제목이 맞았다' 는 한 번이다
    const signals = new Set(found.map((hit) => hit.signal));
    let signalScore = 0;
    for (const signal of signals) signalScore += MATCH_WEIGHTS[signal];
    // ⚠️ 문턱은 **덤을 더하기 전**에 본다 — 덤까지 더해 견주면 '지은이만 같음'(2+1)처럼
    //    막으려던 약한 신호 하나가 그대로 통과한다(코덱스 리뷰). 덤은 줄 세울 때만 쓴다
    if (signalScore < MATCH_MIN_SCORE) continue;
    const score = signalScore + KIND_BONUS[candidate.kind];
    ranked.push({ ...candidate, score, reason: matchReason(found) });
  }

  ranked.sort((a, b) => (
    b.score - a.score
    || b.updatedAt.localeCompare(a.updatedAt)
    || a.label.localeCompare(b.label)
  ));
  return ranked.slice(0, Math.max(0, options.limit));
}
