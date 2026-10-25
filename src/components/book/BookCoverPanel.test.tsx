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
});
