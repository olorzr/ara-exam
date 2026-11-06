import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cutCandidatesOf, paragraphOf } from './part-cuts';
import { DEFAULT_LINE_HEIGHT_PX, measurePart } from './part-measure';

const box = (top: number, bottom: number) => ({
  top, bottom, height: bottom - top, width: 0, left: 0, right: 0, x: 0, y: top, toJSON: () => ({}),
}) as DOMRect;

/** 줄 높이 20, 글자 상자는 줄 바닥보다 3px 위에서 끝난다, 문단은 위에서 10px 아래에서 시작한다 */
const LINE = 20;
const LEADING = 3;
const TOP = 10;

function setup(html: string, blockBottom: number) {
  const p = paragraphOf(html) as HTMLElement;
  const lines = p.querySelectorAll('br').length + 1;
  const block = document.createElement('div');
  block.appendChild(p);
  vi.spyOn(block, 'getBoundingClientRect').mockReturnValue(box(0, blockBottom));
  vi.spyOn(p, 'getBoundingClientRect').mockReturnValue(box(TOP, TOP + lines * LINE));
  return { block, p };
}

describe('measurePart', () => {
  beforeEach(() => {
    Object.defineProperty(Range.prototype, 'getBoundingClientRect', {
      configurable: true,
      value(this: Range) {
        const nodes = this.endContainer.nodeType === Node.TEXT_NODE
          ? [] : Array.from(this.endContainer.childNodes).slice(0, this.endOffset);
        const breaks = nodes.filter((node) => node.nodeName === 'BR').length;
        const line = nodes[nodes.length - 1]?.nodeName === 'BR' ? breaks : breaks + 1;
        return box(TOP, TOP + line * LINE - LEADING);
      },
    });
  });
  afterEach(() => {
    vi.restoreAllMocks();
    Reflect.deleteProperty(Range.prototype, 'getBoundingClientRect');
  });

  it('자리마다 문단 위에서의 높이를 재고, 글자 상자가 줄 바닥보다 위인 만큼을 되돌린다', () => {
    const { block, p } = setup('<p>가<br>나<br>다</p>', 100);
    expect(measurePart(block, p, cutCandidatesOf(p)).prefixHeights).toEqual([LINE, LINE * 2]);
  });

  it('문단 전체 높이와 위아래 군살을 따로 잰다', () => {
    const { block, p } = setup('<p>가<br>나<br>다</p>', 100);
    expect(measurePart(block, p, cutCandidatesOf(p))).toMatchObject({
      totalHeight: LINE * 3, topChrome: TOP, bottomChrome: 100 - TOP - LINE * 3,
    });
  });

  it('줄 높이는 계산값을 먼저 쓴다', () => {
    const { block, p } = setup('<p>가<br>나</p>', 100);
    vi.spyOn(window, 'getComputedStyle').mockReturnValue({ lineHeight: '17.5px' } as CSSStyleDeclaration);
    expect(measurePart(block, p, cutCandidatesOf(p)).lineHeight).toBe(17.5);
  });

  it('계산값이 없으면 자리 사이의 가장 작은 간격이다', () => {
    const { block, p } = setup('<p>가<br>나<br>다<br>라</p>', 100);
    vi.spyOn(window, 'getComputedStyle').mockReturnValue({ lineHeight: 'normal' } as CSSStyleDeclaration);
    expect(measurePart(block, p, cutCandidatesOf(p)).lineHeight).toBe(LINE);
  });

  it('간격도 없으면 기본값이다', () => {
    const { block, p } = setup('<p>가<br>나</p>', 100);
    vi.spyOn(window, 'getComputedStyle').mockReturnValue({ lineHeight: '' } as CSSStyleDeclaration);
    expect(measurePart(block, p, cutCandidatesOf(p)).lineHeight).toBe(DEFAULT_LINE_HEIGHT_PX);
  });

  it('문장 끝에서 잘린 뒤 조각에만 한 줄 몫을 더 잡는다 — 줄 첫머리로 옮겨 앉아 한 줄 늘 수 있다', () => {
    vi.spyOn(window, 'getComputedStyle').mockReturnValue({ lineHeight: '20px' } as CSSStyleDeclaration);
    const verse = setup('<p>가<br>나</p>', 100);
    expect(measurePart(verse.block, verse.p, cutCandidatesOf(verse.p)).continuationTop).toEqual([0]);
    const prose = setup('<p>첫째다. 둘째</p>', 100);
    expect(measurePart(prose.block, prose.p, cutCandidatesOf(prose.p)).continuationTop).toEqual([20]);
  });

  it('조각의 최소 높이는 두 줄이다', () => {
    vi.spyOn(window, 'getComputedStyle').mockReturnValue({ lineHeight: '20px' } as CSSStyleDeclaration);
    const { block, p } = setup('<p>가<br>나</p>', 100);
    expect(measurePart(block, p, cutCandidatesOf(p)).minChunkPx).toBe(39.5);
  });
});
