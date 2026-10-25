import { beforeEach, describe, expect, it, vi } from 'vitest';

type Res = { data: unknown; error: { message: string; code?: string } | null };
const m = vi.hoisted(() => ({ next: { data: [], error: null } as Res }));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: () => {
      const q: Record<string, unknown> = {};
      for (const k of ['select', 'eq', 'delete']) q[k] = () => q;
      q.then = (yes: (r: Res) => unknown, no: (e: unknown) => unknown) => Promise.resolve(m.next).then(yes, no);
      return q;
    },
  },
}));

const { deletePaper, PAPER_IN_BOOK_MESSAGE } = await import('./paper-list');

describe('deletePaper', () => {
  beforeEach(() => { m.next = { data: [{ id: 'p1' }], error: null }; });

  it('지운 행이 있으면 끝난다', async () => {
    await expect(deletePaper('p1')).resolves.toBeUndefined();
  });

  it('책에 담긴 문제지(23503)는 그 까닭을 말한다 — 선생님은 책을 볼 수 없다', async () => {
    m.next = { data: null, error: { message: 'violates foreign key constraint', code: '23503' } };
    await expect(deletePaper('p1')).rejects.toThrow(PAPER_IN_BOOK_MESSAGE);
  });

  it('다른 오류는 그대로 던진다', async () => {
    m.next = { data: null, error: { message: '네트워크', code: '08006' } };
    await expect(deletePaper('p1')).rejects.toMatchObject({ message: '네트워크' });
  });

  it('0행이면 이미 지워졌다고 알린다', async () => {
    m.next = { data: [], error: null };
    await expect(deletePaper('p1')).rejects.toThrow('이미 지워졌거나');
  });
});
