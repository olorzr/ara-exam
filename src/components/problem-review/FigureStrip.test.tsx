import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import FigureStrip from './FigureStrip';

const PATHS = ['problems/x/figure-1.jpg', 'problems/x/figure-2.jpg'];
const urls = new Map(PATHS.map((p, i) => [p, `https://signed.example/${i}.jpg`]));

const recrop = (n: number) => screen.getByLabelText(`그림 ${n} 다시 자르기`);

describe('FigureStrip — 다시 자르기', () => {
  it('썸네일마다 다시 자르기가 있고 그 번호를 넘긴다', () => {
    const onStartRecapture = vi.fn();
    render(
      <FigureStrip paths={PATHS} urls={urls} onRemove={vi.fn()} onStartRecapture={onStartRecapture} />,
    );
    fireEvent.click(recrop(2));
    expect(onStartRecapture).toHaveBeenCalledWith(2);
  });

  it('길이 없으면 단추를 감춘다 — 누를 수 있는데 아무 일도 안 나는 것이 가장 나쁘다', () => {
    render(<FigureStrip paths={PATHS} urls={urls} onRemove={vi.fn()} />);
    expect(screen.queryByLabelText('그림 1 다시 자르기')).toBe(null);
  });

  it("만들지 못한 빈 자리에도 있다 — 그 자리를 채우는 길이다", () => {
    render(
      <FigureStrip
        paths={['', PATHS[1]]} urls={urls} onRemove={vi.fn()} onStartRecapture={vi.fn()}
      />,
    );
    expect(screen.getByText('만들지 못했어요')).toBeTruthy();
    expect(recrop(1)).toBeTruthy();
  });

  it('기다리는 자리에만 표시가 붙는다 — 어느 그림을 잡는 중인지 알아야 한다', () => {
    render(
      <FigureStrip
        paths={PATHS} urls={urls} onRemove={vi.fn()} onStartRecapture={vi.fn()}
        capturing capturingFigure={2}
      />,
    );
    expect(recrop(2).textContent).toContain('끌어 잡으세요');
    expect(recrop(1).textContent).not.toContain('끌어 잡으세요');
  });

  it("다시 자르는 중에는 '그림 추가' 가 켜져 보이지 않는다 — 무엇을 기다리는지 거짓으로 말하면 안 된다", () => {
    render(
      <FigureStrip
        paths={PATHS} urls={urls} onRemove={vi.fn()} onStartCapture={vi.fn()}
        onStartRecapture={vi.fn()} capturing capturingFigure={1}
      />,
    );
    expect(screen.getByText('그림 추가')).toBeTruthy();
    expect(screen.queryByText('원본에서 끌어 잡으세요')).toBe(null);
  });

  it("새로 붙이는 중이면 '그림 추가' 가 켜진다", () => {
    render(
      <FigureStrip
        paths={PATHS} urls={urls} onRemove={vi.fn()} onStartCapture={vi.fn()}
        onStartRecapture={vi.fn()} capturing capturingFigure={null}
      />,
    );
    expect(screen.getByText('원본에서 끌어 잡으세요')).toBeTruthy();
  });

  it('일하는 중에는 잠근다 — 두 번 누르면 그림이 둘 올라간다', () => {
    render(
      <FigureStrip paths={PATHS} urls={urls} onRemove={vi.fn()} onStartRecapture={vi.fn()} busy />,
    );
    expect((recrop(1) as HTMLButtonElement).disabled).toBe(true);
  });

  it('⚠️ 이미지로 출제 중이면 인쇄에 안 반영된다고 알린다 — 고쳤다고 믿게 두면 안 된다', () => {
    render(
      <FigureStrip
        paths={PATHS} urls={urls} onRemove={vi.fn()} onStartRecapture={vi.fn()} imageMode
      />,
    );
    expect(screen.getByText(/인쇄에는 잘라 둔 원본 이미지가 나가요/)).toBeTruthy();
  });

  it('글로 출제 중이면 그 안내를 띄우지 않는다', () => {
    render(
      <FigureStrip paths={PATHS} urls={urls} onRemove={vi.fn()} onStartRecapture={vi.fn()} />,
    );
    expect(screen.queryByText(/원본 이미지가 나가요/)).toBe(null);
  });

  it('그림이 아직 없어도 안내가 먼저 뜬다 — 첫 그림을 붙이고 나서 알면 늦다', () => {
    render(
      <FigureStrip paths={[]} urls={urls} onRemove={vi.fn()} onStartCapture={vi.fn()} imageMode />,
    );
    expect(screen.getByText(/인쇄에는 잘라 둔 원본 이미지가 나가요/)).toBeTruthy();
  });
});
