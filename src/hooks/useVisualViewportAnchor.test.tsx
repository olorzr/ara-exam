import { act, render } from '@testing-library/react';
import { useRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useVisualViewportAnchor } from './useVisualViewportAnchor';

/** 가짜 비주얼 뷰포트 — 값을 바꾸고 이벤트를 보낸다 */
function fakeViewport(init: { offsetLeft: number; offsetTop: number; width: number; height: number }) {
  const target = new EventTarget();
  const vv = Object.assign(target, { ...init, scale: 1 });
  vi.stubGlobal('visualViewport', vv);
  return vv;
}

function Probe({ enabled = true }: { enabled?: boolean }) {
  const ref = useRef<HTMLButtonElement>(null);
  useVisualViewportAnchor(ref, enabled);
  return <button ref={ref} type="button">오류 신고</button>;
}

afterEach(() => vi.unstubAllGlobals());

describe('useVisualViewportAnchor — 확대한 화면에서도 떠 있는 단추가 보이게 (코덱스 17R)', () => {
  it('확대하지 않았으면 옮기지 않고, 확대해 보이는 곳이 바뀌면 그 모서리로 옮긴다', () => {
    vi.spyOn(document.documentElement, 'clientWidth', 'get').mockReturnValue(412);
    vi.spyOn(document.documentElement, 'clientHeight', 'get').mockReturnValue(800);
    const vv = fakeViewport({ offsetLeft: 0, offsetTop: 0, width: 412, height: 800 });
    const { getByRole } = render(<Probe />);
    const button = getByRole('button');
    expect(button.style.transform).toBe('');
    // 2배 확대 — 보이는 곳은 왼쪽 위 206×400
    act(() => { Object.assign(vv, { width: 206, height: 400, scale: 2 }); vv.dispatchEvent(new Event('resize')); });
    expect(button.style.transform).toBe('translate(-206px, -400px)');
    // 아래로 옮겨 봄
    act(() => { Object.assign(vv, { offsetTop: 400, offsetLeft: 100 }); vv.dispatchEvent(new Event('scroll')); });
    expect(button.style.transform).toBe('translate(-106px, 0px)');
  });

  it('끄면 아무것도 하지 않고, visualViewport 가 없어도 그린다', () => {
    const vv = fakeViewport({ offsetLeft: 10, offsetTop: 10, width: 100, height: 100 });
    const { getByRole, unmount } = render(<Probe enabled={false} />);
    act(() => { vv.dispatchEvent(new Event('resize')); });
    expect(getByRole('button').style.transform).toBe('');
    unmount();
    vi.stubGlobal('visualViewport', null);
    expect(() => render(<Probe />)).not.toThrow();
  });
});
