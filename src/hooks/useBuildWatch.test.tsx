import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BUILD_AWAY_MS, BUILD_POLL_MS, BUILD_RECHECK_GAP_MS } from '@/lib/build-watch';
import { holdWorkInProgress } from '@/lib/work-in-progress';
import { useBuildWatch } from './useBuildWatch';

const mocks = vi.hoisted(() => ({
  build: 'old', latest: 'old' as string | null, reload: vi.fn(), toast: vi.fn(), remember: true, tried: false,
  fetchLatest: vi.fn(),
}));

vi.mock('sonner', () => ({ toast: mocks.toast }));
vi.mock('@/lib/build-id', () => ({
  DEV_BUILD_ID: 'dev',
  get BUILD_ID() { return mocks.build; },
}));
vi.mock('@/lib/build-watch', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/build-watch')>()),
  fetchLatestBuild: mocks.fetchLatest,
  reloadPage: mocks.reload,
  alreadyReloadedFor: () => mocks.tried,
  rememberReloadFor: () => mocks.remember,
}));

async function flush() {
  await act(async () => { await Promise.resolve(); await Promise.resolve(); });
}

function setVisibility(value: DocumentVisibilityState) {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => value });
}

async function returnToTab() {
  setVisibility('visible');
  await act(async () => {
    document.dispatchEvent(new Event('visibilitychange'));
    await Promise.resolve();
    await Promise.resolve();
  });
}

/** 탭을 숨기고 그만큼 지난 뒤 돌아온다 */
async function awayFor(ms: number) {
  setVisibility('hidden');
  document.dispatchEvent(new Event('visibilitychange'));
  vi.advanceTimersByTime(ms);
  await returnToTab();
}

beforeEach(() => {
  vi.useFakeTimers();
  mocks.build = 'old';
  mocks.latest = 'old';
  mocks.remember = true;
  mocks.tried = false;
  mocks.reload.mockReset();
  mocks.toast.mockReset();
  mocks.fetchLatest.mockReset();
  mocks.fetchLatest.mockImplementation(async () => mocks.latest);
  setVisibility('visible');
  window.history.replaceState(null, '', '/problems/archive');
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useBuildWatch', () => {
  it('개발 빌드에서는 묻지 않는다', async () => {
    mocks.build = 'dev';
    renderHook(() => useBuildWatch());
    await flush();
    expect(mocks.fetchLatest).not.toHaveBeenCalled();
  });

  it('같은 빌드면 아무 일도 없다', async () => {
    renderHook(() => useBuildWatch());
    await flush();
    expect(mocks.fetchLatest).toHaveBeenCalledTimes(1);
    expect(mocks.reload).not.toHaveBeenCalled();
    expect(mocks.toast).not.toHaveBeenCalled();
  });

  it('오래 비운 탭으로 돌아왔을 때 새 배포를 알면 새로 고친다', async () => {
    renderHook(() => useBuildWatch());
    await flush();
    mocks.latest = 'new';
    await awayFor(BUILD_AWAY_MS);
    expect(mocks.reload).toHaveBeenCalledTimes(1);
  });

  it('창만 잠깐 비웠다 돌아오면 저장이 돌고 있을 수 있어 안내만 한다', async () => {
    renderHook(() => useBuildWatch());
    await flush();
    mocks.latest = 'new';
    await awayFor(BUILD_RECHECK_GAP_MS);
    expect(mocks.reload).not.toHaveBeenCalled();
    expect(mocks.toast).toHaveBeenCalledTimes(1);
  });

  it('탭이 보인 채 다른 창을 오래 쓰다 돌아와도 비운 시간으로 친다', async () => {
    renderHook(() => useBuildWatch());
    await flush();
    mocks.latest = 'new';
    window.dispatchEvent(new Event('blur'));
    vi.advanceTimersByTime(BUILD_AWAY_MS);
    await act(async () => { window.dispatchEvent(new Event('focus')); await Promise.resolve(); await Promise.resolve(); });
    expect(mocks.reload).toHaveBeenCalledTimes(1);
  });

  it('책 저장 줄이 도는 동안은 다른 화면으로 돌아와도 새로 고치지 않는다', async () => {
    const { enqueueBookWrite } = await import('@/lib/book/write-queue');
    let finish: () => void = () => undefined;
    const write = enqueueBookWrite('b1', 'fields', () => new Promise<void>((resolve) => { finish = resolve; }));
    renderHook(() => useBuildWatch());
    await flush();
    mocks.latest = 'new';
    await awayFor(BUILD_AWAY_MS);
    expect(mocks.reload).not.toHaveBeenCalled();
    expect(mocks.toast).toHaveBeenCalledTimes(1);
    await act(async () => { finish(); await write; await Promise.resolve(); });
  });

  it('작업 중이면 새로 고치지 않고 안내한다', async () => {
    const release = holdWorkInProgress();
    mocks.latest = 'new';
    renderHook(() => useBuildWatch());
    await flush();
    release();
    expect(mocks.reload).not.toHaveBeenCalled();
    expect(mocks.toast).toHaveBeenCalledTimes(1);
  });

  it('허용 목록 밖의 화면은 안내만 한다', async () => {
    window.history.replaceState(null, '', '/words/new');
    mocks.latest = 'new';
    renderHook(() => useBuildWatch());
    await flush();
    expect(mocks.reload).not.toHaveBeenCalled();
    expect(mocks.toast).toHaveBeenCalledTimes(1);
  });

  it('보고 있는 동안의 검사는 안내만 하고 숨긴 탭은 묻지 않는다', async () => {
    renderHook(() => useBuildWatch());
    await flush();
    mocks.latest = 'new';
    setVisibility('hidden');
    await act(async () => { vi.advanceTimersByTime(BUILD_POLL_MS); await Promise.resolve(); });
    expect(mocks.fetchLatest).toHaveBeenCalledTimes(1);
    setVisibility('visible');
    await act(async () => { vi.advanceTimersByTime(BUILD_POLL_MS); await Promise.resolve(); await Promise.resolve(); });
    expect(mocks.fetchLatest).toHaveBeenCalledTimes(2);
    expect(mocks.reload).not.toHaveBeenCalled();
    expect(mocks.toast).toHaveBeenCalledTimes(1);
  });

  it('이미 이 빌드로 새로 고쳤으면 되풀이하지 않고 안내한다', async () => {
    mocks.latest = 'new';
    mocks.tried = true;
    renderHook(() => useBuildWatch());
    await flush();
    expect(mocks.reload).not.toHaveBeenCalled();
    expect(mocks.toast).toHaveBeenCalledTimes(1);
  });

  it('되돌이 표시를 적지 못하면 새로 고치지 않고 안내한다', async () => {
    mocks.latest = 'new';
    mocks.remember = false;
    renderHook(() => useBuildWatch());
    await flush();
    expect(mocks.reload).not.toHaveBeenCalled();
    expect(mocks.toast).toHaveBeenCalledTimes(1);
  });

  it('창을 잇달아 오가도 간격 안에서는 다시 묻지 않는다', async () => {
    renderHook(() => useBuildWatch());
    await flush();
    await returnToTab();
    await act(async () => { window.dispatchEvent(new Event('focus')); await Promise.resolve(); });
    expect(mocks.fetchLatest).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(BUILD_RECHECK_GAP_MS);
    await returnToTab();
    expect(mocks.fetchLatest).toHaveBeenCalledTimes(2);
  });

  it('못 물었으면 아무것도 하지 않고 다음에 다시 묻는다', async () => {
    mocks.latest = null;
    renderHook(() => useBuildWatch());
    await flush();
    expect(mocks.reload).not.toHaveBeenCalled();
    expect(mocks.toast).not.toHaveBeenCalled();
    mocks.latest = 'new';
    await awayFor(BUILD_AWAY_MS);
    expect(mocks.reload).toHaveBeenCalledTimes(1);
  });

  it('화면을 떠난 뒤 온 답은 버린다', async () => {
    let answer: (value: string) => void = () => undefined;
    mocks.fetchLatest.mockImplementation(() => new Promise<string>((resolve) => { answer = resolve; }));
    const view = renderHook(() => useBuildWatch());
    view.unmount();
    answer('new');
    await flush();
    expect(mocks.reload).not.toHaveBeenCalled();
  });
});
