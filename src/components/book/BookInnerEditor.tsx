'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import type { Book, BookEdition } from '@/lib/book';
import BookComposePanel from './BookComposePanel';
import type { BookState } from './BookEditorShell';
import BookFinishControl from './BookFinishControl';
import BookInnerMode from './BookInnerMode';
import BookToolbar, { INNER_MODES, type BookMode } from './BookToolbar';

interface BookInnerEditorProps {
  book: Book;
  state: BookState;
}

/**
 * 내지 만들기 — 구성(장 담기·차례·내지 설정) / 내지(한 판을 그리고 쪽 수를 재서 저장하고 A4 로 인쇄).
 * 표지는 표지 만들기 화면에서 이 쪽 수로 책등을 그린다.
 *
 * ⚠️ 표지만 항목은 내지가 없다 — 구성을 그리지 않는다(그리면 표지만 항목에 장을 담을 수 있게 된다).
 */
export default function BookInnerEditor({ book, state }: BookInnerEditorProps) {
  const [mode, setMode] = useState<BookMode>('compose');
  const [edition, setEdition] = useState<BookEdition>('student');

  if (book.kind === 'cover') {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-gray-500">
          &lsquo;{book.title}&rsquo; 은 표지만 만드는 항목이라 내지가 없어요.{' '}
          <Link href={`/books/covers/${book.id}`} className="text-primary underline underline-offset-2">표지 만들기로</Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <BookToolbar
        book={book} backHref="/books/inner" chapterCount={state.chapters.length}
        modes={INNER_MODES} mode={mode} onModeChange={setMode}
        edition={edition} onEditionChange={setEdition}
        trailing={<BookFinishControl finishedAt={book.finishedAt} onToggle={(f) => { void state.setFinished(f); }} />}
      />
      {mode === 'compose' && <BookComposePanel book={book} state={state} />}
      {mode === 'inner' && (
        <BookInnerMode book={book} chapters={state.chapters} edition={edition} savePageCount={state.savePageCount} />
      )}
    </div>
  );
}
