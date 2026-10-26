import { useCallback, useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { DEFAULT_BOOK_SETTINGS, SPINE_INK_PRESETS, type BookSettings } from '@/lib/book';
import BookSpineColorField from './BookSpineColorField';

const base: BookSettings = DEFAULT_BOOK_SETTINGS;

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('BookSpineColorField — 책등 색 직접 고르기', () => {
  it('끄는 동안은 저장하지 않고 멈춘 뒤 한 번, 저장이 실패해 되돌아가도 다시 보내지 않는다', () => {
    // useBook 처럼 — 보낸 설정을 먼저 얹었다가(낙관적) 실패하면 저장된 설정의 **새 객체**로 되돌린다
    const onPatch = vi.fn();
    function Harness() {
      const [current, setCurrent] = useState(base);
      const handle = useCallback((patch: Partial<BookSettings>) => {
        onPatch(patch);
        setCurrent((prev) => ({ ...prev, ...patch }));
        setTimeout(() => setCurrent({ ...base }), 100);
      }, []);
      return <BookSpineColorField settings={current} disabled={false} onPatch={handle} />;
    }
    render(<Harness />);
    const input = screen.getByLabelText('책등 색 직접 고르기');
    fireEvent.change(input, { target: { value: '#112233' } });
    fireEvent.change(input, { target: { value: '#445566' } });
    expect(onPatch).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(600); });
    expect(onPatch).toHaveBeenCalledTimes(1);
    expect(onPatch.mock.calls[0][0]).toEqual({ spineColor: '#445566' });
    act(() => { vi.advanceTimersByTime(5000); });
    expect(onPatch).toHaveBeenCalledTimes(1);
  });

  it('바로 고르는 색은 그 자리에서 그 칸만 보낸다', () => {
    const onPatch = vi.fn();
    render(<BookSpineColorField settings={base} disabled={false} onPatch={onPatch} />);
    fireEvent.click(screen.getByLabelText('민트'));
    expect(onPatch).toHaveBeenCalledWith({ spineColor: '#bfe5d9' });
  });

  it('기다리는 사이 화면을 떠나면 고른 색을 그 자리에서 보낸다', () => {
    const onPatch = vi.fn();
    const { unmount } = render(<BookSpineColorField settings={base} disabled={false} onPatch={onPatch} />);
    fireEvent.change(screen.getByLabelText('책등 색 직접 고르기'), { target: { value: '#123456' } });
    expect(onPatch).not.toHaveBeenCalled();
    unmount();
    expect(onPatch).toHaveBeenCalledTimes(1);
    expect(onPatch.mock.calls[0][0]).toEqual({ spineColor: '#123456' });
  });

  it('글자색 칸 — 자동 단추가 맨 앞에 있고 자동이 골라져 있으며, 자동을 다시 고르면 auto 로 보낸다', () => {
    const onPatch = vi.fn();
    const inkField = (settings: BookSettings) => (
      <BookSpineColorField
        settings={settings} disabled={false} onPatch={onPatch}
        field="spineInk" legend="책등 글자 색" presets={SPINE_INK_PRESETS} auto={{ label: '자동', preview: '#111111' }}
      />
    );
    const { rerender } = render(inkField(base));
    expect(screen.getByLabelText('자동').getAttribute('aria-pressed')).toBe('true');
    expect((screen.getByLabelText('책등 글자 색 직접 고르기') as HTMLInputElement).value).toBe('#111111');
    fireEvent.click(screen.getByLabelText('흰색'));
    expect(onPatch).toHaveBeenLastCalledWith({ spineInk: '#ffffff' });
    rerender(inkField({ ...base, spineInk: '#111111' }));
    expect(screen.getByLabelText('검정').getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByLabelText('자동'));
    expect(onPatch).toHaveBeenLastCalledWith({ spineInk: 'auto' });
  });
});
