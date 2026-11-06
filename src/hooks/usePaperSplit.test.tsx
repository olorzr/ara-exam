import { act, render } from '@testing-library/react';
import { createElement, useMemo } from 'react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { A4Document } from '@/components/print';
import { renderPaperBlocks } from '@/components/problem-paper/PaperPrintBlocks';
import { buildPaperBlocks, type PaperBlock, type PassagePartBlock } from '@/lib/problem-paper/blocks';
import type { PaperItemSnapshot, PaperSettings } from '@/types/problem-bank';
import { MAX_SPLIT_PASSES, PAPER_SPLIT_ADAPTER, usePaperSplit } from './usePaperSplit';
import { stubPrintLayout, PRINT_LINE_H } from '@/test-utils/print-layout-stub';

const SETTINGS: PaperSettings = { columns: 1, showScore: false, showSource: false, omr: false };

beforeAll(() => stubPrintLayout({ firstHeader: 60, laterHeader: 60 }));

const part = (html: string, over: Partial<PassagePartBlock> = {}): PassagePartBlock => ({
  kind: 'passage-part', key: `pp-${html.length}`, html, serif: false, first: false, last: false, ...over,
});
const poem = (lines: number) => `<p>${Array.from({ length: lines }, (_, i) => `행${i + 1}`).join('<br>')}</p>`;

function Sheet({ blocks, columns = 1, resetKey }: { blocks: PaperBlock[]; columns?: 1 | 2; resetKey?: unknown }) {
  const split = usePaperSplit(blocks, PAPER_SPLIT_ADAPTER, { resetKey });
  const nodes = useMemo(
    () => renderPaperBlocks({ blocks: split.blocks, settings: SETTINGS, imageUrls: new Map() }),
    [split.blocks],
  );
  return (
    <A4Document
      blocks={nodes}
      columns={columns}
      splittable={split.splittable}
      breakBefore={split.breakBefore}
      onSplitRequest={split.handleSplitRequest}
      className="pb-sheet"
      firstPageHeader={<div>머리</div>}
      laterPageHeader={<div>머리</div>}
    />
  );
}

/** 렌더마다 새 배열이면 훅이 원본이 바뀐 줄 안다 */
const LOGO_BLOCKS: PaperBlock[] = [part(poem(120))];

const stacked = (c: HTMLElement) => c.querySelector('.a4-stack') as HTMLElement;
const sheets = (c: HTMLElement) => Array.from(stacked(c).querySelectorAll<HTMLElement>('.a4-sheet'));
const linesIn = (el: HTMLElement) => Array.from(el.querySelectorAll('p'))
  .flatMap((p) => p.innerHTML.split('<br>'));

describe('usePaperSplit — 지문 문단', () => {
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

  it('표는 쪼개지 않는다', () => {
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

  it('다시 쪼개기 열쇠가 바뀌면 쪼갠 것을 버린다 — 그림이 높이를 바꾸면 옛 자리는 낡았다', () => {
    const blocks = [part(poem(120))];
    const { container, rerender } = render(<Sheet blocks={blocks} resetKey="a" />);
    const before = stacked(container).querySelectorAll('.pb-passage-part').length;
    expect(before).toBeGreaterThan(1);
    // 같은 줄이라 다시 쪼개면 같은 자리다 — 글자를 잃거나 겹치지 않고 다시 이어진다
    rerender(<Sheet blocks={blocks} resetKey="b" />);
    expect(linesIn(stacked(container))).toEqual(Array.from({ length: 120 }, (_, i) => `행${i + 1}`));
    expect(stacked(container).querySelectorAll('.pb-passage-part')).toHaveLength(before);
  });

  it('본문 그림이 뜨는 동안은 쪼개지 않는다', () => {
    const spy = vi.spyOn(HTMLImageElement.prototype, 'complete', 'get').mockReturnValue(false);
    const Pending = () => {
      const split = usePaperSplit<PaperBlock>(LOGO_BLOCKS, PAPER_SPLIT_ADAPTER);
      const nodes = renderPaperBlocks({ blocks: split.blocks, settings: SETTINGS, imageUrls: new Map() });
      return (
        <A4Document
          blocks={[...nodes, createElement('img', { key: 'i', alt: '', src: 'a.jpg' })]}
          splittable={[...split.splittable, false]}
          onSplitRequest={split.handleSplitRequest}
          firstPageHeader={<div>머리</div>}
        />
      );
    };
    const { container } = render(<Pending />);
    expect(stacked(container).querySelectorAll('.pb-passage-part')).toHaveLength(1);
    spy.mockRestore();
  });

  it('머리글 로고가 뜨는 중이어도 쪼갠다 — 로고는 높이가 정해져 있어 기다리면 영영 안 돈다', () => {
    const spy = vi.spyOn(HTMLImageElement.prototype, 'complete', 'get').mockReturnValue(false);
    const Logo = () => {
      const split = usePaperSplit<PaperBlock>(LOGO_BLOCKS, PAPER_SPLIT_ADAPTER);
      const nodes = renderPaperBlocks({ blocks: split.blocks, settings: SETTINGS, imageUrls: new Map() });
      return (
        <A4Document
          blocks={nodes}
          splittable={split.splittable}
          onSplitRequest={split.handleSplitRequest}
          firstPageHeader={createElement('img', { alt: '로고', src: 'logo.png' })}
        />
      );
    };
    const { container } = render(<Logo />);
    expect(stacked(container).querySelectorAll('.pb-passage-part').length).toBeGreaterThan(1);
    spy.mockRestore();
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

describe('usePaperSplit — 문항', () => {
  const question = (over: Partial<PaperItemSnapshot>): PaperItemSnapshot => ({
    number: 1, question_type: '객관식', stem_html: '<p>물음</p>', choices: ['가', '나', '다', '라', '마'], answer: '1',
    score: null, explanation_html: '', area_path: [], work_title: '', render_mode: 'text', image_path: '',
    figure_paths: [], passage: null,
    source: { source_type: '내신기출', title: '', school_name: '성수고', year: '2026', grade: '고1', exam_type: '중간', publisher: '' },
    ...over,
  });
  const stanza = (n: number) => `<p>${Array.from({ length: n }, (_, i) => `줄${i}`).join('<br>')}</p>`;
  const glyphsOf = (el: Element) => Array.from(el.querySelectorAll('.pb-q__choice-glyph')).map((g) => g.textContent);
  const draw = (items: PaperItemSnapshot[], showAnswers = false) => {
    const { container } = render(<Sheet blocks={buildPaperBlocks(items, showAnswers)} />);
    return stacked(container);
  };
  /** 낱장 본문의 자리를 거의 다 쓰는 앞 지문 — 뒤 문항이 단 바닥에서 시작한다 */
  const filler = (lines: number) => question({ stem_html: `<p>앞</p><blockquote data-box="보기">${stanza(lines)}</blockquote>`, choices: [] });

  it('〈보기〉와 앞 선지는 앞 쪽에, 나머지 선지는 다음 쪽에 — 선지가 차례대로 한 번씩이다', () => {
    const stack = draw([question({ stem_html: `<p>물음</p><blockquote data-box="보기">${stanza(40)}</blockquote>` })]);
    expect(glyphsOf(stack)).toEqual(['①', '②', '③', '④', '⑤']);
    expect(stack.querySelector('.a4-block--scaled')).toBeNull();
  });

  it('한 쪽보다 큰 문항도 줄어들지 않고 번호는 한 번이다', () => {
    const big = Array.from({ length: 4 }, () => stanza(16)).join('');
    const stack = draw([question({ stem_html: `<p>물음</p><blockquote data-box="보기">${big}</blockquote>` })]);
    expect(stack.querySelector('.a4-block--scaled')).toBeNull();
    expect(sheets(stack.parentElement as HTMLElement).length).toBeGreaterThan(1);
    expect(stack.querySelectorAll('.q-num--mint')).toHaveLength(1);
    expect(stack.querySelectorAll('.q-num--blank').length).toBeGreaterThan(0);
  });

  it('머리만 단 바닥에 남기지 않는다 — 앞 조각에는 머리 말고 단위가 하나 더 있다', () => {
    const stack = draw([filler(44), question({ number: 2, stem_html: '<p>물음 둘</p>' })]);
    stack.querySelectorAll('.pb-q:not(.pb-q--cont)').forEach((q) => {
      expect(q.querySelectorAll('[data-q-unit]').length).toBeGreaterThan(1);
    });
  });

  it('주관식 빈칸은 앞 단위와 떨어지지 않는다', () => {
    const stack = draw([filler(44), question({ number: 2, question_type: '서술형', stem_html: '<p>물음 둘</p><p>조건</p>', choices: [] })]);
    const blank = stack.querySelector('.pb-q__blank');
    expect(blank?.closest('.pb-q')?.querySelectorAll('[data-q-unit]').length).toBeGreaterThan(1);
  });

  it('간격을 떼고 앉힌 문항 뒤 자리에는 다음 문항이 붙지 않는다 — 다음 단에서 시작한다', () => {
    // 낱장 본문 ≈ 940, 앞 문항 748 → 남은 192 에 2번의 내용(126)은 들고 간격(94)은 안 든다.
    // 뗀 자리 66 에는 3번의 내용(46)이 들어갈 만해서, 막지 않으면 번호째 간격 없이 붙는다
    const stack = draw([filler(29), question({ number: 2 }), question({ number: 3, choices: ['가'] })]);
    const tight = Array.from(stack.querySelectorAll('.pb-q')).find((q) => q.querySelector('.q-num--mint')?.textContent === '02');
    expect(tight?.classList.contains('pb-q--split')).toBe(true);
    expect(tight?.closest('.a4-sheet')?.textContent).not.toContain('03');
  });

  it('자리에 다 드는 문항은 쪼개지 않는다', () => {
    const stack = draw([question({})]);
    expect(stack.querySelectorAll('.pb-q')).toHaveLength(1);
    expect(stack.querySelector('.pb-q--cont, .pb-q--split')).toBeNull();
  });

  it('교사용 답은 마지막 조각에 붙어 간다', () => {
    const stack = draw([question({ stem_html: `<p>물음</p><blockquote data-box="보기">${stanza(46)}</blockquote>` })], true);
    const answers = stack.querySelectorAll('.pb-q__answer');
    expect(answers).toHaveLength(1);
    expect(answers[0].closest('.pb-q')?.classList.contains('pb-q--split')).toBe(false);
  });
});
