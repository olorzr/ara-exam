import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import AiPickSection, { type AiPickSectionProps } from './AiPickSection';

const props = (over: Partial<AiPickSectionProps> = {}): AiPickSectionProps => ({
  enabled: true,
  editorRef: { current: null },
  marks: [],
  addMarkByText: vi.fn().mockReturnValue(true),
  removeMarkByText: vi.fn(),
  ...over,
});

describe('AiPickSection', () => {
  it('기능이 꺼져 있으면 아무것도 그리지 않는다 — 없던 기능처럼 보여야 한다', () => {
    const { container } = render(<AiPickSection {...props({ enabled: false })} />);
    expect(container.innerHTML).toBe('');
  });

  it('켜지면 개수 칸 없이 추천 버튼만 보여 준다 — 몇 개 고를지는 AI 가 정한다', () => {
    render(<AiPickSection {...props()} />);
    expect(screen.getByRole('button', { name: '추천받기' })).toBeTruthy();
    expect(screen.queryByRole('spinbutton')).toBeNull();
    expect(screen.queryByLabelText('추천받을 개수')).toBeNull();
    expect(screen.getByText(/AI 가 정해요/)).toBeTruthy();
  });

  it('되돌리기는 붙인 추천이 있을 때만 나온다', () => {
    render(<AiPickSection {...props()} />);
    expect(screen.queryByText(/추천 전부 되돌리기/)).toBeNull();
  });

  it('버린 추천 안내는 실행 전에는 없다 — 아직 아무것도 안 골랐다', () => {
    render(<AiPickSection {...props()} />);
    expect(screen.queryByText(/띄어쓰기가 든 추천/)).toBeNull();
    expect(screen.queryByText(/본문에 없는 말/)).toBeNull();
  });
});
