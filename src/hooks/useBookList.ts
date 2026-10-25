'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { createBook, deleteBook, fetchBooks, type Book, type BookListItem } from '@/lib/book';

function message(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

/**
 * 책 목록 — 읽기·새 책·지우기.
 *
 * 로딩은 "읽어 두었는가" 에서 파생한다(효과 안 동기 setState 금지 규약). 원장 전용 화면에서만 부른다
 * (`enabled` — 문지기를 지나기 전에는 묻지 않는다).
 * @param enabled - 읽어도 되는가(원장 확인을 마쳤는가)
 * @returns 목록·로딩·만들기·지우기
 */
export function useBookList(enabled: boolean) {
  const [books, setBooks] = useState<BookListItem[] | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    fetchBooks()
      .then((rows) => { if (alive) setBooks(rows); })
      .catch((e) => {
        if (!alive) return;
        toast.error(message(e, '책 목록을 불러오지 못했어요.'));
        setBooks([]);
      });
    return () => { alive = false; };
  }, [enabled]);

  /** @returns 만든 책(실패하면 null) */
  const create = useCallback(async (title: string): Promise<Book | null> => {
    try {
      return await createBook(title);
    } catch (e) {
      toast.error(message(e, '책을 만들지 못했어요.'));
      return null;
    }
  }, []);

  const remove = useCallback(async (book: BookListItem) => {
    if (!window.confirm(`'${book.title}' 책을 지울까요? 장으로 담은 문제지는 그대로 남아요.`)) return;
    try {
      await deleteBook(book.id);
      setBooks((prev) => prev?.filter((b) => b.id !== book.id) ?? prev);
      toast.success('책을 지웠어요.');
    } catch (e) {
      toast.error(message(e, '책을 지우지 못했어요.'));
    }
  }, []);

  return { books: books ?? [], loading: enabled && books === null, create, remove };
}
