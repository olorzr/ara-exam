import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { bookCoverSignature } from '@/lib/book';

type Res = { data: unknown; error: unknown };
let bookRes: Res;
let chapterRes: Res;
vi.mock('@/lib/supabase', () => ({
  supabase: {
    // 책 행은 maybeSingle 로, 장 목록은 order 뒤 await 로 읽는다
    from: () => {
      const chain = {
        select: () => chain, eq: () => chain,
        maybeSingle: () => Promise.resolve(bookRes),
        order: () => chain,
        then: (ok: (r: Res) => unknown, bad?: (e: unknown) => unknown) => Promise.resolve(chapterRes).then(ok, bad),
      };
      return chain;
    },
  },
}));

const { useBookRevisionWatch } = await import('./useBookRevisionWatch');

const seen = bookCoverSignature(null, [{ paperId: 'p1', revision: 'v1' }]);

beforeEach(() => {
  bookRes = { data: { page_counts: {} }, error: null };
  chapterRes = { data: [{ paper_id: 'p1', paper: { updated_at: 'v1' } }], error: null };
});

describe('useBookRevisionWatch', () => {
  it('담긴 문제지 판이 그대로면 check 가 false 이고 경고가 없다', async () => {
    const { result } = renderHook(() => useBookRevisionWatch('b', seen, false));
    let changed: boolean | undefined;
    await act(async () => { changed = await result.current.check(); });
    expect(changed).toBe(false);
    expect(result.current.stale).toBe(false);
  });

  it('인쇄 직전 check 가 고쳐진 것을 알면 true 를 돌려주고 경고를 켠다(코덱스 10R)', async () => {
    const { result } = renderHook(() => useBookRevisionWatch('b', seen, false));
    chapterRes = { data: [{ paper_id: 'p1', paper: { updated_at: 'v2' } }], error: null };
    let changed: boolean | undefined;
    await act(async () => { changed = await result.current.check(); });
    expect(changed).toBe(true);
    expect(result.current.stale).toBe(true);
  });

  it('조회가 실패하거나 지켜볼 것이 없으면 판단하지 않는다(false)', async () => {
    chapterRes = { data: null, error: new Error('끊김') };
    const failed = renderHook(() => useBookRevisionWatch('b', seen, false));
    let changed: boolean | undefined;
    await act(async () => { changed = await failed.result.current.check(); });
    expect(changed).toBe(false);
    expect(failed.result.current.stale).toBe(false);

    const none = renderHook(() => useBookRevisionWatch('b', null, false));
    await act(async () => { changed = await none.result.current.check(); });
    expect(changed).toBe(false);
  });
});
