import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * `updateBundle` — 0행 갱신과 버전 조건 (2026-10-15 리뷰 2·7번).
 * 합성 저장소가 걸린 조건을 적어 두고, 갱신·확인 조회의 결과를 손으로 정한다.
 */

const m = vi.hoisted(() => ({
  calls: [] as unknown[][],
  updated: null as { updated_at: string } | null,
  exists: true,
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: () => {
      let updating = false;
      const q: Record<string, unknown> = {};
      q.update = (p: unknown) => { updating = true; m.calls.push(['update', p]); return q; };
      q.select = (cols: string) => { m.calls.push(['select', cols]); return q; };
      q.eq = (k: string, v: unknown) => { m.calls.push(['eq', k, v]); return q; };
      q.maybeSingle = async () => (updating
        ? { data: m.updated, error: null }
        : { data: m.exists ? { id: 'b1' } : null, error: null });
      return q;
    },
  },
}));
vi.mock('@/lib/category-master', () => ({ createSchoolMaterial: vi.fn(), ensureSchoolMirror: vi.fn() }));
vi.mock('@/lib/problem-bank/storage', () => ({ removeProblemFiles: vi.fn() }));

const { BundleConflictError, BundleMissingError, updateBundle } = await import('./save');

beforeEach(() => {
  m.calls = [];
  m.updated = { updated_at: 'v2' };
  m.exists = true;
});

describe('updateBundle', () => {
  it('고친 행의 새 버전을 돌려준다', async () => {
    await expect(updateBundle('b1', { status: '읽는중' })).resolves.toEqual({ updated_at: 'v2' });
    expect(m.calls).toContainEqual(['eq', 'id', 'b1']);
    expect(m.calls).not.toContainEqual(expect.arrayContaining(['eq', 'updated_at']));
  });

  it('⚠️ 0행이면(지워진 묶음) 성공으로 치지 않고 던진다', async () => {
    m.updated = null;
    await expect(updateBundle('b1', { status: '읽는중' })).rejects.toBeInstanceOf(BundleMissingError);
  });

  it('버전을 주면 그 버전일 때만 고친다', async () => {
    await updateBundle('b1', { qa_items: [] }, { expectUpdatedAt: 'v1' });
    expect(m.calls).toContainEqual(['eq', 'updated_at', 'v1']);
  });

  it('⚠️ 버전 조건으로 0행인데 행이 있으면 충돌이다', async () => {
    m.updated = null;
    await expect(updateBundle('b1', { qa_items: [] }, { expectUpdatedAt: 'v1' }))
      .rejects.toBeInstanceOf(BundleConflictError);
  });

  it('버전 조건으로 0행인데 행도 없으면 없음이다', async () => {
    m.updated = null;
    m.exists = false;
    await expect(updateBundle('b1', { qa_items: [] }, { expectUpdatedAt: 'v1' }))
      .rejects.toBeInstanceOf(BundleMissingError);
  });
});
