import type { PaperBlock, PaperProblemBlock, PassagePartBlock } from './blocks';
import { cutCandidatesOf, cutParagraph, isSplittablePartHtml, paragraphOf, partSignature } from './part-cuts';
import { measurePart, type PartMeasure } from './part-measure';
import { chunkPartBlocks } from './part-split-plan';
import { questionCuts, type QuestionRange, type QuestionUnit } from './question-units';

/**
 * 블록 종류마다 재는 법과 자르는 법 — 언제 어디서 자를지(part-split-plan.ts)는 종류를 모른다.
 * 쪼갤 수 있는 것은 지문 글 조각과 글 문항 둘이다.
 */

/** 쪼갤 수 있는 블록 하나 */
export interface SplitTarget {
  /** 측정 컨테이너의 블록을 잰다. 상태와 다른 것이 그려져 있으면(갱신이 겹쳤다) null */
  measure(blockEl: HTMLElement): PartMeasure | null;
  /** 정해진 후보 번호에서 자른 블록들. 못 자르면 그대로 한 개 */
  cut(cuts: readonly number[]): PaperBlock[];
}

/** 조각이 맡은 범위 */
function rangeOf(block: PaperProblemBlock): QuestionRange {
  return block.range ?? { from: 0, to: block.units.length };
}

/**
 * 문항의 자르기 후보 — 단위 경계들 + 맨 뒤의 '간격만 떼기'.
 *
 * 내용은 남은 자리에 드는데 문항 사이 간격(94px)만 안 들어가면, 마지막 선지 하나를 다음 단으로 밀 까닭이 없다.
 * 그 뒤는 어차피 다음 단이라 간격을 떼면 통째로 앉는다. 뒤 조각이 없는 자르기라 후보 번호가 범위 끝(`to`)이다.
 * @param block - 문항 블록
 * @returns 오름차순 단위 번호들
 */
export function questionCutsOf(block: PaperProblemBlock): number[] {
  const range = rangeOf(block);
  const cuts = questionCuts(block.units, range);
  return range.to === block.units.length && !block.tight ? [...cuts, range.to] : cuts;
}

/** 계산된 px 값 — 읽지 못하면 0 */
function px(value: string): number {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * 단위 요소 아래로 조각 안에 남는 여백 — 상자 끝의 아래 여백은 단위 상자를 뚫고 나가 재는 값에 안 든다.
 * 문단의 2pt 는 조각 끝이 되면 사라져 더 재게 되는데, 넘치는 쪽이 아니라 그대로 둔다.
 */
function marginBelow(el: Element): number {
  const child = el.lastElementChild;
  return child ? px(getComputedStyle(child).marginBottom) : 0;
}

/** 이 단위로 조각이 시작할 때 맨 위에 생기는 여백 */
function marginAbove(el: HTMLElement, unit: QuestionUnit): number {
  if (unit.kind === 'choice') return el.parentElement ? px(getComputedStyle(el.parentElement).marginTop) : 0;
  const child = el.firstElementChild;
  return px(getComputedStyle(el).marginTop) + (child ? px(getComputedStyle(child).marginTop) : 0);
}

/** 문항을 잰다 — 후보마다 `단위[k−1]` 의 끝까지가 앞 조각이다 */
function measureQuestion(blockEl: HTMLElement, block: PaperProblemBlock): PartMeasure | null {
  const question = blockEl.querySelector<HTMLElement>('.pb-q');
  const range = rangeOf(block);
  const elements = question ? Array.from(question.querySelectorAll<HTMLElement>('[data-q-unit]')) : [];
  if (!question || elements.length !== range.to - range.from) return null;

  const box = blockEl.getBoundingClientRect();
  const elementOf = (unit: number) => elements[unit - range.from];
  const endOf = (unit: number) => elementOf(unit).getBoundingClientRect().bottom + marginBelow(elementOf(unit));
  const paddingTop = px(getComputedStyle(question).paddingTop);
  const totalHeight = endOf(range.to - 1) - box.top;
  const cuts = questionCutsOf(block);

  return {
    prefixHeights: cuts.map((k) => endOf(k - 1) - box.top),
    totalHeight,
    topChrome: 0,
    bottomChrome: Math.max(0, box.height - totalHeight),
    lineHeight: 0,
    continuationTop: cuts.map((k) => (k < range.to ? paddingTop + marginAbove(elementOf(k), block.units[k]) : 0)),
    minChunkPx: 0,
    ...(cuts.at(-1) === range.to ? { emptyTailCut: cuts.length - 1 } : {}),
  };
}

/**
 * 문항을 조각으로 — 번호 달기·출처·문항 사이 간격은 그리는 쪽이 범위를 보고 정한다.
 * @param block - 문항 블록
 * @param cuts - 자를 후보 번호들 (오름차순)
 * @returns 조각 블록들
 */
export function chunkQuestionBlocks(block: PaperProblemBlock, cuts: readonly number[]): PaperProblemBlock[] {
  const candidates = questionCutsOf(block);
  const { from, to } = rangeOf(block);
  const stops = cuts.map((cut) => candidates[cut]);
  const edges = [from, ...stops.filter((stop) => stop < to), to];
  const last = edges.length - 2;
  // 간격을 뗀 표시는 끝 조각에만 — 그 표시가 뒤 블록을 다음 단으로 보낸다
  const { tight, ...rest } = block;
  const endsTight = tight === true || stops.includes(to);
  return edges.slice(1).map((end, i) => ({
    ...rest,
    key: `${block.key}-s${i}`,
    range: { from: edges[i], to: end },
    ...(i === last && endsTight ? { tight: true as const } : {}),
  }));
}

/** 지문 문단을 잰다 — 상태의 HTML 과 다른 문단이면 재지 않는다 */
function measurePassagePart(blockEl: HTMLElement, part: PassagePartBlock): PartMeasure | null {
  const p = blockEl.querySelector('p');
  const stated = paragraphOf(part.html);
  if (!p || !stated || partSignature(p) !== partSignature(stated)) return null;
  const candidates = cutCandidatesOf(p);
  return candidates.length > 0 ? measurePart(blockEl, p, candidates) : null;
}

/** 지문 문단을 자른다 */
function cutPassagePart(part: PassagePartBlock, cuts: readonly number[]): PaperBlock[] {
  const p = paragraphOf(part.html);
  if (!p) return [part];
  const htmls = cutParagraph(p, cutCandidatesOf(p), cuts);
  return htmls.length < 2 ? [part] : chunkPartBlocks(part, htmls);
}

/**
 * 이 블록을 쪼갤 수 있으면 그 재는 법·자르는 법.
 * @param block - 인쇄 블록
 * @returns 쪼갤 수 없으면 null
 */
export function splitTargetOf(block: PaperBlock): SplitTarget | null {
  if (block.kind === 'passage-part' && isSplittablePartHtml(block.html)) {
    return {
      measure: (blockEl) => measurePassagePart(blockEl, block),
      cut: (cuts) => cutPassagePart(block, cuts),
    };
  }
  if (block.kind === 'problem' && questionCutsOf(block).length > 0) {
    return {
      measure: (blockEl) => measureQuestion(blockEl, block),
      cut: (cuts) => chunkQuestionBlocks(block, cuts),
    };
  }
  return null;
}
