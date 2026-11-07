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

  it('구절 풀이·표식을 속성째 그린다', () => {
    const { container } = render(
      <ReferenceBodyView
        kind="작품" format="html"
        body={'<p><span data-note="항구" data-note-pos="over"><u>우리 집 현관</u></span> <span data-shape="triangle">소금</span></p>'}
      />,
    );
    const note = container.querySelector('span[data-note]');
    expect(note?.getAttribute('data-note')).toBe('항구');
    expect(note?.getAttribute('data-note-pos')).toBe('over');
    expect(note?.querySelector('u')?.textContent).toBe('우리 집 현관');
    expect(container.querySelector('span[data-shape="triangle"]')?.textContent).toBe('소금');
  });

  it('낱말 뜻풀이는 갈래째 그리고 글 끝 어휘 목록에 모은다', () => {
    const { container } = render(
      <ReferenceBodyView
        kind="작품" format="html"
        body={'<p><span data-note="닭의 수컷" data-note-kind="vocab"><u>수탉</u></span>이 <span data-note="화가 남"><u>운다</u></span></p>'}
      />,
    );
    expect(container.querySelector('span[data-note-kind="vocab"]')?.textContent).toBe('수탉');
    const list = container.querySelector('.ref-vocab');
    expect(list).toBe(container.firstElementChild!.lastElementChild);
    expect(Array.from(list!.querySelectorAll('li')).map((li) => li.textContent)).toEqual(['수탉닭의 수컷']);
  });

  it('낱말 뜻풀이가 없으면 어휘 목록도 없다', () => {
    const { container } = render(<ReferenceBodyView kind="작품" format="html" body={'<p><span data-note="화가 남">운다</span></p>'} />);
    expect(container.querySelector('.ref-vocab')).toBeNull();
  });

  it('⚠️ 다시 그려도 어휘 목록이 두 번 붙지 않는다', () => {
    const props = { kind: '작품', format: 'html', body: '<p><span data-note="뜻" data-note-kind="vocab">갑</span></p>' } as const;
    const { container, rerender } = render(<ReferenceBodyView {...props} />);
    rerender(<ReferenceBodyView {...props} />);
    expect(container.querySelectorAll('.ref-vocab')).toHaveLength(1);
  });

  it('잴 수 없는 환경에서는 풀이 자리를 쓰지 않고 본문은 그대로다', () => {
    const { container } = render(
      <ReferenceBodyView kind="작품" format="html" body={'<p><span data-note="가">갑</span> <span data-note="나">을</span></p>'} />,
    );
    const notes = container.querySelectorAll('span[data-note]');
    expect(notes).toHaveLength(2);
    notes.forEach((note) => {
      expect(note.getAttribute('style')).toBeNull();
      expect(note.getAttribute('data-note-fit')).toBeNull();
    });
  });

  it('⚠️ 같은 본문으로 다시 그려도 잡아 둔 풀이 자리가 남는다 — 안쪽을 갈아 끼우면 다시 재는 때가 없어 겹친 채 남는다', () => {
    const props = { kind: '작품', format: 'html', body: '<p><span data-note="가">갑</span></p>' } as const;
    const { container, rerender } = render(<ReferenceBodyView {...props} />);
    const note = container.querySelector<HTMLElement>('span[data-note]')!;
    note.style.setProperty('--note-dx', '-5px');
    rerender(<ReferenceBodyView {...props} />);
    expect(container.querySelector('span[data-note]')).toBe(note);
    expect(note.style.getPropertyValue('--note-dx')).toBe('-5px');
  });

  it('각주는 작은 글씨 표시가 붙는다', () => {
    const { container } = render(<ReferenceBodyView kind="작품" format="html" body="<p>본문</p><p>*열무: 어린 무.</p>" />);
    expect(container.querySelector('p.pb-note')?.textContent).toBe('*열무: 어린 무.');
  });
});
