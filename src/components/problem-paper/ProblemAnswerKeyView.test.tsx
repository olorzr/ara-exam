import { beforeAll, describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import ProblemAnswerKeyView from './ProblemAnswerKeyView';
import type { PaperItemSnapshot, PaperSettings, ProblemPaper } from '@/types/problem-bank';

/** jsdom 은 레이아웃을 하지 않는다 — A4Document 가 재려면 이 둘이 있어야 한다 */
beforeAll(() => {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

const SETTINGS: PaperSettings = { columns: 2, showScore: false, showSource: true, omr: false };

const paper: ProblemPaper = {
  id: 'p1', title: '2026 고1 1학기 중간 대비', settings: SETTINGS, source_labels: [],
  total_questions: 3, user_id: 'u1', updated_by: null,
  created_at: '2026-10-10T00:00:00Z', updated_at: '2026-10-10T00:00:00Z',
};

function snap(over: Partial<PaperItemSnapshot> = {}): PaperItemSnapshot {
  return {
    number: 1, question_type: '객관식', stem_html: '<p>물음</p>',
    choices: ['가', '나', '다', '라', '마'], answer: '3', score: null,
    explanation_html: '', area_path: [], work_title: '', render_mode: 'text',
    image_path: '', figure_paths: [], passage: null,
    source: {
      source_type: '내신기출', title: '성수고 중간', school_name: '성수고등학교',
      year: '2026', grade: '고1', exam_type: '중간', publisher: '',
    },
    ...over,
  };
}

/**
 * `A4Document` 는 높이를 재려고 같은 블록을 `.a4-measure` 에도 그린다 —
 * 문서 전체를 세면 수가 두 배로 잡히므로 실제 인쇄면(`.a4-stack`)만 본다.
 */
function sheet(container: HTMLElement) {
  return container.querySelector('.a4-stack') ?? container.querySelector('.a4-measure')!;
}

describe('ProblemAnswerKeyView', () => {
  it('선지 기호는 큰 글자 수정자를 달고 찍힌다 — 원문자 속 숫자가 작다', () => {
    const { container } = render(<ProblemAnswerKeyView paper={paper} items={[snap({ answer: '3' })]} />);
    const value = sheet(container).querySelector('.pb-answer-value')!;
    expect(value.textContent).toBe('③');
    expect(value.className).toContain('pb-answer-value--choice');
  });

  it("주관식은 격자에 '해설 참조' 를 찍고, 답은 아래 해설 구역에 싣는다", () => {
    const items = [
      snap({ answer: '3' }),
      snap({ question_type: '서술형', answer: '화자는 떠나는 이를 붙잡지 않는다.' }),
    ];
    const { container } = render(<ProblemAnswerKeyView paper={paper} items={items} />);
    const root = sheet(container);
    const values = [...root.querySelectorAll('.pb-answer-value')].map((n) => n.textContent);
    expect(values).toEqual(['③', '해설 참조']);
    expect(root.querySelectorAll('.pb-answer-value')[1].className).toContain('pb-answer-value--reference');

    // 띠 제목이 주관식 답이 들었음을 밝힌다 — 격자의 '해설 참조' 가 여기를 가리킨다
    expect(root.textContent).toContain('해설 · 주관식 정답');
    const entries = root.querySelectorAll('.pb-key-exp');
    expect(entries).toHaveLength(1);
    expect(entries[0].querySelector('.pb-answer-num')!.textContent).toBe('2');
    expect(entries[0].querySelector('.pb-key-exp__answer')!.textContent)
      .toBe('정답화자는 떠나는 이를 붙잡지 않는다.');
  });

  /** 기출은 해설이 안 달린 문항이 흔하다 — 빈 '해설' 띠만 찍히면 "해설이 빠졌나" 로 읽힌다 */
  it('객관식뿐이고 해설도 없으면 해설 띠를 내지 않는다', () => {
    const { container } = render(
      <ProblemAnswerKeyView paper={paper} items={[snap({ answer: '1' }), snap({ answer: '2' })]} />,
    );
    const root = sheet(container);
    expect(root.textContent).not.toContain('해설');
    expect(root.querySelectorAll('.pb-key-exp')).toHaveLength(0);
  });

  it("객관식 해설만 있으면 띠 제목은 '해설' 이다", () => {
    const { container } = render(
      <ProblemAnswerKeyView paper={paper} items={[snap({ answer: '1', explanation_html: '<p>까닭</p>' })]} />,
    );
    const root = sheet(container);
    expect(root.textContent).toContain('해설');
    expect(root.textContent).not.toContain('주관식 정답');
    expect(root.querySelector('.pb-key-exp__answer')!.className).toContain('pb-key-exp__answer--choice');
  });
});
