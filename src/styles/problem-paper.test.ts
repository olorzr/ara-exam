import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

/**
 * 실제 CSS 를 얹어 계산된 스타일로 본다(BookletStack.test.tsx 와 같은 방식). jsdom 은 배치를 못 해서 넘침 자체는
 * 못 재지만, 넘침을 막는 두 규칙이 빠지면 여기서 잡힌다. 실제 넘침은 헤드리스 크롬으로 쟀다(CLAUDE.md 0.9.68).
 */
describe('문제지 — 글이 단 밖으로 나가지 않게', () => {
  let style: HTMLStyleElement;
  let host: HTMLElement;

  beforeEach(() => {
    style = document.createElement('style');
    style.textContent = readFileSync(join(process.cwd(), 'src/styles/problem-paper.css'), 'utf8');
    document.head.appendChild(style);
    host = document.createElement('div');
    host.innerHTML = `
      <div class="pb-sheet pb-sheet--paper">
        <div class="pb-q">
          <p class="pb-q__source">출처</p>
          <div class="pb-q__head"><span class="q-num">1</span><div class="pb-q__stem"><p>물음</p></div></div>
          <table><tbody><tr><td>칸</td></tr></tbody></table>
          <table class="pb-q__paired-choices"><tbody><tr><td class="paired">칸</td></tr></tbody></table>
          <table><tbody><tr class="wide">${'<td>ㅴ</td>'.repeat(16)}</tr></tbody></table>
          <p><u class="pb-blank">　　</u></p>
        </div>
      </div>`;
    document.body.appendChild(host);
  });

  afterEach(() => {
    style.remove();
    host.remove();
  });

  const computed = (selector: string) => {
    const el = host.querySelector(selector);
    if (!el) throw new Error(`${selector} 가 없다`);
    return getComputedStyle(el);
  };

  it('발문은 안 글의 최소 폭에 밀려 늘어나지 않는다 — 〈보기〉 상자가 옆 단을 침범했다', () => {
    expect(computed('.pb-q__stem').getPropertyValue('min-width')).toMatch(/^0(px)?$/);
    expect(computed('.pb-q__stem').getPropertyValue('flex-grow')).toBe('1');
  });

  it('끊을 자리가 없는 글자열도 꺾는다 — 최소 폭을 안 바꾸는 break-word 다', () => {
    expect(computed('.pb-sheet').getPropertyValue('overflow-wrap')).toBe('break-word');
  });

  it('표 선지는 자리가 모자라면 꺾인다 — nowrap 이면 표가 단 밖으로 나간다', () => {
    expect(computed('td.paired').getPropertyValue('white-space')).not.toBe('nowrap');
    expect(computed('td.paired').getPropertyValue('overflow-wrap')).toBe('anywhere');
  });

  it('칸이 아주 많은 표만 칸 여백을 줄인다', () => {
    expect(computed('.wide td').getPropertyValue('padding-left')).toBe('1px');
    expect(computed('table:first-of-type td').getPropertyValue('padding-left')).toBe('5px');
  });

  it('빈칸은 통째로 다음 줄로 넘어간다 — 줄 끝에 걸치면 밑줄이 옆 단으로 뻗는다', () => {
    expect(computed('.pb-blank').getPropertyValue('white-space')).toBe('nowrap');
  });

  it('표 칸과 출처 줄은 제 규칙을 그대로 쓴다', () => {
    expect(computed('td').getPropertyValue('overflow-wrap')).toBe('anywhere');
    expect(computed('.pb-q__source').getPropertyValue('overflow-wrap')).toBe('anywhere');
  });
});
