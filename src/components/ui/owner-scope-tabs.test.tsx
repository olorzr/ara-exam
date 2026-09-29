import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { OwnerScopeTabs } from './owner-scope-tabs';

describe('OwnerScopeTabs', () => {
  it('두 탭을 그리고, 고른 탭의 패널에만 목록을 그린다', () => {
    render(
      <OwnerScopeTabs value="mine" onChange={() => undefined}>
        <p>목록</p>
      </OwnerScopeTabs>,
    );
    const mine = screen.getByRole('tab', { name: '내가 만든 것' });
    expect(mine.getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('tab', { name: '다른 선생님이 만든 것' }).getAttribute('aria-selected')).toBe('false');
    expect(screen.getAllByText('목록')).toHaveLength(1);
  });

  it('다른 탭을 누르면 그 값을 알린다', () => {
    const onChange = vi.fn();
    render(
      <OwnerScopeTabs value="mine" onChange={onChange}>
        <p>목록</p>
      </OwnerScopeTabs>,
    );
    fireEvent.click(screen.getByRole('tab', { name: '다른 선생님이 만든 것' }));
    expect(onChange).toHaveBeenCalledWith('others');
  });
});
