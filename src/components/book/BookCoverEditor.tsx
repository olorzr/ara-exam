'use client';

import { useState } from 'react';
import { resolveSpinePages, type Book, type BookEdition } from '@/lib/book';
import BookCoverMode from './BookCoverMode';
import BookCoverPanel from './BookCoverPanel';
import type { BookState } from './BookEditorShell';
import BookFinishControl from './BookFinishControl';
import BookToolbar from './BookToolbar';

interface BookCoverEditorProps {
  book: Book;
  state: BookState;
}

/**
 * 표지 만들기 — 왼쪽은 표지 펼침면(뒷표지 · 책등 · 앞표지)과 인쇄, 오른쪽은 표지 설정.
 *
 * 책등은 `resolveSpinePages` 가 정한 쪽 수로만 그린다 — 책은 내지 만들기가 지금 구성에서 잰 값, 표지만은 직접 넣은 값.
 * ⚠️ 이 화면에는 내지를 함께 그리지 않는다 — 인쇄 작업 하나에 용지 크기는 하나다(펼침면이 `@page` 를 작업사이즈로 덮는다).
 *    오른쪽 칸은 **바깥 상자째** `data-no-print` 라 인쇄에서는 flex 칸도 gap 도 남지 않는다.
 */
export default function BookCoverEditor({ book, state }: BookCoverEditorProps) {
  const [edition, setEdition] = useState<BookEdition>('student');
  const spinePages = resolveSpinePages(book, state.chapters, edition);

  return (
    <div className="space-y-4">
      <BookToolbar
        book={book} backHref="/books/covers"
        chapterCount={book.kind === 'book' ? state.chapters.length : undefined}
        edition={edition} onEditionChange={setEdition}
        trailing={<BookFinishControl finishedAt={book.finishedAt} onToggle={(f) => { void state.setFinished(f); }} />}
      />
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start">
        <div className="min-w-0 flex-1">
          {spinePages ? (
            <BookCoverMode book={book} edition={edition} creatorName={state.creatorName} spinePages={spinePages} />
          ) : (
            <p className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900" data-no-print>
              책등 두께는 내지 쪽 수로 정해져요. 오른쪽 &lsquo;내지 쪽 수&rsquo; 를 채우면 여기에 표지 펼침면이 나와요.
            </p>
          )}
        </div>
        {/* ⚠️ 칸 **바깥 상자**에 data-no-print — 안쪽만 숨기면 빈 flex 칸이 남아 gap 만큼 밀려 PDF 에 빈 둘째 쪽이 붙는다
            (인쇄 창이 기본 A4 로 잡히면 xl 아래 세로 배치가 된다, 코덱스 3R) */}
        <div className="xl:w-[380px] xl:shrink-0" data-no-print data-testid="book-cover-side">
          <BookCoverPanel book={book} edition={edition} state={state} />
        </div>
      </div>
    </div>
  );
}
