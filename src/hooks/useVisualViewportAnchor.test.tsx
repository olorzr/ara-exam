import { act, render } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useVisualViewportAnchor } from './useVisualViewportAnchor';

/** 가짜 비주얼 뷰포트 — 값을 바꾸고 이벤트를 보낸다 */
function fakeViewport(init: { offsetLeft: number; offsetTop: number; width: number; height: number; scale?: number }) {
  const vv = Object.assign(new EventTarget(), { scale: 1, ...init });
  vi.stubGlobal('visualViewport', vv);
  return vv;
}

function Probe({ enabled = true }: { enabled?: boolean }) {
  const [el, setEl] = useState<HTMLButtonElement | null>(null);
  useVisualViewportAnchor(el, enabled);
  return <button ref={setEl} type="button" style={{ position: 'fixed', right: 16, bottom: 16 }}>오류 신고</button>;
}

/** 옮기지 않은 단추 자리 — 412×800 화면 오른쪽 아래에서 16px 안쪽 */
let rect = { right: 396, bottom: 784 };
beforeEach(() => {
  rect = { right: 396, bottom: 784 };
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
    () => ({ ...rect, left: rect.right - 100, top: rect.bottom - 44, width: 100, height: 44, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect,
  );
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

  it('확대하지 않았어도 문서가 넘쳐 단추가 보이는 곳 밖이면 옮긴다 — 실제 자리를 잰다(코덱스 23R)', () => {
    rect = { right: 587, bottom: 1460 };
    const vv = fakeViewport({ offsetLeft: 0, offsetTop: 0, width: 412, height: 800 });
    const { getByRole } = render(<Probe />);
    act(() => { vv.dispatchEvent(new Event('resize')); });
    expect(getByRole('button').style.transform).toBe('translate(-191px, -676px) scale(1)');
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
