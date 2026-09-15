import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import ProblemBodyView, { type ProblemBody } from './ProblemBodyView';
import PassageBodyView, { type PassageBody } from './PassageBodyView';

/** ᄒᆞᆫ — 첫가끝 자모로 적은 옛한글 한 음절 */
const YET = '\u1112\u119E\u11AB';

function problem(over: Partial<ProblemBody> = {}): ProblemBody {
  return {
    number: 1, question_type: '객관식', stem_html: '<p>물음</p>', choices: ['가', '나'],
    answer: '1', explanation_html: '', render_mode: 'text', image_path: '', figure_paths: [],
    ...over,
  };
}

function passage(over: Partial<PassageBody> = {}): PassageBody {
  return {
    html: '<p>소나기가 그쳤다</p>', render_mode: 'text', image_path: '', title: '', label: '',
    ...over,
  };
}

const sheetOf = (container: HTMLElement) => container.querySelector('.pb-sheet')?.className ?? '';

describe('옛한글 글꼴 클래스', () => {
  it('옛한글 지문은 명조로 그린다 — 글꼴이 없으면 첫가끝 자모가 깨진 네모로 나온다', () => {
    const { container } = render(<PassageBodyView passage={passage({ html: `<p>${YET}</p>` })} />);
    expect(sheetOf(container)).toContain('yet-hangul-serif');
  });

  it('현대 국어 지문에는 안 붙인다 — 멀쩡한 지문의 글꼴을 바꾸면 안 된다', () => {
    const { container } = render(<PassageBodyView passage={passage()} />);
    expect(sheetOf(container)).not.toContain('yet-hangul');
  });

  it('문항의 옛한글은 **고딕**이다 — 발문·선지는 앱 본문과 같은 계열이라야 읽기가 자연스럽다', () => {
    const { container } = render(
      <ProblemBodyView problem={problem({ stem_html: `<p>${YET}</p>` })} imageUrls={new Map()} />,
    );
    expect(sheetOf(container)).toContain('yet-hangul');
    expect(sheetOf(container)).not.toContain('yet-hangul-serif');
  });

  it('선지에만 옛한글이 있어도 알아본다 — 문법 문항이 그런 모양이다', () => {
    const { container } = render(
      <ProblemBodyView problem={problem({ choices: ['현대', YET] })} imageUrls={new Map()} />,
    );
    expect(sheetOf(container)).toContain('yet-hangul');
  });

  it('낱자 ㆍ 를 설명하는 문항은 글꼴을 바꾸지 않는다 — 한 글자 때문에 문항 전체가 달라지면 안 된다', () => {
    const { container } = render(
      <ProblemBodyView
        problem={problem({ stem_html: '<p>ㆍ의 소실에 대한 설명으로 옳은 것은?</p>' })}
        imageUrls={new Map()}
      />,
    );
    expect(sheetOf(container)).not.toContain('yet-hangul');
  });
});
