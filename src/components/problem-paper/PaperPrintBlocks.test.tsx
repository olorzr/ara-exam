import { beforeAll, describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { buildPaperBlocks } from '@/lib/problem-paper/blocks';
import { EXPLANATION_INLINE_MAX_CHARS } from '@/lib/problem-paper/answers';
import type { PaperItemSnapshot, PaperSettings, ProblemPaper } from '@/types/problem-bank';
import ProblemPaperView from './ProblemPaperView';
import { renderPaperBlocks } from './PaperPrintBlocks';

/**
 * 문항 사이 여백 규약을 고정한다.
 *
 * 간격은 CSS 변수(`--pb-q-gap`)가 지고, 그 크기를 어디에 붙일지를 두 클래스가 정한다:
 * 기출 문제지에만 `pb-sheet--paper`(넓게), 해설이 따로 흘러가는 문항에는 `pb-q--continues`
 * (그 문항은 여백을 줄이고 마지막 해설 조각이 간격을 진다). 클래스가 빠지면 인쇄물에서
 * 문항과 제 해설 사이가 한 뼘 벌어지거나 문항 사이가 도로 붙는다 — 화면 코드로는 안 드러난다.
 */

/** jsdom 은 레이아웃을 하지 않는다 — A4Document 가 재려면 이것이 있어야 한다 */
beforeAll(() => {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

const SETTINGS: PaperSettings = { columns: 2, showScore: false, showSource: true };

function snapshot(over: Partial<PaperItemSnapshot> = {}): PaperItemSnapshot {
  return {
    number: 1,
    question_type: '객관식',
    stem_html: '<p>다음 글의 갈래는?</p>',
    choices: ['소설', '시', '수필', '희곡', '극'],
    answer: '1',
    score: null,
    explanation_html: '',
    area_path: [],
    work_title: '',
    render_mode: 'text',
    image_path: '',
    figure_paths: [],
    passage: null,
    source: {
      source_type: '내신기출',
      title: '',
      school_name: '상현중학교',
      year: '2026',
      grade: '중2',
      semester: '1학기',
      exam_type: '중간',
      publisher: '',
    },
    ...over,
  };
}

/** 따로 흘려 보낼 만큼 긴 해설 */
const LONG = `<p>${'해'.repeat(EXPLANATION_INLINE_MAX_CHARS + 50)}</p>`;
/** 문항 블록 안에 붙는 짧은 해설 */
const SHORT = '<p>정답은 소설이다.</p>';

function draw(items: PaperItemSnapshot[], showAnswers: boolean) {
  const nodes = renderPaperBlocks({
    blocks: buildPaperBlocks(items, showAnswers),
    settings: SETTINGS,
    imageUrls: new Map(),
    showAnswers,
  });
  return render(<div>{nodes}</div>).container;
}

describe('problemClassName', () => {
  it('해설이 없으면 문항이 제 여백을 그대로 진다', () => {
    const container = draw([snapshot()], true);
    expect(container.querySelector('.pb-q')).not.toBeNull();
    expect(container.querySelector('.pb-q--continues')).toBeNull();
    expect(container.querySelector('.pb-q__explanation--last')).toBeNull();
  });

  it('짧은 해설은 문항 블록 안에 붙으므로 여백을 줄이지 않는다', () => {
    const container = draw([snapshot({ explanation_html: SHORT })], true);
    expect(container.querySelector('.pb-q--continues')).toBeNull();
    // 문항 블록 안의 해설이라 따로 흘러간 조각은 없다
    expect(container.querySelector('.pb-q__explanation--part')).toBeNull();
  });

  it('긴 해설은 따로 흘러가고 그 문항만 여백을 줄인다 — 간격은 마지막 조각이 진다', () => {
    const container = draw([snapshot({ explanation_html: LONG })], true);
    expect(container.querySelector('.pb-q--continues')).not.toBeNull();
    expect(container.querySelector('.pb-q__explanation--last')).not.toBeNull();
  });

  it('학생 문제지에서는 해설이 길어도 여백을 줄이지 않는다 — 해설이 아예 안 나간다', () => {
    const container = draw([snapshot({ explanation_html: LONG })], false);
    expect(container.querySelector('.pb-q--continues')).toBeNull();
    expect(container.querySelector('.pb-q__explanation--part')).toBeNull();
  });

  it('그림 문항도 글 문항과 같은 규칙을 따른다 — 한쪽만 고쳐지면 간격이 갈린다', () => {
    const image = snapshot({ render_mode: 'image', image_path: 'problems/a.jpg', explanation_html: LONG });
    const container = draw([image], true);
    const block = container.querySelector('.pb-q');
    expect(block?.className).toContain('pb-q--continues');
  });
});

describe('ProblemPaperView', () => {
  const paper: ProblemPaper = {
    id: 'p1',
    title: '2026 중2 1학기 중간 대비',
    settings: SETTINGS,
    source_labels: [],
    total_questions: 1,
    user_id: 'u1',
    updated_by: null,
    created_at: '2026-09-20T00:00:00Z',
    updated_at: '2026-09-20T00:00:00Z',
  };

  it('기출 문제지 스코프를 붙여 문항 사이를 넓힌다 (측정 컨테이너에도 같이 붙어야 한다)', () => {
    const { container } = render(
      <ProblemPaperView paper={paper} items={[snapshot()]} imageUrls={new Map()} />,
    );
    expect(container.querySelector('.a4-measure')?.className).toContain('pb-sheet--paper');
  });

  /**
   * 교사용의 정답 선지 표시.
   *
   * ⚠️ 색만으로 알리지 않는 규약이라 **클래스와 '정답' 글자가 함께** 붙어야 한다 —
   *    흑백으로 뽑으면 바탕색이 거의 사라진다. 타입만으로는 한쪽만 붙어도 통과한다.
   */
  /**
   * 칠해진 선지의 **기호**와 '정답' 글자 수.
   *
   * ⚠️ 개수만 세면 `2,5` 에서 ①·②를 칠하는 회귀도 통과한다(코덱스 리뷰 1R) —
   *    어느 칸이 칠해졌는지까지 본다.
   * ⚠️ `.a4-stack`(실제 인쇄면)으로 좁힌다 — A4Document 는 높이를 재려고 같은 블록을
   *    `.a4-measure` 에도 한 벌 그려서, 문서 전체를 세면 수가 두 배로 잡힌다.
   */
  const answersOf = (container: HTMLElement) => {
    const printed = container.querySelector('.a4-stack');
    if (!printed) throw new Error('인쇄면(.a4-stack)이 없다');
    return {
      glyphs: [...printed.querySelectorAll('.pb-q__choice--answer')]
        .map((el) => el.querySelector('.pb-q__choice-glyph')?.textContent ?? ''),
      labels: printed.querySelectorAll('.pb-q__choice-answer-mark').length,
    };
  };

  it('교사용은 정답 선지 하나에 색과 글자를 붙인다', () => {
    const { container } = render(
      <ProblemPaperView
        paper={paper} items={[snapshot({ answer: '2' })]} imageUrls={new Map()} showAnswers
      />,
    );
    expect(answersOf(container)).toEqual({ glyphs: ['②'], labels: 1 });
  });

  /** 답지에 `②, ⑤` 라고 적고 여기서 한 칸도 안 칠하면 두 인쇄물이 다르게 읽힌다 */
  it('복수 정답이면 선지 둘 다 걸린다', () => {
    const { container } = render(
      <ProblemPaperView
        paper={paper} items={[snapshot({ answer: '2,5' })]} imageUrls={new Map()} showAnswers
      />,
    );
    expect(answersOf(container)).toEqual({ glyphs: ['②', '⑤'], labels: 2 });
  });

  /**
   * ⚠️ 5지선다에 `'2,6'` 이 적혀 있을 때 ②만 칠하면 선생님은 그 한 칸을 **완전한
   * 정답으로 읽는다**. 반쪽을 칠하느니 아무 칸도 안 칠하고 답지에 날문자열을 남긴다
   */
  it('없는 선지를 가리키는 답은 반쪽도 칠하지 않는다', () => {
    const { container } = render(
      <ProblemPaperView
        paper={paper} items={[snapshot({ answer: '2,6' })]} imageUrls={new Map()} showAnswers
      />,
    );
    expect(answersOf(container)).toEqual({ glyphs: [], labels: 0 });
  });

  /** 학생 문제지에는 정답이 한 칸도 나가면 안 된다 */
  it('학생 문제지에는 복수 정답도 표시하지 않는다', () => {
    const { container } = render(
      <ProblemPaperView paper={paper} items={[snapshot({ answer: '2,5' })]} imageUrls={new Map()} />,
    );
    expect(answersOf(container)).toEqual({ glyphs: [], labels: 0 });
  });
});
