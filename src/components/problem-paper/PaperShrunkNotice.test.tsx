import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import PaperShrunkNotice from './PaperShrunkNotice';

describe('PaperShrunkNotice', () => {
  it('줄어 찍히는 자리를 모두 적고 인쇄에서는 빠진다', () => {
    render(<PaperShrunkNotice labels={['20~23번 지문', '25번']} />);
    const notice = screen.getByRole('status');
    expect(notice.textContent).toContain('20~23번 지문, 25번');
    expect(notice.hasAttribute('data-no-print')).toBe(true);
  });

  it('자리가 없으면 아무것도 그리지 않는다', () => {
    const { container } = render(<PaperShrunkNotice labels={[]} />);
    expect(container.innerHTML).toBe('');
  });
});
