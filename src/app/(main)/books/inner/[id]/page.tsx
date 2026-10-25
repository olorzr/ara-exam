'use client';

import { useParams } from 'next/navigation';
import { BookEditorShell, BookInnerEditor } from '@/components/book';

/**
 * 내지 만들기 — 책 한 권의 내지 (`/books/inner/[id]`) — **원장 전용**. 장 구성과 판별 내지 인쇄·쪽 수 재기.
 */
export default function BookInnerPage() {
  const params = useParams<{ id: string }>();
  return (
    <BookEditorShell bookId={params?.id ?? ''} listHref="/books/inner">
      {(book, state) => <BookInnerEditor book={book} state={state} />}
    </BookEditorShell>
  );
}
