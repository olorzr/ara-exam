import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useObjectUrl } from './useObjectUrl';

describe('useObjectUrl', () => {
  afterEach(() => vi.restoreAllMocks());

  it('파일이 없으면 null', () => {
    expect(renderHook(() => useObjectUrl(null)).result.current).toBeNull();
  });

  it('파일 주소를 만들고, 파일이 바뀌거나 떠나면 돌려준다', () => {
    let n = 0;
    Object.assign(URL, { createObjectURL: () => `blob:${(n += 1)}`, revokeObjectURL: () => {} });
    const revoke = vi.spyOn(URL, 'revokeObjectURL');
    const a = new File(['a'], 'a.png');
    const b = new File(['b'], 'b.png');
    const { result, rerender, unmount } = renderHook(({ file }) => useObjectUrl(file), { initialProps: { file: a } });
    expect(result.current).toBe('blob:1');
    rerender({ file: b });
    expect(result.current).toBe('blob:2');
    expect(revoke).toHaveBeenCalledWith('blob:1');
    unmount();
    expect(revoke).toHaveBeenCalledWith('blob:2');
  });
});
