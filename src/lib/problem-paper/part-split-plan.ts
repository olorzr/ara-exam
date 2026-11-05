import { paginate, type BreakBefore, type PaginateInput, type SplitRequest } from '@/lib/print/paginate';
import type { PassagePartBlock } from './blocks';
import type { PartMeasure } from './part-measure';

/**
 * 지문 문단을 어디서 자를지 정한다 (순수 함수 — 테스트의 중심).
 *
 * ⚠️ **한 라운드에 여러 곳을 정한다.** 엔진은 첫 요청의 자리만 정확하다고 말하는데(앞을 쪼개면 뒤가 밀린다),
 *    한 곳 자를 때마다 다시 그려 재면 측정 패스가 쪼갠 곳 수만큼 돈다. 그 패스는 레이아웃 효과 안의 setState 라
 *    **50번을 넘으면 React 가 오류를 던진다**(NESTED_UPDATE_LIMIT) — 긴 시가 많은 문제지와 책은 쉽게 넘는다.
 *    그래서 자른 높이를 계산해 넣고 `paginate` 를 **순수하게 다시 돌려** 다음 요청을 받는다. 다시 재면 계산이
 *    틀린 곳만 다음 패스에 고쳐진다.
 */

/** 조각마다 남길 최소 줄 수 — 단 머리·바닥에 한 줄만 외톨이로 남지 않게 */
export const MIN_CHUNK_LINES = 2;

/** 재기 오차 여유(px) — 딱 맞게 자른 조각이 반올림으로 밀리지 않게 */
export const SPLIT_SAFETY_PX = 2;

/** 한 라운드에 자르는 횟수의 안전 상한 — 진짜 종료 조건은 '자를수록 구간이 줄어든다' 이다 */
export const MAX_ROUND_CUTS = 2000;

/** 문단의 한 구간 — 자르기 후보 번호로 잰다. `from` 이 -1 이면 문단 처음, `to` 가 후보 수 이상이면 문단 끝 */
export interface PartSegment {
  from: number;
  to: number;
}

/** 아직 자르지 않은 문단 전체 */
export const WHOLE_SEGMENT: PartSegment = { from: -1, to: Number.POSITIVE_INFINITY };

/** 구간의 시작·끝 높이와 위아래 군살 */
function extentOf(m: PartMeasure, segment: PartSegment) {
  const opened = segment.from >= 0;
  const closed = segment.to < m.prefixHeights.length;
  return {
    start: opened ? m.prefixHeights[segment.from] : 0,
    end: closed ? m.prefixHeights[segment.to] : m.totalHeight,
    // 앞 조각은 정확하다. 문장 끝에서 잘린 뒤 조각은 줄 첫머리로 옮겨 앉아 한 줄 늘 수 있다
    top: opened ? (m.textCut ? m.lineHeight : 0) : m.topChrome,
    bottom: closed ? 0 : m.bottomChrome,
  };
}

/**
 * 구간의 블록 높이.
 * @param m - 문단 실측
 * @param segment - 구간
 * @returns 조각으로 그렸을 때의 높이(px)
 */
export function segmentHeight(m: PartMeasure, segment: PartSegment): number {
  const { start, end, top, bottom } = extentOf(m, segment);
  return top + end - start + bottom;
}

/**
 * 구간을 어디서 자를지 고른다 — 앞 조각이 지금 자리에 드는 가장 뒤쪽.
 *
 * 앞 자리에 2줄도 안 들어가면 구간을 통째로 다음 단으로 보내면 그만이다. 다음 단에도 안 들어갈 때만
 * 다음 단 크기로 자른다.
 * @param m - 문단 실측
 * @param segment - 구간
 * @param firstCapacity - 지금 자리의 남은 높이
 * @param laterCapacity - 다음 단의 높이
 * @returns 자를 후보 번호. 안 자르면 null
 */
export function pickCut(
  m: PartMeasure, segment: PartSegment, firstCapacity: number, laterCapacity: number,
): number | null {
  const { start, end, top } = extentOf(m, segment);
  const minPart = MIN_CHUNK_LINES * m.lineHeight - 0.5;
  const last = Math.min(segment.to, m.prefixHeights.length);

  const lastFitting = (capacity: number): number | null => {
    let best: number | null = null;
    for (let k = segment.from + 1; k < last; k += 1) {
      const height = m.prefixHeights[k] - start;
      const rest = end - m.prefixHeights[k];
      if (height >= minPart && rest >= minPart && top + height <= capacity - SPLIT_SAFETY_PX) best = k;
    }
    return best;
  };

  const lead = lastFitting(firstCapacity);
  if (lead !== null) return lead;
  return segmentHeight(m, segment) <= laterCapacity ? null : lastFitting(laterCapacity);
}

/** 시뮬레이션의 블록 자리 하나 */
interface Slot {
  /** 라운드를 시작할 때의 블록 자리 */
  origin: number;
  segment: PartSegment;
}

/** 요청들 가운데 처음으로 잘리는 것 */
function firstCut(
  requests: readonly SplitRequest[], slots: readonly Slot[], measureAt: (index: number) => PartMeasure | null,
) {
  for (const request of requests) {
    const { origin, segment } = slots[request.index];
    const measure = measureAt(origin);
    if (!measure) continue;
    const cut = pickCut(measure, segment, request.firstCapacity, request.laterCapacity);
    if (cut !== null) return { at: request.index, origin, segment, measure, cut };
  }
  return null;
}

/**
 * 한 라운드의 자르기를 전부 정한다.
 * @param input - 엔진이 방금 쓴 입력(실측 높이)
 * @param measureAt - 블록 자리의 문단 실측. 잴 수 없으면 null
 * @returns 블록 자리 → 자를 후보 번호들(오름차순). 없으면 빈 지도
 */
export function planSplitRound(
  input: PaginateInput, measureAt: (index: number) => PartMeasure | null,
): Map<number, number[]> {
  const heights = [...input.blockHeights];
  const splittable = heights.map((_, i) => input.splittable?.[i] ?? false);
  const breaks: BreakBefore[] = heights.map((_, i) => input.breakBefore?.[i] ?? false);
  const slots: Slot[] = heights.map((_, origin) => ({ origin, segment: WHOLE_SEGMENT }));
  const cuts = new Map<number, number[]>();

  for (let round = 0; round < MAX_ROUND_CUTS; round += 1) {
    const { splitRequests } = paginate({ ...input, blockHeights: heights, splittable, breakBefore: breaks });
    const hit = firstCut(splitRequests, slots, measureAt);
    if (!hit) break;
    const { at, origin, segment, measure, cut } = hit;
    const lead: PartSegment = { from: segment.from, to: cut };
    const rest: PartSegment = { from: cut, to: segment.to };
    // 앞 조각은 자리에 맞춰 잘랐으니 이번 라운드에는 더 안 쪼갠다. 뒤 조각은 엔진이 다시 자리를 알려 준다
    heights.splice(at, 1, segmentHeight(measure, lead), segmentHeight(measure, rest));
    splittable.splice(at, 1, false, true);
    breaks.splice(at, 1, breaks[at], false);
    slots.splice(at, 1, { origin, segment: lead }, { origin, segment: rest });
    cuts.set(origin, [...(cuts.get(origin) ?? []), cut].sort((a, b) => a - b));
  }
  return cuts;
}

/**
 * 조각 HTML 들을 블록으로 — 지문 틀·상자의 처음·끝 표시는 양 끝 조각에만 남는다.
 *
 * 이미 쪼갠 조각을 다시 쪼개면 그 조각의 표시를 그대로 이어 받는다(끝 조각의 `continues` 도).
 * @param part - 원래 블록
 * @param htmls - 조각 HTML 들 (둘 이상)
 * @returns 조각 블록들
 */
export function chunkPartBlocks(part: PassagePartBlock, htmls: readonly string[]): PassagePartBlock[] {
  const end = htmls.length - 1;
  return htmls.map((html, i) => {
    const { continues, box, ...rest } = part;
    return {
      ...rest,
      key: `${part.key}-s${i}`,
      html,
      first: part.first && i === 0,
      last: part.last && i === end,
      ...(i < end || continues ? { continues: true as const } : {}),
      ...(box ? { box: { ...box, first: box.first && i === 0, last: box.last && i === end } } : {}),
    };
  });
}
