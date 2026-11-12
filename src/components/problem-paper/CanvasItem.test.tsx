import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import CanvasItem from './CanvasItem';
import type { CanvasItemDisplay } from '@/lib/problem-paper/canvas-display';

const base: CanvasItemDisplay = {
  stemHtml: '<p>다음 글을 읽고</p>', sourceLabel: '상현중 2026', workTitle: '서시', areaPath: ['문학'], hasAnswer: false,
};
const noop = () => {};

function draw(display: CanvasItemDisplay | undefined, inPassage = false, onRefreshGroup?: () => void) {
  render(
    <CanvasItem
      display={display} number={1} groupStart inPassage={inPassage} dragHandlers={{}}
      onRemove={noop} onMoveUp={noop} onMoveDown={noop} onRefreshGroup={onRefreshGroup}
    />,
  );
}

describe('CanvasItem', () => {
  it('발문·출처·작품·영역·정답 없음을 그린다', () => {
    draw(base);
    expect(screen.getByText(/다음 글을 읽고/)).toBeTruthy();
    expect(screen.getByText(/상현중 2026 · 서시 · 문학 · 정답 없음/)).toBeTruthy();
  });

  it('지문 묶음 표시는 캔버스 항목의 지문 여부로 정한다(스냅샷 지문도 같다)', () => {
    draw(base, true);
    expect(screen.getByText('지문 묶음')).toBeTruthy();
  });

  it('고치기 화면 — 새로 담은 문항·원본이 지워진 저장 항목을 표시한다', () => {
    draw({ ...base, origin: 'new' });
    expect(screen.getByText('새로 담음')).toBeTruthy();
    draw({ ...base, origin: 'stored', orphan: true });
    expect(screen.getByText('원본 삭제됨')).toBeTruthy();
  });

  it('그릴 것이 없으면 안내한다', () => {
    draw(undefined);
    expect(screen.getByText('(불러오지 못한 문항)')).toBeTruthy();
  });

  it('지문 묶음 머리에 \'최신 지문으로\' 를 넘겨받으면 그린다, 바꾼 자리는 표시한다', () => {
    const onRefresh = vi.fn();
    draw(base, true, onRefresh);
    fireEvent.click(screen.getByRole('button', { name: '최신 지문으로' }));
    expect(onRefresh).toHaveBeenCalledTimes(1);
    draw({ ...base, origin: 'refresh' });
    expect(screen.getByText('최신으로 바꿈')).toBeTruthy();
  });
});
