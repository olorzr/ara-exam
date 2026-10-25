'use client';

import { useParams } from 'next/navigation';
import { BookCoverEditor, BookEditorShell } from '@/components/book';

/**
 * 표지 만들기 — 한 항목의 표지 (`/books/covers/[id]`) — **원장 전용**. 책의 표지도, 표지만 항목도 여기서 만든다.
 */
export default function BookCoverPage() {
  const params = useParams<{ id: string }>();
  return (
    <BookEditorShell bookId={params?.id ?? ''} listHref="/books/covers">
      {(book, state) => <BookCoverEditor book={book} state={state} />}
    </BookEditorShell>
  );
}
