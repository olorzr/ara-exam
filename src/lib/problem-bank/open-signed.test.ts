import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('./storage', () => ({ signProblemFile: vi.fn() }));

const { openSignedInNewTab } = await import('./open-signed');

/** 가짜 새 탭 */
function fakeTab() {
  return { opener: {} as unknown, location: { href: 'about:blank' }, close: vi.fn() };
}

afterEach(() => vi.restoreAllMocks());

describe('openSignedInNewTab', () => {
  it('빈 탭을 먼저 열고(팝업 차단 회피) 새로 서명한 주소로 옮긴 뒤 opener 를 끊는다', async () => {
    const tab = fakeTab();
    const open = vi.spyOn(window, 'open').mockReturnValue(tab as unknown as Window);
    const sign = vi.fn(async () => 'https://signed/new');
    const result = await openSignedInNewTab('sources/s1/original.pdf', sign);
    expect(open).toHaveBeenCalledWith('about:blank', '_blank');
    // 서명보다 탭 열기가 먼저다 — 기다린 뒤에 열면 팝업 차단이 막는다
    expect(open.mock.invocationCallOrder[0]).toBeLessThan(sign.mock.invocationCallOrder[0]);
    expect(sign).toHaveBeenCalledWith('sources/s1/original.pdf');
    expect(tab.location.href).toBe('https://signed/new');
    expect(tab.opener).toBeNull();
    expect(result).toBe('opened');
  });

  it('서명에 실패하면 빈 탭을 닫는다', async () => {
    const tab = fakeTab();
    vi.spyOn(window, 'open').mockReturnValue(tab as unknown as Window);
    expect(await openSignedInNewTab('x.pdf', async () => null)).toBe('failed');
    expect(tab.close).toHaveBeenCalled();
    expect(await openSignedInNewTab('x.pdf', async () => { throw new Error('net'); })).toBe('failed');
  });

  it('팝업이 막히면 서명하지 않고 알린다', async () => {
    vi.spyOn(window, 'open').mockReturnValue(null);
    const sign = vi.fn(async () => 'https://signed/new');
    expect(await openSignedInNewTab('x.pdf', sign)).toBe('blocked');
    expect(sign).not.toHaveBeenCalled();
  });
});
