import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * 단어 쓰기는 **카테고리 안으로 좁혀** 나가고, 바뀐 행 수를 호출부에 돌려준다 (2026-10-15 리뷰 1번).
 * 합성 저장소가 조건 사슬을 적어 두고, 조건에 맞는 행만 돌려준다.
 */

type Row = { id: string; category_id: string };
const m = vi.hoisted(() => ({ rows: [] as Row[], calls: [] as unknown[][] }));

vi.mock('./supabase', () => ({
  supabase: {
    from: () => {
      let ids: string[] | null = null;
      let category: string | null = null;
      const q: Record<string, unknown> = {};
      const record = (name: string) => (...args: unknown[]) => { m.calls.push([name, ...args]); return q; };
      q.delete = record('delete');
      q.update = record('update');
      q.in = (...args: unknown[]) => { m.calls.push(['in', ...args]); ids = args[1] as string[]; return q; };
      q.eq = (...args: unknown[]) => {
        m.calls.push(['eq', ...args]);
        if (args[0] === 'category_id') category = args[1] as string;
        if (args[0] === 'id') ids = [args[1] as string];
        return q;
      };
      q.select = () => Promise.resolve({
        data: m.rows.filter((r) => (ids ?? []).includes(r.id) && r.category_id === category).map((r) => ({ id: r.id })),
        error: null,
      });
      return q;
    },
  },
}));

const { deleteWordsInCategory, moveWordsInCategory, updateWordInCategory } = await import('./words-mutations');

beforeEach(() => {
  m.rows = [{ id: 'a-word', category_id: 'A' }, { id: 'b-word', category_id: 'B' }];
  m.calls = [];
});

describe('words-mutations', () => {
  it('⚠️ 삭제는 카테고리 조건을 걸고, 다른 카테고리의 행은 지운 것으로 치지 않는다', async () => {
    const deleted = await deleteWordsInCategory('B', ['a-word', 'b-word']);
    expect(deleted).toEqual(['b-word']);
    expect(m.calls).toContainEqual(['eq', 'category_id', 'B']);
  });

  it('이동도 지금 카테고리 조건을 건다', async () => {
    const moved = await moveWordsInCategory('B', ['a-word', 'b-word'], 'C');
    expect(moved).toEqual(['b-word']);
    expect(m.calls).toContainEqual(['update', { category_id: 'C' }]);
    expect(m.calls).toContainEqual(['eq', 'category_id', 'B']);
  });

  it('⚠️ 수정이 0행이면(다른 카테고리·이미 없음) false 다', async () => {
    expect(await updateWordInCategory('B', 'a-word', { word: 'x', meaning: 'y' })).toBe(false);
    expect(await updateWordInCategory('B', 'b-word', { word: 'x', meaning: 'y' })).toBe(true);
  });

  it('빈 목록이면 부르지 않는다', async () => {
    expect(await deleteWordsInCategory('B', [])).toEqual([]);
    expect(m.calls).toEqual([]);
  });
});
