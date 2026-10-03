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
    id: '1d58d606-4f29-5025-8047-b4e9a6c17289',
    html: '<p>소나기가 그쳤다</p>', render_mode: 'text', image_path: '', title: '', label: '',
    ...over,
  };
}

const sheetOf = (container: HTMLElement) => container.querySelector('.pb-sheet')?.className ?? '';

/**
 * 아카이브 상세 창의 정답 선지 표시 — 인쇄(교사용)와 **같은 함수**를 봐야 한다.
 * 갈리면 같은 문항이 화면과 종이에서 다른 선지를 정답으로 가리킨다.
 */
describe('정답 선지 표시', () => {
  /** ⚠️ 개수가 아니라 **어느 선지**가 칠해졌는지를 본다(코덱스 리뷰 1R) */
  const markedOf = (container: HTMLElement) =>
    [...container.querySelectorAll('.pb-q__choice--answer')]
      .map((el) => el.querySelector('.pb-q__choice-glyph')?.textContent ?? '');

  it('단일 정답은 한 선지만 걸린다', () => {
    const { container } = render(
      <ProblemBodyView
        problem={problem({ choices: ['가', '나', '다'], answer: '2' })} imageUrls={new Map()}
      />,
    );
    expect(markedOf(container)).toEqual(['②']);
  });

  /** 운영에 58건 있는 꼴 — 예전에는 한 칸도 안 칠해졌다 */
  it('복수 정답은 두 선지가 걸린다', () => {
    const { container } = render(
      <ProblemBodyView
        problem={problem({ choices: ['가', '나', '다'], answer: '1,3' })} imageUrls={new Map()}
      />,
    );
    expect(markedOf(container)).toEqual(['①', '③']);
  });

  /** 선지로 못 읽는 답을 아무 데나 걸면 엉뚱한 선지가 정답이 된다 */
  it('어긋난 답은 아무 선지도 걸지 않는다', () => {
    const { container } = render(
      <ProblemBodyView
        problem={problem({ choices: ['가', '나', '다'], answer: '1,0' })} imageUrls={new Map()}
      />,
    );
    expect(markedOf(container)).toEqual([]);
  });

  it('텍스트 문항의 대안 정답을 두 선지 아래에 명확히 표시한다', () => {
    const { container } = render(
      <ProblemBodyView problem={problem({
        answer: '1or2', choices: ['하나', '둘', '셋', '넷', '다섯'], render_mode: 'text',
      })} imageUrls={new Map()} />,
    );
    expect(container.textContent).toContain('정답 ① 또는 ②');
    expect(markedOf(container)).toEqual([]);
  });

  it('㉮·㉯ 두 열 선지는 원문처럼 머리글 하나와 두 열로 그린다', () => {
    const { container } = render(
      <ProblemBodyView problem={problem({
        stem_html: '<p>물음</p><p>㉮　　㉯</p>',
        choices: Array.from({ length: 5 }, (_, i) => `<u>㉮</u> ㄱ, ${i}<br><u>㉯</u> ㄴ`),
        answer: '3',
      })} imageUrls={new Map()} />,
    );
    const table = container.querySelector('.pb-q__paired-choices');
    expect(table?.querySelectorAll('thead th')).toHaveLength(3);
    expect(table?.querySelectorAll('tbody tr')).toHaveLength(5);
    expect(table?.querySelector('tbody tr:nth-child(3)')?.textContent).toContain('정답');
    expect(container.querySelector('.pb-q__stem')?.textContent).not.toContain('㉮');
  });

  it('㉠·㉡·㉢ 세 열 선지는 원문처럼 행렬로 그린다', () => {
    const { container } = render(
      <ProblemBodyView problem={problem({
        stem_html: '<p>물음</p><p>㉠　　㉡　　㉢</p>',
        choices: Array.from({ length: 5 }, (_, i) => `가${i}<br>나${i}<br>다${i}`),
        answer: '2',
      })} imageUrls={new Map()} />,
    );
    const table = container.querySelector('.pb-q__paired-choices');
    expect(table?.querySelectorAll('thead th')).toHaveLength(4);
    expect(table?.querySelectorAll('tbody tr')).toHaveLength(5);
    expect(table?.querySelector('tbody tr:nth-child(2)')?.textContent).toContain('정답');
    expect(container.querySelector('.pb-q__stem')?.textContent).not.toContain('㉠');
  });

  it('선지가 표 안에 이미 있으면 번호만 다시 나열하지 않는다', () => {
    const { container } = render(
      <ProblemBodyView problem={problem({
        stem_html: '<p>설명 방법은?</p><table><tbody><tr><th>예</th><th>설명 방법</th></tr>'
          + '<tr><th>①</th><td>정의</td></tr><tr><th>②</th><td>분석</td></tr>'
          + '<tr><th>③</th><td>예시</td></tr><tr><th>④</th><td>비교</td></tr>'
          + '<tr><th>⑤</th><td>대조</td></tr></tbody></table>',
        choices: ['①', '②', '③', '④', '⑤'], answer: '3',
      })} imageUrls={new Map()} />,
    );
    expect(container.querySelectorAll('.pb-q__stem tbody tr')).toHaveLength(6);
    expect(container.querySelectorAll('.pb-q__choice')).toHaveLength(0);
    expect(container.textContent).toContain('정답 ③');
  });

  it('표의 여러 칸에 선지 번호가 흩어진 경우도 번호를 중복하지 않는다', () => {
    const { container } = render(
      <ProblemBodyView problem={problem({
        stem_html: '<p>설명은?</p><table><tbody><tr><th>공통점</th><td>① 설명</td></tr>'
          + '<tr><th>차이</th><td>② 설명<br>③ 설명</td></tr>'
          + '<tr><th>차이</th><td>④ 설명<br>⑤ 설명</td></tr></tbody></table>',
        choices: ['①', '②', '③', '④', '⑤'], answer: '5',
      })} imageUrls={new Map()} />,
    );
    expect(container.querySelectorAll('.pb-q__choice')).toHaveLength(0);
    expect(container.textContent).toContain('정답 ⑤');
  });
});

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

describe('원문 지문 상자', () => {
  it('지문 전체에 가짜 틀을 두르지 않고 원문 상자만 남긴다', () => {
    const { container } = render(<PassageBodyView passage={passage({
      html: '<p>지시문</p><blockquote><p>실제 상자</p></blockquote><p><code>단어 상자</code></p>',
    })} />);

    expect(container.querySelector('.pb-passage-part--unframed')).not.toBeNull();
    expect(container.querySelectorAll('blockquote:not([data-box])')).toHaveLength(1);
    expect(container.querySelectorAll('code')).toHaveLength(1);
  });

  it('이번 검수 밖의 기존 지문은 표시 규칙을 바꾸지 않는다', () => {
    const { container } = render(<PassageBodyView passage={passage({ id: 'legacy-passage' })} />);
    expect(container.querySelector('.pb-passage-part--unframed')).toBeNull();
  });
});
