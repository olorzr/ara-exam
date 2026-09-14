import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { newBundleDraft } from '@/lib/print-scan/bundles';
import PrintPageGrid from './PrintPageGrid';

const bundle = { ...newBundleDraft('b1'), name: '봄봄 학습지' };

function renderGrid(handlers: {
  onTogglePage?: (page: number) => void;
  onPreview?: (page: number) => void;
} = {}) {
  return render(
    <PrintPageGrid
      pageCount={2}
      from={1}
      windowSize={24}
      thumbnails={['data:image/jpeg;base64,a', 'data:image/jpeg;base64,b']}
      bundles={[bundle]}
      assignments={new Map([[1, 'b1']])}
      activeId="b1"
      loading={false}
      onTogglePage={handlers.onTogglePage ?? (() => {})}
      onAssignWindow={() => {}}
      onShowFrom={() => {}}
      onPreview={handlers.onPreview ?? (() => {})}
    />,
  );
}

describe('PrintPageGrid', () => {
  /**
   * 이 테스트가 고정하는 것: 타일 자체가 이미 '이 프린트에 넣기' 단추라 확대는 **형제**여야
   * 한다. 안에 넣으면 잘못된 HTML 이고, 브라우저가 고쳐 놓는 모양에 따라 확대를 누를 때
   * 쪽이 함께 배정되거나 빠진다.
   */
  it('확대 단추는 배정 단추 안에 들어 있지 않다', () => {
    renderGrid();
    const enlarge = screen.getByRole('button', { name: '1쪽 크게 보기' });
    expect(enlarge.closest('button')).toBe(enlarge);
  });

  it('확대를 눌러도 쪽 배정은 바뀌지 않는다', () => {
    const onTogglePage = vi.fn();
    const onPreview = vi.fn();
    renderGrid({ onTogglePage, onPreview });

    screen.getByRole('button', { name: '2쪽 크게 보기' }).click();

    expect(onPreview).toHaveBeenCalledWith(2);
    expect(onTogglePage).not.toHaveBeenCalled();
  });

  it('타일을 누르면 그 쪽이 지금 고른 프린트로 간다', () => {
    const onTogglePage = vi.fn();
    renderGrid({ onTogglePage });
    screen.getByRole('button', { name: /^2쪽 — 지금 건너뜀/ }).click();
    expect(onTogglePage).toHaveBeenCalledWith(2);
  });
});
