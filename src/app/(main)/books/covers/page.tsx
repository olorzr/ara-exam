'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { BookCreateDialog, BookListFrame } from '@/components/book';
import { useBookList } from '@/hooks/useBookList';
import { useDirectorGate } from '@/hooks/useDirectorGate';

const LIST_QUERY = { finished: false } as const;

/**
 * 표지 만들기 목록 (`/books/covers`) — **원장 전용**. 아직 다 만들지 않은 모든 항목의 표지(책의 표지와 표지만 항목).
 * '+ 새 표지' 는 표지만 항목이다 — 장 없이 쪽 수를 직접 넣어 책등을 계산한다(원장님 2026-10-26 "표지만 만들어야 할 수도").
 */
export default function BookCoversPage() {
  const gate = useDirectorGate();
  const router = useRouter();
  const list = useBookList(gate.allowed, LIST_QUERY);
  const [creating, setCreating] = useState(0);

  if (gate.checking || !gate.allowed) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <>
      <BookListFrame
        heading="표지 만들기"
        description="책등(세네카)을 포함한 표지 펼침면을 PDF 로 뽑아 열림인쇄에 올려요. 내지를 만드는 책의 표지와, 표지만 만드는 항목이 함께 보여요. 원장님만 보이는 메뉴예요."
        headerAction={<Button type="button" onClick={() => setCreating((n) => n + 1)}>+ 새 표지</Button>}
        loading={list.loading}
        books={list.books}
        emptyText="만드는 중인 표지가 없어요."
        hrefOf={(book) => `/books/covers/${book.id}`}
        dateOf={(book) => `${new Date(book.createdAt).toLocaleDateString('ko-KR')} 만듦`}
        onRemove={(book) => { void list.remove(book); }}
      />
      <BookCreateDialog
        key={creating}
        open={creating > 0}
        onClose={() => setCreating(0)}
        title="새 표지 (표지만)"
        placeholder="예: 2026 고1 문학 프린트 묶음"
        onSubmit={async (title) => {
          const book = await list.create(title, 'cover');
          if (book) router.push(`/books/covers/${book.id}`);
        }}
      />
    </>
  );
}
