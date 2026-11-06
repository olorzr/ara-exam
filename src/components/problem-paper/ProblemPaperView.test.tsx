import { render } from '@testing-library/react';
import { beforeAll, describe, expect, it } from 'vitest';
import { stubPrintLayout } from '@/test-utils/print-layout-stub';
import type { PaperItemSnapshot, PaperPassageSnapshot, ProblemPaper } from '@/types/problem-bank';
import ProblemPaperView from './ProblemPaperView';

/**
 * 2026-11-06 제보를 그대로 세운다 — 최지은 선생님 문제지 「남신의주 유동 박시봉방」.
 * 머리글이 큰 1쪽에 (가) 뒤 (나) 33행 문단이 안 들어가, 1쪽을 거의 비워 두고 2쪽으로 통째로 넘어갔다.
 */

beforeAll(() => stubPrintLayout({ firstHeader: 700, laterHeader: 30 }));

const LINES = Array.from({ length: 33 }, (_, i) => `시구${i + 1}`);

const passage: PaperPassageSnapshot = {
  id: 'p1', label: '[1~2]', title: '', author: '', render_mode: 'text', image_path: '', figure_paths: [],
  html: `<blockquote data-box="가"><p>가1<br>가2<br>가3</p></blockquote>`
    + `<blockquote data-box="나"><p>${LINES.join('<br>')}</p><p style="text-align: right">-백석</p></blockquote>`
    + '<blockquote data-box="다"><p>다1<br>다2<br>다3</p></blockquote>',
};

const item = (number: number): PaperItemSnapshot => ({
  number, question_type: '객관식', stem_html: `<p>물음 ${number}</p>`, choices: ['가', '나', '다', '라', '마'],
  answer: '1', score: null, explanation_html: '', area_path: [], work_title: '', render_mode: 'text',
  image_path: '', figure_paths: [], passage,
  source: {
    source_type: '내신기출', title: '', school_name: '옥정고', year: '2025', grade: '고2', exam_type: '중간', publisher: '',
  },
});

const paper: ProblemPaper = {
  id: 'x', title: '남신의주 유동 박시봉방', settings: { columns: 2, showScore: false, showSource: false, omr: false },
  source_labels: [], total_questions: 2, user_id: 'u', updated_by: null,
  created_at: '2026-10-27T00:00:00Z', updated_at: '2026-10-27T00:00:00Z',
};

function draw() {
  const { container } = render(<ProblemPaperView paper={paper} items={[item(1), item(2)]} imageUrls={new Map()} />);
  return container.querySelector('.a4-stack') as HTMLElement;
}

describe('ProblemPaperView — 긴 시가 쪽을 넘을 때', () => {
  it('1쪽의 두 단을 채우고 이어진다 — 비워 두고 넘어가지 않는다', () => {
    const [first] = Array.from(draw().querySelectorAll<HTMLElement>('.a4-sheet'));
    const [left, right] = Array.from(first.querySelectorAll<HTMLElement>('.a4-col'));
    expect(left.textContent).toContain('시구1');
    expect(right.textContent).toContain('시구');
  });

  it('줄어들지 않는다', () => {
    expect(draw().querySelector('.a4-block--scaled')).toBeNull();
  });

  it('33행이 차례대로 한 번씩 찍힌다', () => {
    const text = Array.from(draw().querySelectorAll('.pb-passage-part p')).flatMap((p) => p.innerHTML.split('<br>'));
    expect(text.filter((line) => line.startsWith('시구'))).toEqual(LINES);
  });

  it('(나) 상자의 머리는 첫 조각에, 바닥은 출처 줄에만 있고 가운데 조각은 이어진다', () => {
    const boxes = Array.from(draw().querySelectorAll<HTMLElement>('blockquote[data-box="나"]'));
    expect(boxes.length).toBeGreaterThan(2);
    expect(boxes.filter((box) => box.classList.contains('pb-box-part--first'))).toEqual([boxes[0]]);
    expect(boxes.filter((box) => box.classList.contains('pb-box-part--last'))).toEqual([boxes[boxes.length - 1]]);
    boxes.slice(0, -2).forEach((box) => {
      expect(box.closest('.pb-passage-part')?.classList.contains('pb-passage-part--continues')).toBe(true);
    });
  });

  it('(다)와 문항이 시 뒤에 그대로 온다', () => {
    const text = draw().textContent ?? '';
    expect(text.indexOf('시구33')).toBeLessThan(text.indexOf('다1'));
    expect(text.indexOf('다3')).toBeLessThan(text.indexOf('물음 1'));
    expect(text.indexOf('물음 1')).toBeLessThan(text.indexOf('물음 2'));
  });
});

/**
 * 같은 날 두 번째 제보 — 「남신의주」 15·16번과 25번. 16번이 통째로 넘어가 왼쪽 단이 반 비고, 25번은 한 단보다 커서
 * 줄어 찍혔다. "문제를 다음 다단으로 넘기는 걸 만들어야 할 것 같음."
 */
describe('ProblemPaperView — 문항이 단을 넘을 때', () => {
  const stanza = (n: number) => `<p>${Array.from({ length: n }, (_, i) => `행${i + 1}`).join('<br>')}</p>`;
  const standalone = (number: number, stem: string): PaperItemSnapshot => ({ ...item(number), stem_html: stem, passage: null });
  const drawItems = (items: PaperItemSnapshot[]) => {
    const { container } = render(<ProblemPaperView paper={paper} items={items} imageUrls={new Map()} />);
    return container.querySelector('.a4-stack') as HTMLElement;
  };
  const columnsOf = (stack: HTMLElement) => Array.from(stack.querySelectorAll<HTMLElement>('.a4-col'))
    .filter((col) => col.children.length > 0);

  it('15번 아래에서 16번이 시작해 다음 단으로 이어진다 — 16번의 번호는 한 번이고 선지가 갈린다', () => {
    const stack = drawItems([
      { ...standalone(1, '<p>십오번 물음</p>'), choices: ['가', '나'] },
      standalone(2, `<p>십육번 물음</p><blockquote data-box="보기">${stanza(3)}</blockquote>`),
    ]);
    const [left, right] = columnsOf(stack);
    expect(left.textContent).toContain('십오번 물음');
    expect(left.textContent).toContain('십육번 물음');
    expect(right.textContent).not.toContain('십육번 물음');
    expect(right.querySelector('.pb-q--cont')).not.toBeNull();
    expect(Array.from(stack.querySelectorAll('.q-num--mint')).map((n) => n.textContent)).toEqual(['01', '02']);
  });

  it('25번처럼 한 단보다 큰 문항은 줄어들지 않고 단을 넘어 찍힌다', () => {
    const big = Array.from({ length: 3 }, () => stanza(12)).join('');
    const stack = drawItems([standalone(1, `<p>물음</p><blockquote data-box="보기 1">${big}</blockquote>`)]);
    expect(stack.querySelector('.a4-block--scaled')).toBeNull();
    expect(columnsOf(stack).length).toBeGreaterThan(1);
    const boxes = Array.from(stack.querySelectorAll('blockquote[data-box="보기 1"]'));
    expect(boxes.filter((box) => box.classList.contains('pb-box-part--first'))).toHaveLength(1);
    expect(boxes.filter((box) => box.classList.contains('pb-box-part--last'))).toHaveLength(1);
  });
});
