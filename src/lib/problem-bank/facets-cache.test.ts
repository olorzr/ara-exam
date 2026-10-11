import { describe, it, expect, beforeEach } from 'vitest';
import { ARCHIVE_FACETS_TTL_MS, cachedArchiveFacets, invalidateArchiveFacets } from './facets-cache';
import { EMPTY_ARCHIVE_FACETS, type ArchiveFacetsPayload } from './facets-payload';

beforeEach(() => invalidateArchiveFacets());

describe('cachedArchiveFacets', () => {
  it('유효 시간 안에는 같은 약속을 돌려준다', async () => {
    let calls = 0;
    const fetcher = async () => { calls += 1; return EMPTY_ARCHIVE_FACETS; };
    const a = cachedArchiveFacets(fetcher, 1_000);
    const b = cachedArchiveFacets(fetcher, 1_000 + ARCHIVE_FACETS_TTL_MS - 1);
    expect(a).toBe(b);
    await a;
    expect(calls).toBe(1);
  });

  it('유효 시간이 지나면 다시 읽는다 — 앱 밖 적재를 따라잡는다', async () => {
    let calls = 0;
    const fetcher = async () => { calls += 1; return EMPTY_ARCHIVE_FACETS; };
    await cachedArchiveFacets(fetcher, 0);
    await cachedArchiveFacets(fetcher, ARCHIVE_FACETS_TTL_MS);
    expect(calls).toBe(2);
  });

  it('늦게 실패한 옛 요청이 새 항목을 지우지 않는다', async () => {
    let failOld: (e: Error) => void = () => {};
    const old = cachedArchiveFacets(() => new Promise<ArchiveFacetsPayload>((_, rej) => { failOld = rej; }), 0);
    invalidateArchiveFacets();
    let calls = 0;
    const fresh = async () => { calls += 1; return EMPTY_ARCHIVE_FACETS; };
    const next = cachedArchiveFacets(fresh, 0);

    failOld(new Error('late'));
    await expect(old).rejects.toThrow('late');
    // 새 항목은 그대로 남아 다시 묻지 않는다
    expect(cachedArchiveFacets(fresh, 0)).toBe(next);
    await next;
    expect(calls).toBe(1);
  });
});
