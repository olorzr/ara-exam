import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';

const m = vi.hoisted(() => ({
  auth: { user: null as { email: string } | null, loading: false },
  replace: vi.fn(),
}));
vi.mock('@/lib/auth-context', () => ({ useAuth: () => m.auth }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: m.replace }) }));

const { useDirectorGate } = await import('./useDirectorGate');

describe('useDirectorGate', () => {
  beforeEach(() => { m.replace.mockReset(); });

  it('원장이면 들여보낸다', () => {
    m.auth = { user: { email: 'ara0723@araeducation.co.kr' }, loading: false };
    const { result } = renderHook(() => useDirectorGate());
    expect(result.current).toEqual({ checking: false, allowed: true });
    expect(m.replace).not.toHaveBeenCalled();
  });

  it('다른 선생님이면 대시보드로 보낸다', () => {
    m.auth = { user: { email: 'teacher@araeducation.co.kr' }, loading: false };
    const { result } = renderHook(() => useDirectorGate());
    expect(result.current.allowed).toBe(false);
    expect(m.replace).toHaveBeenCalledWith('/dashboard');
  });

  it('로그인 상태를 읽는 동안은 보내지 않는다', () => {
    m.auth = { user: null, loading: true };
    const { result } = renderHook(() => useDirectorGate());
    expect(result.current.checking).toBe(true);
    expect(m.replace).not.toHaveBeenCalled();
  });
});
