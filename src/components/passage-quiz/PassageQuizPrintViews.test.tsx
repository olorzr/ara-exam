import { beforeAll, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import PassageQuizKeyView from './PassageQuizKeyView';
import PassageQuizPaperView from './PassageQuizPaperView';
import type { QuizItem } from '@/lib/passage-quiz';

/** jsdom 은 레이아웃을 하지 않는다 — A4Document 가 재려면 이 둘이 있어야 한다 */
beforeAll(() => {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

const items: QuizItem[] = [
  { id: 'a', kind: 'ox', text: '화자는 떠나는 이를 붙잡지 않는다.', answer: 'O', evidence: '말없이 고이 보내 드리오리다' },
  { id: 'b', kind: 'ox', text: '화자는 눈물을 흘린다.', answer: 'X', evidence: '죽어도 아니 눈물 흘리오리다' },
  { id: 'c', kind: 'short', text: '길에 뿌리는 꽃은?', answer: '진달래꽃', evidence: '영변에 약산 진달래꽃' },
];

const TEXT = '나 보기가 역겨워\n가실 때에는\n\n영변에 약산\n진달래꽃';

describe('PassageQuizPaperView', () => {
  it('지문을 연 단위로 나눠 싣고 줄바꿈을 지킨다 — 시는 행갈이가 곧 내용이다', () => {
    const { container } = render(
      <PassageQuizPaperView text={TEXT} title="진달래꽃" author="김소월" items={items} />,
    );
    const parts = container.querySelectorAll('.a4-measure .pb-passage-part');
    expect(parts).toHaveLength(2);
    expect(parts[0].textContent).toBe('나 보기가 역겨워\n가실 때에는');
    expect(parts[0].className).toContain('pb-passage-part--first');
    expect(parts[1].className).toContain('pb-passage-part--last');
  });

  it('연과 연 사이는 띄우고, 자리가 모자라 쪼갠 조각은 붙여 둔다', () => {
    const { container } = render(
      <PassageQuizPaperView text={'첫 연\n\n둘째 연'} title="" author="" items={items} />,
    );
    const parts = container.querySelectorAll('.a4-measure .pb-passage-part');
    // 빈 줄은 나누면서 사라진다 — 그 여백을 인쇄에서 되돌리지 않으면 연이 붙는다
    expect(parts[0].className).not.toContain('pb-passage-part--gap');
    expect(parts[1].className).toContain('pb-passage-part--gap');

    const long = render(
      <PassageQuizPaperView
        text={'줄0\n줄1\n줄2\n줄3\n줄4\n줄5\n줄6\n줄7\n줄8\n줄9\n줄10\n줄11\n줄12'}
        title="" author="" items={items}
      />,
    );
    const chunks = long.container.querySelectorAll('.a4-measure .pb-passage-part');
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[1].className).not.toContain('pb-passage-part--gap');
  });

  it('유형마다 머리 띠를 두고 번호는 O,X 부터 매긴다', () => {
    const { container } = render(
      <PassageQuizPaperView text={TEXT} title="" author="" items={items} />,
    );
    const measured = container.querySelector('.a4-measure')!;
    expect(measured.textContent).toContain('O,X — 맞으면 O, 틀리면 X 를 쓰시오.');
    expect(measured.textContent).toContain('단답형 — 지문에서 찾아 쓰시오.');
    const nums = [...measured.querySelectorAll('.q-num')].map((n) => n.textContent);
    expect(nums).toEqual(['01', '02', '03']);
  });

  it('O,X 는 답 칸을, 단답형은 쓰는 줄 둘을 준다', () => {
    const { container } = render(
      <PassageQuizPaperView text={TEXT} title="" author="" items={items} />,
    );
    const measured = container.querySelector('.a4-measure')!;
    expect(measured.querySelectorAll('.pb-quiz-box')).toHaveLength(2);
    expect(measured.querySelectorAll('.pb-q__lines')).toHaveLength(1);
    expect(measured.querySelectorAll('.pb-q__line')).toHaveLength(2);
  });

  it('시험지에는 정답을 싣지 않는다 — 문항 자리에는 발문만 있다', () => {
    // 단답형 답('진달래꽃')은 지문 안에 그대로 있는 낱말이라 지문에서는 보인다.
    // 확인할 것은 **문항 쪽에** 정답이 붙지 않는가이다
    const { container } = render(
      <PassageQuizPaperView text={TEXT} title="" author="" items={items} />,
    );
    const measured = container.querySelector('.a4-measure')!;
    expect(measured.querySelectorAll('.pb-answer-value')).toHaveLength(0);
    const stems = [...measured.querySelectorAll('.pb-q__stem')].map((n) => n.textContent);
    expect(stems).toEqual(items.map((i) => i.text));
  });
});

describe('PassageQuizKeyView', () => {
  it('정답표의 번호가 문제지와 같고 근거를 함께 싣는다', () => {
    const { container } = render(<PassageQuizKeyView title="진달래꽃" items={items} />);
    const measured = container.querySelector('.a4-measure')!;
    const nums = [...measured.querySelectorAll('.pb-answer-num')].map((n) => n.textContent);
    expect(nums).toEqual(['1', '2', '3']);
    const values = [...measured.querySelectorAll('.pb-answer-value')].map((n) => n.textContent);
    expect(values).toEqual(['O', 'X', '진달래꽃']);
    // 채점하는 사람이 "지문 어디에 그렇게 적혀 있나" 를 바로 볼 수 있어야 한다
    expect(measured.textContent).toContain('1. 말없이 고이 보내 드리오리다');
    expect(screen.getAllByText(/전체 3문항/).length).toBeGreaterThan(0);
  });

  it('근거가 하나도 없으면 근거 구간을 만들지 않는다', () => {
    const { container } = render(
      <PassageQuizKeyView title="" items={[{ ...items[0], evidence: '' }]} />,
    );
    expect(container.querySelector('.a4-measure')!.textContent).not.toContain('지문 근거');
  });
});
