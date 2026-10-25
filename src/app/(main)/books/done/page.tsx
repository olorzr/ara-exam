'use client';

import Link from 'next/link';
import { RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BookListFrame } from '@/components/book';
import { useBookList } from '@/hooks/useBookList';
import { useDirectorGate } from '@/hooks/useDirectorGate';

const LIST_QUERY = { finished: true } as const;

/**
 * 다 만든 책 (`/books/done`) — **원장 전용**. 표지·내지 화면에서 '다 만들었어요' 를 누른 항목(책·표지만 모두),
 * 최근에 끝낸 것부터. 다시 뽑을 일이 있으면 표지·내지를 열고, 고칠 것이 생기면 '다시 작업' 으로 만드는 중 목록에 돌린다.
 */
export default function BookDonePage() {
  const gate = useDirectorGate();
  const list = useBookList(gate.allowed, LIST_QUERY);

  if (gate.checking || !gate.allowed) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <BookListFrame
      heading="다 만든 책"
      description="표지·내지 화면에서 '다 만들었어요' 를 누른 책이 여기 모여요. 다시 뽑거나, 고칠 것이 생기면 '다시 작업' 으로 돌려요."
      loading={list.loading}
      books={list.books}
      emptyText="아직 다 만든 책이 없어요."
      hrefOf={(book) => `/books/covers/${book.id}`}
      dateOf={(book) => `${new Date(book.finishedAt ?? book.updatedAt).toLocaleDateString('ko-KR')} 완성`}
      actions={(book) => (
        <span className="flex shrink-0 flex-wrap items-center gap-1">
          <Link href={`/books/covers/${book.id}`} className="rounded border border-gray-200 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50">
            표지
          </Link>
          {book.kind === 'book' && (
            <Link href={`/books/inner/${book.id}`} className="rounded border border-gray-200 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50">
              내지
            </Link>
          )}
          <Button type="button" size="sm" variant="outline" onClick={() => { void list.setFinished(book, false); }}>
            <RotateCcw className="h-3.5 w-3.5" />
            <span className="ml-1">다시 작업</span>
          </Button>
        </span>
      )}
      onRemove={(book) => { void list.remove(book); }}
    />
  );
}
