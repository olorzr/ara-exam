import type { CutCandidate } from './part-cuts';
import { MIN_CHUNK_LINES } from './part-split-plan';

/**
 * 측정 컨테이너에 그려진 지문 문단을 잰다 (DOM 읽기).
 *
 * 문단 처음에서 자를 자리까지의 높이를 자리마다 재 두면, 어디서 잘라도 조각 높이를 다시 그리지 않고 계산할 수 있다.
 */

/** 10pt × 줄 높이 1.55 — 계산된 줄 높이를 못 읽었을 때만 쓴다 */
export const DEFAULT_LINE_HEIGHT_PX = 20.67;

/** 문단 하나의 실측값 */
export interface PartMeasure {
  /** 문단 위에서 자를 자리마다의 높이(px) — 후보 차례 */
  prefixHeights: number[];
  /** 문단 전체 높이 */
  totalHeight: number;
  /** 블록 위 끝에서 문단까지 — 말머리·윗선·위 여백. 쪼개면 첫 조각에만 남는다 */
  topChrome: number;
  /** 문단 아래에서 블록 끝까지 — 아랫선·아래 여백. 쪼개면 끝 조각에만 남는다 */
  bottomChrome: number;
  lineHeight: number;
  /**
   * 그 자리에서 자르면 뒤 조각 위에 새로 붙는 높이 — 후보 차례.
   * 산문은 뒤 조각이 줄 첫머리로 옮겨 앉아 한 줄 늘 수 있고, 문항은 뒤 조각에도 윗여백이 있다.
   */
  continuationTop: number[];
  /** 조각의 최소 높이 — 문단은 두 줄, 문항은 단위 수 규칙이 대신해 0 이다 */
  minChunkPx: number;
  /** 뒤 조각이 없는 자리(문항 사이 간격만 떼는 자르기)의 후보 번호 */
  emptyTailCut?: number;
}

/** 줄 높이 — 계산값이 없으면 자리 사이의 가장 작은 간격 */
function lineHeightOf(p: HTMLElement, prefixHeights: readonly number[]): number {
  const computed = Number.parseFloat(getComputedStyle(p).lineHeight);
  if (Number.isFinite(computed) && computed > 0) return computed;
  const gaps = prefixHeights.slice(1).map((height, i) => height - prefixHeights[i]).filter((gap) => gap > 0);
  return gaps.length > 0 ? Math.min(...gaps) : DEFAULT_LINE_HEIGHT_PX;
}

/**
 * 문단을 잰다.
 *
 * ⚠️ 글자 상자는 줄 상자보다 낮다(글꼴 높이 < 줄 높이). 범위의 아래 끝은 줄 바닥보다 줄 간격 반만큼 위라서,
 *    그대로 쓰면 조각이 그만큼 작게 재여 자리에 들어간다고 해 놓고 넘친다. 문단 전체를 같은 방법으로 재면
 *    그 차이가 나오므로 자리마다 더한다 — 글꼴이 바뀌어도 맞는다.
 * @param blockEl - 측정 블록 (`[data-measure="block"]`)
 * @param p - 그 안의 문단
 * @param candidates - `cutCandidatesOf(p)`
 * @returns 실측값
 */
export function measurePart(blockEl: HTMLElement, p: HTMLElement, candidates: readonly CutCandidate[]): PartMeasure {
  const block = blockEl.getBoundingClientRect();
  const para = p.getBoundingClientRect();
  const range = p.ownerDocument.createRange();
  range.selectNodeContents(p);
  const leading = Math.max(0, para.bottom - range.getBoundingClientRect().bottom);

  const prefixHeights = candidates.map((candidate) => {
    range.setStart(p, 0);
    if (candidate.kind === 'br') range.setEnd(p, candidate.index + 1);
    else range.setEnd(p.childNodes[candidate.index], candidate.offset);
    return range.getBoundingClientRect().bottom - para.top + leading;
  });

  const lineHeight = lineHeightOf(p, prefixHeights);
  const textCut = candidates.some((candidate) => candidate.kind === 'text');
  return {
    prefixHeights,
    totalHeight: para.bottom - para.top,
    topChrome: Math.max(0, para.top - block.top),
    bottomChrome: Math.max(0, block.bottom - para.bottom),
    lineHeight,
    continuationTop: candidates.map(() => (textCut ? lineHeight : 0)),
    minChunkPx: MIN_CHUNK_LINES * lineHeight - 0.5,
  };
}
