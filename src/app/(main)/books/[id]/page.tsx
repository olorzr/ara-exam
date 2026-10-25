'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import {
  BookComposePanel, BookCoverMode, BookInnerMode, BookToolbar, type BookMode,
} from '@/components/book';
import { useBook } from '@/hooks/useBook';
import { useDirectorGate } from '@/hooks/useDirectorGate';
import type { BookEdition } from '@/lib/book';

/**
 * 책 한 권 (`/books/[id]`) — **원장 전용**. 구성(장·설정·표지) / 내지 / 표지 펼침면.
 *
 * ⚠️ 내지와 표지는 **따로 마운트**한다 — 인쇄 작업 하나에 용지 크기는 하나뿐이다(내지 A4, 표지 작업사이즈).
 *    표지 화면은 내지 화면이 재서 저장한 쪽 수로 책등을 그린다(`books.page_counts`).
 */
export default function BookPage() {
  const params = useParams<{ id: string }>();
  const bookId = params?.id ?? '';
  const gate = useDirectorGate();
  const state = useBook(bookId, gate.allowed);
  const [mode, setMode] = useState<BookMode>('compose');
  const [edition, setEdition] = useState<BookEdition>('student');

  if (gate.checking || !gate.allowed || !state.loaded) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
      </div>
    );
  }

  const { book, chapters } = state;
  if (!book) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-gray-500">
          {state.failed ? '책을 불러오지 못했어요.' : '책을 찾지 못했어요.'}{' '}
          <Link href="/books" className="text-primary underline underline-offset-2">목록으로</Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <BookToolbar
        book={book} chapterCount={chapters.length}
        mode={mode} onModeChange={setMode} edition={edition} onEditionChange={setEdition}
      />
      {mode === 'compose' && <BookComposePanel book={book} state={state} />}
      {mode === 'inner' && (
        <BookInnerMode book={book} chapters={chapters} edition={edition} savePageCount={state.savePageCount} />
      )}
      {mode === 'cover' && (
        <BookCoverMode
          book={book} chapters={chapters} edition={edition} creatorName={state.creatorName}
          onGoInner={() => setMode('inner')}
        />
      )}
    </div>
  );
}
