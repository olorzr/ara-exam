import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { A4LayoutInfo } from './useA4Pagination';
import { usePaperBodyPages } from './usePaperBodyPages';

const info = (pageCount: number): A4LayoutInfo => ({ pageCount, blockPages: [] });

function setup(edition = 'paper') {
  return renderHook((props: { edition: string }) => usePaperBodyPages(props.edition), { initialProps: { edition } });
}

describe('usePaperBodyPages', () => {
  it('재기 전에는 null, 알림이 오면 그 쪽 수', () => {
    const hook = setup();
    expect(hook.result.current.bodyPages).toBeNull();
    act(() => hook.result.current.handleLayout(info(3)));
    expect(hook.result.current.bodyPages).toBe(3);
  });

  it('판을 바꾸면 새 판이 알릴 때까지 null — 옛 판의 수를 내주지 않는다', () => {
    const hook = setup('paper');
    act(() => hook.result.current.handleLayout(info(3)));
    hook.rerender({ edition: 'key' });
    expect(hook.result.current.bodyPages).toBeNull();
    act(() => hook.result.current.handleLayout(info(5)));
    expect(hook.result.current.bodyPages).toBe(5);
    hook.rerender({ edition: 'paper' });
    expect(hook.result.current.bodyPages).toBeNull();
  });

  it('알림 받이는 판이 같으면 같은 참조다 — 바뀌면 엔진이 옛 배치로 한 번 더 알린다', () => {
    const hook = setup();
    const first = hook.result.current.handleLayout;
    act(() => first(info(3)));
    hook.rerender({ edition: 'paper' });
    expect(hook.result.current.handleLayout).toBe(first);
    hook.rerender({ edition: 'teacher' });
    expect(hook.result.current.handleLayout).not.toBe(first);
  });
});
