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

  it('켜지면 기본 10개로 추천 버튼을 보여 준다', () => {
    render(<AiPickSection {...props()} />);
    expect(screen.getByRole('button', { name: '10개 추천받기' })).toBeTruthy();
    expect((screen.getByLabelText('추천받을 개수') as HTMLInputElement).value).toBe('10');
  });

  it('되돌리기는 붙인 추천이 있을 때만 나온다', () => {
    render(<AiPickSection {...props()} />);
    expect(screen.queryByText(/추천 전부 되돌리기/)).toBeNull();
  });
});
