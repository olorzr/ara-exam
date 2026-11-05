import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

const gate = vi.fn();
const screenProps = vi.fn();

vi.mock('@/hooks/useDirectorGate', () => ({ useDirectorGate: () => gate() }));
vi.mock('@/components/problem-paper/PaperComposeScreen', () => ({
  default: (props: { withWorkbook?: boolean }) => {
    screenProps(props);
    return <p>조합 화면</p>;
  },
}));

const { default: BookPaperComposePage } = await import('./page');

beforeEach(() => {
  gate.mockReset();
  screenProps.mockReset();
});

describe('책 만들기의 문제지 만들기', () => {
  it('원장에게는 평가문제집을 보이는 조합 화면을 그린다', () => {
    gate.mockReturnValue({ checking: false, allowed: true });
    render(<BookPaperComposePage />);
    expect(screenProps).toHaveBeenCalledWith({ withWorkbook: true });
  });

  it('원장이 아니거나 아직 모르면 화면을 그리지 않는다 — 평가문제집 조회가 나가면 안 된다', () => {
    gate.mockReturnValue({ checking: false, allowed: false });
    render(<BookPaperComposePage />);
    gate.mockReturnValue({ checking: true, allowed: false });
    render(<BookPaperComposePage />);
    expect(screen.queryByText('조합 화면')).toBeNull();
    expect(screenProps).not.toHaveBeenCalled();
  });
});
