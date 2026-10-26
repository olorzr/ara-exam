import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { DEFAULT_BOOK_SETTINGS, type Book } from '@/lib/book';

vi.mock('@/hooks/useCoverImages', () => ({ useCoverImages: () => ({ frontUrl: undefined, backUrl: undefined }) }));
vi.mock('@/hooks/useBookCover', () => ({ useBookCover: () => ({ saving: false, save: vi.fn(), remove: vi.fn() }) }));
vi.mock('@/components/problem-paper/PaperCoverDialog', () => ({ default: () => null }));
vi.mock('sonner', () => ({ toast: { error: vi.fn() } }));
const { default: BookCoverPanel } = await import('./BookCoverPanel');

const book: Book = {
  id: 'b', title: '표지', kind: 'cover', finishedAt: null, settings: DEFAULT_BOOK_SETTINGS, pageCounts: {}, cover: null,
  userId: 'u', createdAt: '', updatedAt: '',
};
const stateOf = (save = vi.fn(async () => true)) => ({ save, chapters: [], creatorName: '' }) as never;

describe('BookCoverPanel — 제목(코덱스 2R)', () => {
  it('표지만 항목은 여기서 제목을 고친다', () => {
    const save = vi.fn(async () => true);
    render(<BookCoverPanel book={book} edition="student" state={stateOf(save)} />);
    const input = screen.getByDisplayValue('표지');
    fireEvent.change(input, { target: { value: '새 표지' } });
    fireEvent.blur(input);
    expect(save).toHaveBeenCalledWith({ title: '새 표지' });
  });

  it('책은 제목을 내지 설정에서 고친다 — 여기에는 칸이 없다', () => {
    render(<BookCoverPanel book={{ ...book, kind: 'book' }} edition="student" state={stateOf()} />);
    expect(screen.queryByDisplayValue('표지')).toBeNull();
    expect(screen.getByLabelText('내지 용지')).toBeTruthy();
  });

  it('책등 글꼴 칸이 있고 고르면 설정을 저장한다', () => {
    const save = vi.fn(async () => true);
    render(<BookCoverPanel book={book} edition="student" state={stateOf(save)} />);
    fireEvent.click(screen.getByLabelText('페이퍼로지'));
    expect(save).toHaveBeenCalledWith({ settings: { ...DEFAULT_BOOK_SETTINGS, spineFont: 'paperozi' } });
  });

  it('책등 글자 색 — 고르면 저장하고, 바탕과 비슷하면 잘 안 보인다고 알린다', () => {
    const save = vi.fn(async () => true);
    render(<BookCoverPanel book={book} edition="student" state={stateOf(save)} />);
    expect(screen.queryByRole('status')).toBeNull();
    fireEvent.click(screen.getByLabelText('진보라'));
    expect(save).toHaveBeenCalledWith({ settings: { ...DEFAULT_BOOK_SETTINGS, spineInk: '#5a3d8a' } });

    const pale = { ...book, settings: { ...DEFAULT_BOOK_SETTINGS, spineInk: '#ffffff' } };
    render(<BookCoverPanel book={pale} edition="student" state={stateOf()} />);
    expect(screen.getByRole('status').textContent).toContain('잘 안 보일 수 있어요');
  });

  it('두 색 칸이 함께 저장을 미뤄 둔 채 화면을 떠나도 둘 다 남는다(코덱스 2026-10-26 1R)', () => {
    vi.useFakeTimers();
    try {
      const save = vi.fn(async () => true);
      const { unmount } = render(<BookCoverPanel book={book} edition="student" state={stateOf(save)} />);
      fireEvent.change(screen.getByLabelText('책등 색 직접 고르기'), { target: { value: '#123456' } });
      fireEvent.change(screen.getByLabelText('책등 글자 색 직접 고르기'), { target: { value: '#abcdef' } });
      expect(save).not.toHaveBeenCalled();
      unmount();
      expect(save).toHaveBeenCalledTimes(2);
      const last = (save.mock.calls.at(-1) as unknown as [{ settings: { spineColor: string; spineInk: string } }])[0];
      expect(last.settings.spineColor).toBe('#123456');
      expect(last.settings.spineInk).toBe('#abcdef');
    } finally {
      vi.useRealTimers();
    }
  });
});
