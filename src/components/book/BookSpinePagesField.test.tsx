import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { DEFAULT_BOOK_SETTINGS, type Book } from '@/lib/book';

vi.mock('sonner', () => ({ toast: { error: vi.fn() } }));
const { default: BookSpinePagesField } = await import('./BookSpinePagesField');

const book: Book = {
  id: 'b', title: '책', kind: 'cover', finishedAt: null, settings: DEFAULT_BOOK_SETTINGS, pageCounts: {}, cover: null,
  userId: 'u', createdAt: '', updatedAt: '',
};

describe('BookSpinePagesField — 표지만', () => {
  it('칸을 떠날 때 그 판의 쪽 수를 저장하고, 비우면 뺀다', () => {
    const onSettings = vi.fn();
    const typed = { ...book, settings: { ...book.settings, manualPages: { teacher: 40 } } };
    render(<BookSpinePagesField book={typed} chapters={[]} edition="student" disabled={false} onSettings={onSettings} />);
    const student = screen.getByLabelText('학생용 내지 쪽 수');
    fireEvent.change(student, { target: { value: '98' } });
    fireEvent.blur(student);
    expect(onSettings).toHaveBeenLastCalledWith(expect.objectContaining({ manualPages: { teacher: 40, student: 98 } }));

    const teacher = screen.getByLabelText('교사용 내지 쪽 수');
    fireEvent.change(teacher, { target: { value: '' } });
    fireEvent.blur(teacher);
    expect(onSettings).toHaveBeenLastCalledWith(expect.objectContaining({ manualPages: {} }));
  });

  it('쓸 수 없는 값은 저장하지 않고 되돌린다', () => {
    const onSettings = vi.fn();
    render(<BookSpinePagesField book={book} chapters={[]} edition="student" disabled={false} onSettings={onSettings} />);
    const input = screen.getByLabelText('학생용 내지 쪽 수') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '0' } });
    fireEvent.blur(input);
    expect(onSettings).not.toHaveBeenCalled();
    expect(input.value).toBe('');
  });

  it('4의 배수로 올린 쪽 수와 책등 폭을 보여 준다', () => {
    const typed = { ...book, settings: { ...book.settings, manualPages: { student: 98 } } };
    render(<BookSpinePagesField book={typed} chapters={[]} edition="student" disabled={false} onSettings={vi.fn()} />);
    expect(screen.getByText(/4의 배수로 올려 100쪽/)).toBeTruthy();
  });
});

describe('BookSpinePagesField — 책', () => {
  it('아직 안 쟀으면 내지 만들기로 보낸다', () => {
    render(
      <BookSpinePagesField book={{ ...book, kind: 'book' }} chapters={[]} edition="teacher" disabled={false} onSettings={vi.fn()} />,
    );
    expect(screen.getByText(/교사용 내지 쪽 수를 아직 재지 않았어요/)).toBeTruthy();
    expect(screen.getByRole('link', { name: /내지 만들기로/ }).getAttribute('href')).toBe('/books/inner/b');
    expect(screen.queryByLabelText('학생용 내지 쪽 수')).toBeNull();
  });
});
