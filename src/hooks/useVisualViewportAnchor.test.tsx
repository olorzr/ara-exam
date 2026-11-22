import { act, render } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useVisualViewportAnchor, type ViewportAnchor } from './useVisualViewportAnchor';

/** 가짜 비주얼 뷰포트 — 값을 바꾸고 이벤트를 보낸다 */
function fakeViewport(init: { offsetLeft: number; offsetTop: number; width: number; height: number; scale?: number }) {
  const vv = Object.assign(new EventTarget(), { scale: 1, ...init });
  vi.stubGlobal('visualViewport', vv);
  return vv;
}

function Probe({ enabled = true, anchor = 'corner' }: { enabled?: boolean; anchor?: ViewportAnchor }) {
  const [el, setEl] = useState<HTMLButtonElement | null>(null);
  useVisualViewportAnchor(el, enabled, anchor);
  return <button ref={setEl} type="button" style={{ position: 'fixed', right: 16, bottom: 16 }}>오류 신고</button>;
}

beforeEach(() => {
  vi.spyOn(document.documentElement, 'clientWidth', 'get').mockReturnValue(412);
  vi.spyOn(document.documentElement, 'clientHeight', 'get').mockReturnValue(800);
});
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('useVisualViewportAnchor — 확대한 화면에서도 보이는 곳에 같은 크기로 (코덱스 17·18R)', () => {
  it('확대하지 않았으면 그대로, 확대하면 보이는 곳 오른쪽 아래로 옮기고 1/배율로 줄인다(바깥 여백도)', () => {
    const vv = fakeViewport({ offsetLeft: 0, offsetTop: 0, width: 412, height: 800 });
    const { getByRole } = render(<Probe />);
    const button = getByRole('button');
    expect(button.style.transform).toBe('');
    // 2배 확대 — 보이는 곳은 왼쪽 위 206×400. 여백 16px 은 8px 로(실제 크기 16)
    act(() => { Object.assign(vv, { width: 206, height: 400, scale: 2 }); vv.dispatchEvent(new Event('resize')); });
    expect(button.style.transform).toBe('translate(-198px, -392px) scale(0.5)');
    expect(button.style.transformOrigin).toBe('bottom right');
    act(() => { Object.assign(vv, { offsetTop: 400, offsetLeft: 100 }); vv.dispatchEvent(new Event('scroll')); });
    expect(button.style.transform).toBe('translate(-98px, 8px) scale(0.5)');
    // 확대를 풀면 되돌린다
    act(() => { Object.assign(vv, { offsetTop: 0, offsetLeft: 0, width: 412, height: 800, scale: 1 }); vv.dispatchEvent(new Event('resize')); });
    expect(button.style.transform).toBe('');
  });

  it('가운데(창)는 보이는 곳의 가운데에 두고 1/배율로 줄인다', () => {
    const vv = fakeViewport({ offsetLeft: 0, offsetTop: 0, width: 412, height: 800 });
    const { getByRole } = render(<Probe anchor="center" />);
    act(() => { Object.assign(vv, { offsetLeft: 100, offsetTop: 200, width: 137, height: 266, scale: 3 }); vv.dispatchEvent(new Event('resize')); });
    const el = getByRole('button');
    expect(el.style.left).toBe('168.5px');
    expect(el.style.top).toBe('333px');
    expect(el.style.transform).toBe(`scale(${1 / 3})`);
    // 줄인 뒤에도 보이는 높이 안에 들게 — 266 × 3 − 32
    expect(el.style.maxHeight).toBe('766px');
  });

  it('가운데(창)는 확대 없이 키보드만 올라와 보이는 곳이 줄었을 때는 손대지 않는다(코덱스 19R)', () => {
    const vv = fakeViewport({ offsetLeft: 0, offsetTop: 0, width: 412, height: 800 });
    const { getByRole } = render(<Probe anchor="center" />);
    act(() => { Object.assign(vv, { height: 450 }); vv.dispatchEvent(new Event('resize')); });
    const el = getByRole('button');
    expect(el.style.left).toBe('');
    expect(el.style.transform).toBe('');
    expect(el.style.maxHeight).toBe('');
  });

  it('끄면 아무것도 하지 않고, visualViewport 가 없어도 그린다', () => {
    const vv = fakeViewport({ offsetLeft: 10, offsetTop: 10, width: 100, height: 100, scale: 4 });
    const { getByRole, unmount } = render(<Probe enabled={false} />);
    act(() => { vv.dispatchEvent(new Event('resize')); });
    expect(getByRole('button').style.transform).toBe('');
    unmount();
    vi.stubGlobal('visualViewport', null);
    expect(() => render(<Probe />)).not.toThrow();
  });
});
