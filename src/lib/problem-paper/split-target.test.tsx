import { render } from '@testing-library/react';
import { beforeAll, describe, expect, it } from 'vitest';
import { renderPaperBlocks } from '@/components/problem-paper/PaperPrintBlocks';
import { PRINT_LINE_H, PRINT_QUESTION_GAP, PRINT_QUESTION_TOP, stubPrintLayout } from '@/test-utils/print-layout-stub';
import type { PaperItemSnapshot, PaperSettings } from '@/types/problem-bank';
import { buildPaperBlocks, type PaperProblemBlock } from './blocks';
import { chunkQuestionBlocks, questionCutsOf, splitTargetOf } from './split-target';

const SETTINGS: PaperSettings = { columns: 2, showScore: false, showSource: false, omr: false };

beforeAll(() => stubPrintLayout({ firstHeader: 100, laterHeader: 30 }));

const snap = (over: Partial<PaperItemSnapshot> = {}): PaperItemSnapshot => ({
  number: 1, question_type: '객관식', stem_html: '<p>물음</p>', choices: ['가', '나', '다'], answer: '1',
  score: null, explanation_html: '', area_path: [], work_title: '', render_mode: 'text', image_path: '',
  figure_paths: [], passage: null,
  source: { source_type: '내신기출', title: '', school_name: '성수고', year: '2026', grade: '고1', exam_type: '중간', publisher: '' },
  ...over,
});
const problemOf = (item: PaperItemSnapshot, showAnswers = false) => {
  const block = buildPaperBlocks([item], showAnswers).find((b) => b.kind === 'problem');
  if (block?.kind !== 'problem') throw new Error('문항 블록이 없다');
  return block;
};
const drawn = (block: PaperProblemBlock, omrSheetCount = 0) => {
  const nodes = renderPaperBlocks({ blocks: [block], settings: SETTINGS, imageUrls: new Map(), omrSheetCount });
  return render(<div>{nodes}</div>).container.firstElementChild as HTMLElement;
};

describe('questionCutsOf', () => {
  it('단위 경계들에 맨 뒤의 간격 떼기가 붙는다', () => {
    expect(questionCutsOf(problemOf(snap()))).toEqual([2, 3, 4]);
  });

  it('간격을 뗀 문항·뒤가 있는 조각에는 그 자리가 없다', () => {
    const block = problemOf(snap());
    expect(questionCutsOf({ ...block, tight: true })).toEqual([2, 3]);
    expect(questionCutsOf({ ...block, range: { from: 0, to: 2 } })).toEqual([]);
  });

  it('머리와 빈칸뿐인 문항도 간격 떼기로는 쪼갤 수 있다', () => {
    expect(questionCutsOf(problemOf(snap({ question_type: '주관식', choices: [] })))).toEqual([2]);
  });
});

describe('문항 재기', () => {
  it('자리마다 앞 단위 끝까지의 높이, 끝 단위 아래가 아래 군살이다', () => {
    const block = problemOf(snap());
    const m = splitTargetOf(block)?.measure(drawn(block));
    const lines = (n: number) => PRINT_QUESTION_TOP + n * PRINT_LINE_H;
    expect(m).toMatchObject({
      prefixHeights: [lines(2), lines(3), lines(4)],
      totalHeight: lines(4),
      topChrome: 0,
      bottomChrome: PRINT_QUESTION_GAP,
      minChunkPx: 0,
      emptyTailCut: 2,
    });
  });

  it('뒤 조각의 윗여백을 자리마다 잰다', () => {
    const block = problemOf(snap());
    expect(splitTargetOf(block)?.measure(drawn(block))?.continuationTop)
      .toEqual([PRINT_QUESTION_TOP, PRINT_QUESTION_TOP, 0]);
  });

  it('그려진 단위 수가 상태와 다르면 재지 않는다', () => {
    const block = problemOf(snap());
    const other = problemOf(snap({ choices: ['가', '나'] }));
    expect(splitTargetOf(block)?.measure(drawn(other))).toBeNull();
  });

  it('OMR 띠가 감싸도 문항을 찾는다', () => {
    const block = { ...problemOf(snap()), number: 91 };
    const m = splitTargetOf(block)?.measure(drawn(block, 2));
    expect(m?.prefixHeights).toHaveLength(3);
  });
});

describe('chunkQuestionBlocks', () => {
  it('경계에서 범위를 가르고 키가 겹치지 않는다', () => {
    const chunks = chunkQuestionBlocks(problemOf(snap()), [0]);
    expect(chunks.map((c) => c.range)).toEqual([{ from: 0, to: 2 }, { from: 2, to: 4 }]);
    expect(chunks.map((c) => c.key)).toEqual(['q-0-s0', 'q-0-s1']);
  });

  it('다시 쪼개면 범위 안에서 갈린다', () => {
    const [, tail] = chunkQuestionBlocks(problemOf(snap()), [0]);
    expect(chunkQuestionBlocks(tail, [0]).map((c) => c.range)).toEqual([{ from: 2, to: 3 }, { from: 3, to: 4 }]);
  });

  it('간격 떼기는 조각을 늘리지 않고 표시만 단다', () => {
    const chunks = chunkQuestionBlocks(problemOf(snap()), [2]);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toMatchObject({ range: { from: 0, to: 4 }, tight: true });
  });
});

describe('chunkQuestionBlocks — 간격 뗀 표시', () => {
  it('다시 쪼개면 끝 조각에만 남는다 — 앞 조각에 남으면 뒤 조각이 다음 단으로 튄다', () => {
    const [whole] = chunkQuestionBlocks(problemOf(snap()), [2]);
    const chunks = chunkQuestionBlocks(whole, [0]);
    expect(chunks.map((c) => c.tight)).toEqual([undefined, true]);
  });
});

describe('splitTargetOf', () => {
  it('머리와 표시 블록은 쪼개지 않는다', () => {
    expect(splitTargetOf({ kind: 'passage-header', key: 'h', text: '' })).toBeNull();
  });

  it('그림 문항은 쪼개지 않는다', () => {
    const blocks = buildPaperBlocks([snap({ render_mode: 'image', image_path: 'a.jpg' })]);
    expect(blocks.map(splitTargetOf)).toEqual([null]);
  });

  it('지문 문단은 문단일 때만 쪼갠다', () => {
    const part = { kind: 'passage-part' as const, key: 'k', serif: false, first: false, last: false };
    expect(splitTargetOf({ ...part, html: '<p>가<br>나</p>' })).not.toBeNull();
    expect(splitTargetOf({ ...part, html: '<table><tbody><tr><td>가</td></tr></tbody></table>' })).toBeNull();
  });
});
