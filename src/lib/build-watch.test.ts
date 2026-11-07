import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  alreadyReloadedFor, AUTO_RELOAD_PATHS, decideBuildAction, fetchLatestBuild, rememberReloadFor, type BuildCheck,
} from './build-watch';

const base: BuildCheck = {
  current: 'old', latest: 'new', trigger: 'return', pathname: '/problems/archive', busy: false, alreadyReloaded: false,
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('decideBuildAction', () => {
  it('같은 빌드·못 물은 경우·개발 서버의 답이면 아무것도 안 한다', () => {
    expect(decideBuildAction({ ...base, latest: 'old' })).toBe('none');
    expect(decideBuildAction({ ...base, latest: null })).toBe('none');
    expect(decideBuildAction({ ...base, latest: 'dev' })).toBe('none');
  });

  it('안전한 화면으로 돌아왔고 작업이 없으면 새로 고친다', () => {
    for (const pathname of AUTO_RELOAD_PATHS) {
      expect(decideBuildAction({ ...base, pathname })).toBe('reload');
      expect(decideBuildAction({ ...base, pathname, trigger: 'mount' })).toBe('reload');
    }
  });

  it('허용 목록 밖의 화면은 작업 표시가 없어도 안내만 한다', () => {
    expect(decideBuildAction({ ...base, pathname: '/words/new' })).toBe('notify');
    expect(decideBuildAction({ ...base, pathname: '/problems/sources/abc' })).toBe('notify');
    expect(decideBuildAction({ ...base, pathname: '/problems/papers/new' })).toBe('notify');
    expect(decideBuildAction({ ...base, pathname: '/books/papers/new' })).toBe('notify');
  });

  it('작업 중이면 안내만 한다', () => {
    expect(decideBuildAction({ ...base, busy: true })).toBe('notify');
  });

  it('보고 있는 동안 알게 되면 안내만 한다', () => {
    expect(decideBuildAction({ ...base, trigger: 'poll' })).toBe('notify');
  });

  it('이 빌드로 이미 새로 고쳤으면 다시 고치지 않는다', () => {
    expect(decideBuildAction({ ...base, alreadyReloaded: true })).toBe('notify');
  });
});

describe('fetchLatestBuild', () => {
  it('답을 그대로 돌려주고 캐시·쿠키를 쓰지 않는다', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ build: 'dpl_1' })));
    vi.stubGlobal('fetch', fetchMock);
    await expect(fetchLatestBuild()).resolves.toBe('dpl_1');
    expect(fetchMock).toHaveBeenCalledWith('/api/version', { cache: 'no-store', credentials: 'omit' });
  });

  it('실패·서버 오류·이상한 답은 null 이다', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    await expect(fetchLatestBuild()).resolves.toBeNull();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 500 })));
    await expect(fetchLatestBuild()).resolves.toBeNull();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<html>')));
    await expect(fetchLatestBuild()).resolves.toBeNull();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ build: 3 }))));
    await expect(fetchLatestBuild()).resolves.toBeNull();
  });
});

describe('되돌이 방지', () => {
  function stubStorage(store: Map<string, string>) {
    vi.stubGlobal('sessionStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => { store.set(k, v); },
    });
  }

  it('적어 둔 빌드만 이미 고쳤다고 답한다', () => {
    stubStorage(new Map());
    expect(alreadyReloadedFor('a')).toBe(false);
    expect(rememberReloadFor('a')).toBe(true);
    expect(alreadyReloadedFor('a')).toBe(true);
    expect(alreadyReloadedFor('b')).toBe(false);
  });

  it('저장소가 막혔으면 적지 못했다고 답한다', () => {
    vi.stubGlobal('sessionStorage', {
      getItem: () => { throw new Error('blocked'); },
      setItem: () => { throw new Error('blocked'); },
    });
    expect(alreadyReloadedFor('a')).toBe(false);
    expect(rememberReloadFor('a')).toBe(false);
  });
});
