import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import PageImageWithBoxes from './PageImageWithBoxes';

const SRC = 'https://signed.example/page-3.jpg';

/** jsdom 은 크기도 포인터 잡기도 없다 — 끌어 잡기를 재현하려면 둘 다 채워야 한다 */
beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
    left: 0, top: 0, width: 200, height: 400, right: 200, bottom: 400, x: 0, y: 0,
    toJSON: () => ({}),
  } as DOMRect);
  Element.prototype.setPointerCapture = vi.fn();
});

afterEach(() => vi.restoreAllMocks());

const image = () => screen.getByAltText('원본 페이지');

const drag = (el: HTMLElement) => {
  fireEvent.pointerDown(el, { clientX: 20, clientY: 40, pointerId: 1 });
  fireEvent.pointerMove(el, { clientX: 120, clientY: 240, pointerId: 1 });
  fireEvent.pointerUp(el, { clientX: 120, clientY: 240, pointerId: 1 });
};

describe('PageImageWithBoxes — 끌어 잡기', () => {
  it('그림이 뜬 뒤에는 잡은 자리를 0~1 로 돌려준다', () => {
    const onCapture = vi.fn();
    render(
      <PageImageWithBoxes
        src={SRC} boxes={[]} selectedId={null} onSelect={vi.fn()} capturing onCapture={onCapture}
      />,
    );
    fireEvent.load(image());
    drag(image().parentElement as HTMLElement);
    expect(onCapture).toHaveBeenCalledWith({ x: 0.1, y: 0.1, w: 0.5, h: 0.5 });
  });

  it('⚠️ 그림이 뜨기 전에는 받지 않는다 — 접힌 칸의 좌표로 엉뚱한 자리가 잘린다', () => {
    const onCapture = vi.fn();
    render(
      <PageImageWithBoxes
        src={SRC} boxes={[]} selectedId={null} onSelect={vi.fn()} capturing onCapture={onCapture}
      />,
    );
    drag(image().parentElement as HTMLElement);
    expect(onCapture).not.toHaveBeenCalled();
    expect(screen.getByText('원본을 불러오는 중이에요…')).toBeTruthy();
  });

  it('못 불러오면 까닭과 함께 다시 불러올 길을 준다 — 서명은 한 시간이면 만료된다', () => {
    const onReloadSrc = vi.fn();
    render(
      <PageImageWithBoxes
        src={SRC} boxes={[]} selectedId={null} onSelect={vi.fn()} onReloadSrc={onReloadSrc}
      />,
    );
    fireEvent.error(image());
    expect(screen.getByText('원본을 불러오지 못했어요.')).toBeTruthy();
    fireEvent.click(screen.getByText('다시 불러오기'));
    expect(onReloadSrc).toHaveBeenCalled();
  });

  it('잡는 중에는 영역 단추 대신 고른 항목의 윤곽만 남긴다 — 단추는 드래그를 먹는다', () => {
    const boxes = [
      { id: 'A', bbox: { x: 0, y: 0, w: 0.5, h: 0.5 }, label: '지문', kind: 'passage' as const },
      { id: 'B', bbox: { x: 0.5, y: 0, w: 0.5, h: 0.5 }, label: '3', kind: 'problem' as const },
    ];
    const { rerender } = render(
      <PageImageWithBoxes src={SRC} boxes={boxes} selectedId={null} onSelect={vi.fn()} />,
    );
    fireEvent.load(image());
    expect(screen.getByLabelText('지문 영역')).toBeTruthy();

    rerender(
      <PageImageWithBoxes
        src={SRC} boxes={boxes} selectedId={null} onSelect={vi.fn()} capturing highlightId="A"
      />,
    );
    expect(screen.queryByLabelText('지문 영역')).toBe(null);
    expect(screen.queryByLabelText('3 영역')).toBe(null);
    expect(screen.getByText('지문')).toBeTruthy();
  });

  it('주소가 아예 없어도 다시 받을 길을 낸다 — 처음 서명에 실패하면 onError 조차 안 난다', () => {
    const onReloadSrc = vi.fn();
    render(
      <PageImageWithBoxes
        src={null} boxes={[]} selectedId={null} onSelect={vi.fn()} onReloadSrc={onReloadSrc}
      />,
    );
    expect(screen.getByText('페이지 이미지가 없어요')).toBeTruthy();
    fireEvent.click(screen.getByText('다시 불러오기'));
    expect(onReloadSrc).toHaveBeenCalled();
  });
});
