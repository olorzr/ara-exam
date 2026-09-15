import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { AiPickSectionProps } from './AiPickSection';

/**
 * 훅을 손으로 쥐고 화면만 본다 — 생성 중의 잠금·진행 표시는 훅의 상태에 달려 있어,
 * 진짜 훅으로는 그 순간을 붙잡을 수 없다(훅 자체는 `useConceptPick.test.tsx` 가 본다).
 */
const state = {
  running: false,
  applied: [] as { text: string; context: string }[],
  notFound: [] as string[],
  dropped: null as { notInText: number; duplicate: number; malformed: number } | null,
  progress: null as { done: number; total: number } | null,
  run: vi.fn(),
  cancel: vi.fn(),
  removeOne: vi.fn(),
  undoAll: vi.fn(),
};
vi.mock('@/hooks/useConceptPick', () => ({ useConceptPick: () => state }));

const AiPickSection = (await import('./AiPickSection')).default;

const props = (over: Partial<AiPickSectionProps> = {}): AiPickSectionProps => ({
  enabled: true,
  editorRef: { current: null },
  marks: [],
  addMarkByText: vi.fn().mockReturnValue(true),
  removeMarkByText: vi.fn(),
  ...over,
});

beforeEach(() => {
  Object.assign(state, {
    running: false, applied: [], notFound: [], dropped: null, progress: null,
  });
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
  });

  it('선생님 손 마킹을 기준으로 삼는다고 밝힌다 — 왜 이만큼 뚫리는지가 설명돼야 한다', () => {
    render(<AiPickSection {...props()} />);
    expect(screen.getByText(/선생님이 개념지에 뚫어 둔 기준/)).toBeTruthy();
    expect(screen.getByText(/멈추면 거기까지는 남아요/)).toBeTruthy();
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

  it('생성 중에는 진행과 취소가 보인다 — 묶음이 여럿이면 몇 분 걸린다', () => {
    Object.assign(state, { running: true, progress: { done: 2, total: 4 } });
    render(<AiPickSection {...props()} />);
    expect(screen.getByRole('button', { name: /고르는 중… 2\/4/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: '취소' })).toBeTruthy();
  });

  it('묶음이 하나뿐이면 진행 숫자를 붙이지 않는다 — 1/1 은 알려 줄 것이 없다', () => {
    Object.assign(state, { running: true, progress: { done: 0, total: 1 } });
    render(<AiPickSection {...props()} />);
    expect(screen.getByRole('button', { name: '고르는 중…' })).toBeTruthy();
  });

  it('⚠️ 생성 중에는 되돌리기와 개별 빼기를 잠근다 — 되돌린 뒤 남은 묶음이 다시 붙인다', () => {
    Object.assign(state, {
      running: true,
      progress: { done: 1, total: 3 },
      applied: [{ text: '갈래', context: '' }],
    });
    render(<AiPickSection {...props()} />);

    const undo = screen.getByRole('button', { name: /고르는 중에는 되돌릴 수 없어요/ });
    expect(undo.hasAttribute('disabled')).toBe(true);
    expect(screen.getByLabelText('갈래 추천 빼기').hasAttribute('disabled')).toBe(true);
  });

  it('생성이 끝나면 되돌리기가 다시 열린다', () => {
    Object.assign(state, { applied: [{ text: '갈래', context: '' }] });
    render(<AiPickSection {...props()} />);

    const undo = screen.getByRole('button', { name: '추천 전부 되돌리기 (1개)' });
    expect(undo.hasAttribute('disabled')).toBe(false);
    expect(screen.getByLabelText('갈래 추천 빼기').hasAttribute('disabled')).toBe(false);
  });
});
