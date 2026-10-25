import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { DEFAULT_BOOK_SETTINGS, type Book } from '@/lib/book';
import BookSettingsPanel from './BookSettingsPanel';

const book: Book = {
  id: 'b', title: '책', kind: 'book', finishedAt: null, settings: DEFAULT_BOOK_SETTINGS, pageCounts: {}, cover: null,
  userId: 'u', createdAt: '', updatedAt: '',
};

describe('BookSettingsPanel — 내지 설정만', () => {
  it('제목은 칸을 떠날 때 저장한다', () => {
    const onTitle = vi.fn();
    render(<BookSettingsPanel book={book} disabled={false} onTitle={onTitle} onSettings={vi.fn()} />);
    const input = screen.getByDisplayValue('책');
    fireEvent.change(input, { target: { value: '새 책' } });
    fireEvent.blur(input);
    expect(onTitle).toHaveBeenCalledWith('새 책');
  });

  it('표지 쪽 설정은 없고 표지 만들기로 보낸다', () => {
    render(<BookSettingsPanel book={book} disabled={false} onTitle={vi.fn()} onSettings={vi.fn()} />);
    expect(screen.queryByLabelText('책등 색 직접 고르기')).toBeNull();
    expect(screen.queryByLabelText('내지 용지')).toBeNull();
    expect(screen.queryByLabelText('뒷표지 바탕')).toBeNull();
    expect(screen.getByRole('link', { name: '표지 만들기' }).getAttribute('href')).toBe('/books/covers/b');
  });
});
