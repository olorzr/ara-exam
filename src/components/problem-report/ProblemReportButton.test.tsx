import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

// 창은 따로 테스트한다(ProblemReportDialog.test) — 여기서는 단추 모양과 여는 것만 본다
vi.mock('./ProblemReportDialog', () => ({
  default: ({ open }: { open: boolean }) => (open ? <div role="dialog">신고 창</div> : null),
}));

const { default: ProblemReportButton } = await import('./ProblemReportButton');
const target = { kind: 'paper' as const, paperId: 'p1', revision: 'r1' };

describe('ProblemReportButton', () => {
  it('떠 있는 단추는 화면 오른쪽 아래에 고정되고 단추 자신이 인쇄에서 빠진다', () => {
    render(<ProblemReportButton look="floating" target={target} />);
    const button = screen.getByRole('button', { name: '오류 신고' });
    expect(button.className).toMatch(/\bfixed\b/);
    expect(button.className).toContain('right-4');
    expect(button.className).toContain('bottom-[calc(1rem+env(safe-area-inset-bottom))]');
    expect(button.className).toContain('z-40');
    expect(button.hasAttribute('data-no-print')).toBe(true);
    fireEvent.click(button);
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('글자 링크 모양은 그대로다(문항 상세 창)', () => {
    render(<ProblemReportButton look="link" target={target} />);
    const button = screen.getByRole('button', { name: '오류 신고' });
    expect(button.className).not.toMatch(/\bfixed\b/);
    expect(button.hasAttribute('data-no-print')).toBe(false);
  });
});
