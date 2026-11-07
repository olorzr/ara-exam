import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import PaperBackCoverAdvice from './PaperBackCoverAdvice';

function draw(over: Partial<Parameters<typeof PaperBackCoverAdvice>[0]> = {}) {
  const props = { backIsImage: false, busy: false, onDrop: vi.fn(), onKeep: vi.fn(), ...over };
  const view = render(<PaperBackCoverAdvice {...props} />);
  return { ...view, props };
}

describe('PaperBackCoverAdvice', () => {
  it('뒷표지 없애기가 먼저, 그대로 두기가 다음이고 각각 제 일을 부른다', () => {
    const { props } = draw();
    const buttons = screen.getAllByRole('button').map((b) => b.textContent);
    expect(buttons).toEqual(['뒷표지 없애기', '그대로 두기']);
    fireEvent.click(screen.getByRole('button', { name: '뒷표지 없애기' }));
    expect(props.onDrop).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: '그대로 두기' }));
    expect(props.onKeep).toHaveBeenCalledTimes(1);
  });

  it('저장 중에는 뒷표지 없애기를 잠근다', () => {
    draw({ busy: true });
    expect(screen.getByRole('button', { name: '뒷표지 없애기' })).toHaveProperty('disabled', true);
  });

  it('인쇄되지 않는다', () => {
    draw();
    expect(screen.getByRole('status').hasAttribute('data-no-print')).toBe(true);
  });

  it('그림 뒷표지면 다시 넣을 때 그림을 다시 골라야 한다고 알린다', () => {
    const { rerender, props } = draw();
    expect(screen.getByRole('status').textContent).not.toContain('그림은 다시 골라야');
    rerender(<PaperBackCoverAdvice {...props} backIsImage />);
    expect(screen.getByRole('status').textContent).toContain('그림은 다시 골라야');
  });
});
