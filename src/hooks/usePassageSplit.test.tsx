import { act, render } from '@testing-library/react';
import { useMemo } from 'react';
import { beforeAll, describe, expect, it } from 'vitest';
import { A4Document } from '@/components/print';
import { renderPaperBlocks } from '@/components/problem-paper/PaperPrintBlocks';
import type { PaperBlock, PassagePartBlock } from '@/lib/problem-paper/blocks';
import type { PaperSettings } from '@/types/problem-bank';
import { MAX_SPLIT_PASSES, PAPER_SPLIT_ADAPTER, usePassageSplit } from './usePassageSplit';
import { stubPrintLayout, PRINT_LINE_H } from '@/test-utils/print-layout-stub';

const SETTINGS: PaperSettings = { columns: 1, showScore: false, showSource: false, omr: false };

beforeAll(() => stubPrintLayout({ firstHeader: 60, laterHeader: 60 }));

const part = (html: string, over: Partial<PassagePartBlock> = {}): PassagePartBlock => ({
  kind: 'passage-part', key: `pp-${html.length}`, html, serif: false, first: false, last: false, ...over,
});
const poem = (lines: number) => `<p>${Array.from({ length: lines }, (_, i) => `행${i + 1}`).join('<br>')}</p>`;

function Sheet({ blocks, columns = 1 }: { blocks: PaperBlock[]; columns?: 1 | 2 }) {
  const split = usePassageSplit(blocks, PAPER_SPLIT_ADAPTER);
  const nodes = useMemo(
    () => renderPaperBlocks({ blocks: split.blocks, settings: SETTINGS, imageUrls: new Map() }),
    [split.blocks],
  );
  return (
    <A4Document
      blocks={nodes}
      columns={columns}
      splittable={split.splittable}
      onSplitRequest={split.handleSplitRequest}
      className="pb-sheet"
      firstPageHeader={<div>머리</div>}
      laterPageHeader={<div>머리</div>}
    />
  );
}

const stacked = (c: HTMLElement) => c.querySelector('.a4-stack') as HTMLElement;
const sheets = (c: HTMLElement) => Array.from(stacked(c).querySelectorAll<HTMLElement>('.a4-sheet'));
const linesIn = (el: HTMLElement) => Array.from(el.querySelectorAll('p'))
  .flatMap((p) => p.innerHTML.split('<br>'));

describe('usePassageSplit', () => {
  it('한 쪽을 넘는 긴 문단을 축소하지 않고 쪽마다 채워 잇는다', () => {
    const { container } = render(<Sheet blocks={[part(poem(120))]} />);
    expect(sheets(container).length).toBeGreaterThan(1);
    expect(stacked(container).querySelector('.a4-block--scaled')).toBeNull();
    expect(linesIn(stacked(container))).toEqual(Array.from({ length: 120 }, (_, i) => `행${i + 1}`));
  });

  it('앞 블록 뒤 남은 자리를 채운다 — 쪽을 비워 두고 통째로 넘어가지 않는다', () => {
    const body = 900; // 낱장 본문 높이보다 약간 작게
    const lead = `<p>${'앞 글 '.repeat(2)}</p>`;
    const { container } = render(
      <Sheet blocks={[part(lead), part(poem(Math.floor(body / PRINT_LINE_H)))]} />,
    );
    const [page] = sheets(container);
    expect(page.querySelectorAll('.a4-block').length).toBeGreaterThanOrEqual(2);
  });

  it('자리에 들어가는 문단은 쪼개지 않는다', () => {
    const { container } = render(<Sheet blocks={[part(poem(10))]} />);
    expect(stacked(container).querySelectorAll('.pb-passage-part')).toHaveLength(1);
    expect(stacked(container).querySelector('.pb-passage-part--continues')).toBeNull();
  });

  it('문단이 여럿이어도 한 번의 측정 패스 묶음으로 끝난다 — React 의 연쇄 갱신 상한에 닿지 않는다', () => {
    const blocks = Array.from({ length: 70 }, (_, i) => part(poem(33), { key: `pp-${i}` }));
    const { container } = render(<Sheet blocks={blocks} />);
    expect(stacked(container).querySelector('.a4-block--scaled')).toBeNull();
    expect(linesIn(stacked(container))).toHaveLength(70 * 33);
    expect(MAX_SPLIT_PASSES).toBeLessThan(50);
  });

  it('산문은 문장 끝에서만 갈린다', () => {
    const sentence = '이 문장은 일부러 길게 적어 둔 산문의 한 문장이다. ';
    const { container } = render(<Sheet blocks={[part(`<p>${sentence.repeat(120).trim()}</p>`)]} />);
    const parts = Array.from(stacked(container).querySelectorAll('.pb-passage-part p'));
    expect(parts.length).toBeGreaterThan(1);
    parts.forEach((p) => expect(p.textContent?.trim().endsWith('이다.')).toBe(true));
    expect(stacked(container).querySelector('.a4-block--scaled')).toBeNull();
  });

  it('문항 블록과 표는 쪼개지 않는다', () => {
    const table = '<table><tbody><tr><td>가<br>나</td></tr></tbody></table>';
    const { container } = render(<Sheet blocks={[part(table)]} />);
    expect(stacked(container).querySelectorAll('.pb-passage-part')).toHaveLength(1);
  });

  it('원본이 바뀌면 쪼갠 것을 버리고 처음부터 다시 쪼갠다', () => {
    const { container, rerender } = render(<Sheet blocks={[part(poem(120))]} />);
    expect(stacked(container).querySelectorAll('.pb-passage-part').length).toBeGreaterThan(1);
    rerender(<Sheet blocks={[part(poem(5))]} />);
    expect(stacked(container).querySelectorAll('.pb-passage-part')).toHaveLength(1);
  });

  it('글꼴이 오는 동안은 쪼개지 않고, 온 뒤의 측정에서 쪼갠다', async () => {
    let done = () => {};
    const fonts = { status: 'loading', ready: new Promise<void>((resolve) => { done = resolve; }) };
    Object.defineProperty(document, 'fonts', { configurable: true, value: fonts });
    const { container } = render(<Sheet blocks={[part(poem(120))]} />);
    expect(stacked(container).querySelectorAll('.pb-passage-part')).toHaveLength(1);

    fonts.status = 'loaded';
    await act(async () => { done(); });

    expect(stacked(container).querySelectorAll('.pb-passage-part').length).toBeGreaterThan(1);
    expect(stacked(container).querySelector('.a4-block--scaled')).toBeNull();
    Reflect.deleteProperty(document, 'fonts');
  });
});
