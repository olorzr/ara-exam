/**
 * jsdom 은 배치를 하지 않는다 — 인쇄 엔진이 재는 값을 흉내 낸다(테스트 전용).
 *
 * 문단은 직계 `<br>` 수 + 1 줄이고(글이 길면 `PRINT_CHARS_PER_LINE` 자마다 한 줄), 지문 조각의 틀 군살은
 * `--first`·`--last` 표시를 따른다. `Range` 는 jsdom 에 `getBoundingClientRect` 가 없어서 정의한다.
 */

/** 흉내 낸 줄 높이(px) */
export const PRINT_LINE_H = 20;
/** 흉내 낸 한 줄 글자 수 */
export const PRINT_CHARS_PER_LINE = 40;
/** 첫 조각의 위 군살 */
export const PRINT_TOP_CHROME = 10;
/** 끝 조각의 아래 군살 */
export const PRINT_BOTTOM_CHROME = 12;
/** 문항 블록 높이 */
export const PRINT_QUESTION_H = 120;

const FOOTER_H = 20;

interface StubOptions {
  firstHeader: number;
  laterHeader: number;
}

const rect = (top: number, height: number) => ({
  height, width: 0, top, left: 0, right: 0, bottom: top + height, x: 0, y: top, toJSON: () => ({}),
});

/** 글 길이가 차지하는 줄 수 */
const wrapped = (text: string) => Math.max(1, Math.ceil(text.length / PRINT_CHARS_PER_LINE));

/** 문단의 앞 `count` 개 자식이 차지하는 줄 수 */
function linesOfNodes(p: Element, count: number): number {
  const nodes = Array.from(p.childNodes).slice(0, count);
  const breaks = nodes.filter((node) => node.nodeName === 'BR').length;
  if (breaks === 0) return wrapped(nodes.map((node) => node.textContent ?? '').join(''));
  return nodes[nodes.length - 1]?.nodeName === 'BR' ? breaks : breaks + 1;
}

/** 지문 조각의 위아래 군살 */
function chromeOf(el: Element): { top: number; bottom: number } {
  const piece = el.closest('.pb-passage-part') ?? el.querySelector('.pb-passage-part');
  return {
    top: piece?.classList.contains('pb-passage-part--first') ? PRINT_TOP_CHROME : 0,
    bottom: piece?.classList.contains('pb-passage-part--last') ? PRINT_BOTTOM_CHROME : 0,
  };
}

/** 문단의 자리 */
function paragraphRect(p: Element) {
  return rect(chromeOf(p).top, linesOfNodes(p, p.childNodes.length) * PRINT_LINE_H);
}

/** 측정 블록의 높이 */
function blockHeight(el: Element): number {
  if (el.querySelector('.pb-q')) return PRINT_QUESTION_H;
  const p = el.querySelector('.pb-passage-part p');
  if (!p) return Number((el as HTMLElement).dataset?.h ?? el.querySelector<HTMLElement>('[data-h]')?.dataset.h ?? 0);
  const { top, bottom } = chromeOf(el);
  return top + linesOfNodes(p, p.childNodes.length) * PRINT_LINE_H + bottom;
}

/**
 * 재는 함수들을 바꿔 끼운다 — `beforeAll` 에서 부른다.
 * @param options - 머리글 높이
 */
export function stubPrintLayout({ firstHeader, laterHeader }: StubOptions): void {
  Object.defineProperty(Element.prototype, 'getBoundingClientRect', {
    configurable: true,
    value(this: Element) {
      if (this.matches('[data-measure="footer"]')) return rect(0, FOOTER_H);
      if (this.matches('[data-measure="first-header"]')) return rect(0, firstHeader);
      if (this.matches('[data-measure="later-header"]')) return rect(0, laterHeader);
      if (this.tagName === 'P') return paragraphRect(this);
      return rect(0, blockHeight(this));
    },
  });

  Object.defineProperty(Range.prototype, 'getBoundingClientRect', {
    configurable: true,
    value(this: Range) {
      const { endContainer, endOffset } = this;
      const p = endContainer.nodeType === Node.TEXT_NODE ? endContainer.parentElement : endContainer as Element;
      if (!p) return rect(0, 0);
      const top = paragraphRect(p).top;
      if (endContainer.nodeType !== Node.TEXT_NODE) return rect(top, linesOfNodes(p, endOffset) * PRINT_LINE_H);
      return rect(top, wrapped((endContainer.textContent ?? '').slice(0, endOffset)) * PRINT_LINE_H);
    },
  });

  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
}
