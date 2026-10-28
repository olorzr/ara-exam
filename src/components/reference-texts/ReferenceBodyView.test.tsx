import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import ReferenceBodyView from './ReferenceBodyView';

describe('ReferenceBodyView', () => {
  it('문제집 서식을 그대로 그리고 위험한 것은 걷는다', () => {
    const { container } = render(
      <ReferenceBodyView
        kind="개념" format="html"
        body={'<blockquote data-callout="학습 목표" data-tone="goal"><p><mark>특성</mark></p></blockquote><img src=x onerror="alert(1)">'}
      />,
    );
    const root = container.firstElementChild!;
    expect(root.className).toContain('ref-sheet');
    expect(root.className).toContain('pb-sheet');
    expect(root.querySelector('blockquote')?.getAttribute('data-callout')).toBe('학습 목표');
    expect(root.querySelector('mark')?.textContent).toBe('특성');
    expect(root.querySelector('img')).toBeNull();
  });

  it('작품은 명조 갈래, 개념은 개념 갈래', () => {
    const work = render(<ReferenceBodyView kind="작품" format="html" body="<p>가</p>" />);
    expect(work.container.firstElementChild!.className).toContain('ref-sheet--work');
    const concept = render(<ReferenceBodyView kind="개념" format="html" body="<p>가</p>" />);
    expect(concept.container.firstElementChild!.className).toContain('ref-sheet--concept');
  });

  it('옛 평문 작품은 빈 줄로 문단을 가르고 태그로 읽지 않는다', () => {
    const { container } = render(<ReferenceBodyView kind="작품" format="text" body={'나 보기가\n역겨워\n\n<b>가실</b> 때에는'} />);
    const ps = container.querySelectorAll('p');
    expect(ps).toHaveLength(2);
    expect(ps[0].textContent).toBe('나 보기가\n역겨워');
    expect(container.querySelector('b')).toBeNull();
    expect(container.firstElementChild!.className).toContain('ref-sheet--plain');
  });

  it('각주는 작은 글씨 표시가 붙는다', () => {
    const { container } = render(<ReferenceBodyView kind="작품" format="html" body="<p>본문</p><p>*열무: 어린 무.</p>" />);
    expect(container.querySelector('p.pb-note')?.textContent).toBe('*열무: 어린 무.');
  });
});
