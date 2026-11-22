import type { PaperBlock } from './blocks';

/**
 * 줄여 찍히는 블록 → 선생님이 읽는 자리 이름(순수 함수).
 *
 * 인쇄 엔진은 한 쪽(단)에 다 안 들어가는 블록을 통째로 줄여 찍는다(`paginate.ts` 의 oversized). 쪼갤 수 없는 덩어리가
 * 그렇게 되면 글씨가 깨알같이 작아지는데, 지금까지는 인쇄해 보기 전에는 아무도 몰랐다(2026-09-27 큰 (가) 상자,
 * 2026-11-15 긴 줄바꿈 문단, 2026-11-22 (가) 안의 [A] — 같은 부류가 세 번 제보됐다). 그래서 보기 화면이 이 이름들로
 * 미리 알린다(PaperShrunkNotice). 원인이 무엇이든 축소 자체를 잡는다.
 */

/** 지문 머리글 `[20~23] 다음 글을…` 에서 범위만 */
const RANGE_IN_HEADER = /^\[([^\]]+)\]/;

/**
 * 지문 조각이 속한 지문의 이름 — 앞으로 거슬러 가장 가까운 지문 머리글의 범위로 부른다.
 * @param blocks - 인쇄 블록들
 * @param index - 지문 조각의 번호
 * @returns `20~23번 지문`, 머리글을 못 찾으면 `지문`
 */
function passageLabel(blocks: readonly PaperBlock[], index: number): string {
  for (let i = index; i >= 0; i -= 1) {
    const block = blocks[i];
    if (block.kind !== 'passage-header') continue;
    const range = RANGE_IN_HEADER.exec(block.text)?.[1];
    return range ? `${range}번 지문` : '지문';
  }
  return '지문';
}

/**
 * 블록 하나의 자리 이름.
 * @param blocks - 인쇄 블록들
 * @param index - 블록 번호
 * @returns 이름, 이름을 붙일 수 없는 블록(머리글·안내)이면 null
 */
function blockLabel(blocks: readonly PaperBlock[], index: number): string | null {
  const block = blocks[index];
  switch (block.kind) {
    case 'problem':
    case 'problem-image':
      return `${block.number}번`;
    case 'explanation-part':
      return `${block.number}번 해설`;
    case 'passage-part':
    case 'passage-figure':
    case 'passage-image':
      return passageLabel(blocks, index);
    default:
      return null;
  }
}

/**
 * 줄여 찍히는 블록들의 자리 이름 — 차례대로, 같은 이름은 한 번만.
 * @param blocks - 인쇄 블록들 (엔진에 넘긴 차례 그대로)
 * @param indices - 줄여 찍히는 블록 번호들 (`A4LayoutInfo.shrunkBlocks`)
 * @returns 이름들
 */
export function shrunkLabelsOf(blocks: readonly PaperBlock[], indices: readonly number[]): string[] {
  const labels: string[] = [];
  for (const index of indices) {
    if (index < 0 || index >= blocks.length) continue;
    const label = blockLabel(blocks, index);
    if (label && !labels.includes(label)) labels.push(label);
  }
  return labels;
}
