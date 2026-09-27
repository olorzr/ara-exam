import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import MarkingModeToggle from './MarkingModeToggle';

/** 켜짐·꺼짐을 색만이 아니라 `aria-pressed` 로도 알리고, 누르면 토글 콜백이 한 번 온다 */
describe('MarkingModeToggle', () => {
  it('꺼져 있으면 aria-pressed 가 false 다', () => {
    render(<MarkingModeToggle pressed={false} onToggle={() => {}} />);

    expect(screen.getByRole('button', { name: '마킹 모드' }).getAttribute('aria-pressed')).toBe('false');
  });

  it('켜져 있으면 aria-pressed 가 true 다', () => {
    render(<MarkingModeToggle pressed onToggle={() => {}} />);

    expect(screen.getByRole('button', { name: '마킹 모드' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('누르면 onToggle 을 한 번 부른다', () => {
    const onToggle = vi.fn();
    render(<MarkingModeToggle pressed={false} onToggle={onToggle} />);

    fireEvent.click(screen.getByRole('button', { name: '마킹 모드' }));

    expect(onToggle).toHaveBeenCalledTimes(1);
  });
});
