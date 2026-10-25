'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  allBookWritesSettled, BOOK_KIND_LABELS, createBook, deleteBook, enqueueBookWrite, fetchBooks, updateBook,
  type Book, type BookKind, type BookListItem, type BookListQuery,
} from '@/lib/book';

function message(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

/** 읽어 둔 목록 — 어느 조건의 것인지와 함께 든다(조건이 바뀌면 옛 목록을 새 조건의 것처럼 내주지 않는다) */
interface Loaded {
  key: string;
  books: BookListItem[];
}

/**
 * 책 목록 — 읽기·새 항목·지우기·다 만든 표시.
 *
 * 로딩은 "어느 조건의 목록을 읽어 두었는가" 에서 파생한다(효과 안 동기 setState 금지 규약). 원장 전용 화면에서만 부른다
 * (`enabled` — 문지기를 지나기 전에는 묻지 않는다). 세 화면(표지 만들기 · 내지 만들기 · 다 만든 책)이 조건만 바꿔 쓴다.
 * @param enabled - 읽어도 되는가(원장 확인을 마쳤는가)
 * @param query - 목록 조건
 * @returns 목록·로딩·만들기·지우기·다 만든 표시
 */
export function useBookList(enabled: boolean, query: BookListQuery) {
  const { kind, finished } = query;
  const key = `${kind ?? ''}|${finished}`;
  const [loaded, setLoaded] = useState<Loaded | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    // 도는 쓰기(다 만든 표시·지우기·편집 화면의 저장)가 끝난 뒤에 읽는다 — 저장 전 목록을 받으면 다시 읽을 계기가 없다
    allBookWritesSettled()
      .then(() => fetchBooks({ kind, finished }))
      .then((books) => { if (alive) setLoaded({ key, books }); })
      .catch((e) => {
        if (!alive) return;
        toast.error(message(e, '책 목록을 불러오지 못했어요.'));
        setLoaded({ key, books: [] });
      });
    return () => { alive = false; };
  }, [enabled, key, kind, finished]);

  const current = loaded?.key === key ? loaded : null;
  /** 이 목록에서 한 줄을 뺀다 — 지웠거나 다른 목록으로 옮겨 갔다 */
  const drop = useCallback((id: string) => {
    setLoaded((prev) => (prev && prev.key === key ? { ...prev, books: prev.books.filter((b) => b.id !== id) } : prev));
  }, [key]);

  /** @returns 만든 항목(실패하면 null) */
  const create = useCallback(async (title: string, newKind: BookKind): Promise<Book | null> => {
    try {
      return await createBook(title, newKind);
    } catch (e) {
      toast.error(message(e, '만들지 못했어요.'));
      return null;
    }
  }, []);

  const remove = useCallback(async (book: BookListItem) => {
    const tail = book.kind === 'book' ? ' 장으로 담은 문제지는 그대로 남아요.' : '';
    if (!window.confirm(`'${book.title}' ${BOOK_KIND_LABELS[book.kind]} 항목을 지울까요?${tail}`)) return;
    try {
      await enqueueBookWrite(book.id, 'fields', () => deleteBook(book.id));
      drop(book.id);
      toast.success('지웠어요.');
    } catch (e) {
      toast.error(message(e, '지우지 못했어요.'));
    }
  }, [drop]);

  /** '다 만들었어요' / '다시 작업' — 성공하면 다른 목록으로 옮겨 가므로 이 목록에서 뺀다 */
  const setFinished = useCallback(async (book: BookListItem, next: boolean) => {
    try {
      // 편집 화면과 같은 줄에 선다 — 그 책을 바로 열면 새 화면이 이 쓰기가 끝난 뒤에 읽는다
      await enqueueBookWrite(book.id, 'fields', () => updateBook(book.id, { finished_at: next ? new Date().toISOString() : null }));
      drop(book.id);
      toast.success(next ? `'${book.title}' 을 다 만든 책으로 옮겼어요.` : `'${book.title}' 을 다시 만드는 중으로 옮겼어요.`);
    } catch (e) {
      toast.error(message(e, '다 만든 표시를 저장하지 못했어요.'));
    }
  }, [drop]);

  return {
    books: current?.books ?? [],
    loading: enabled && current === null,
    create,
    remove,
    setFinished,
  };
}
