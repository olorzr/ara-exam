import { useCallback, useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { DEFAULT_BOOK_SETTINGS, type BookSettings } from '@/lib/book';
import BookSpineColorField from './BookSpineColorField';

const base: BookSettings = DEFAULT_BOOK_SETTINGS;

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('BookSpineColorField — 책등 색 직접 고르기', () => {
  it('끄는 동안은 저장하지 않고 멈춘 뒤 한 번, 저장이 실패해 되돌아가도 다시 보내지 않는다', () => {
    // useBook 처럼 — 보낸 설정을 먼저 얹었다가(낙관적) 실패하면 저장된 설정의 **새 객체**로 되돌린다
    const onSettings = vi.fn();
    function Harness() {
      const [current, setCurrent] = useState(base);
      const handle = useCallback((next: BookSettings) => {
        onSettings(next);
        setCurrent(next);
        setTimeout(() => setCurrent({ ...base }), 100);
      }, []);
      return <BookSpineColorField settings={current} disabled={false} onSettings={handle} />;
    }
    render(<Harness />);
    const input = screen.getByLabelText('책등 색 직접 고르기');
    fireEvent.change(input, { target: { value: '#112233' } });
    fireEvent.change(input, { target: { value: '#445566' } });
    expect(onSettings).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(600); });
    expect(onSettings).toHaveBeenCalledTimes(1);
    expect(onSettings.mock.calls[0][0].spineColor).toBe('#445566');
    act(() => { vi.advanceTimersByTime(5000); });
    expect(onSettings).toHaveBeenCalledTimes(1);
  });

  it('바로 고르는 색은 그 자리에서 저장한다', () => {
    const onSettings = vi.fn();
    render(<BookSpineColorField settings={base} disabled={false} onSettings={onSettings} />);
    fireEvent.click(screen.getByLabelText('버건디'));
    expect(onSettings).toHaveBeenCalledWith(expect.objectContaining({ spineColor: '#6b1e2e' }));
  });

  it('기다리는 사이 화면을 떠나면 고른 색을 그 자리에서 보낸다', () => {
    const onSettings = vi.fn();
    const { unmount } = render(<BookSpineColorField settings={base} disabled={false} onSettings={onSettings} />);
    fireEvent.change(screen.getByLabelText('책등 색 직접 고르기'), { target: { value: '#123456' } });
    expect(onSettings).not.toHaveBeenCalled();
    unmount();
    expect(onSettings).toHaveBeenCalledTimes(1);
    expect(onSettings.mock.calls[0][0].spineColor).toBe('#123456');
  });
});
