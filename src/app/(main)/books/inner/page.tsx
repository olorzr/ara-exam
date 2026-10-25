'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { BookCreateDialog, BookListFrame } from '@/components/book';
import { useBookList } from '@/hooks/useBookList';
import { useDirectorGate } from '@/hooks/useDirectorGate';

const LIST_QUERY = { kind: 'book', finished: false } as const;

/**
 * 내지 만들기 목록 (`/books/inner`) — **원장 전용**. 아직 다 만들지 않은 책(장을 담아 내지까지 만드는 것).
 * '+ 새 내지' 는 새 책이다 — 저장된 문제지를 장으로 담고, 내지를 뽑은 뒤 같은 책의 표지를 표지 만들기에서 만든다.
 */
export default function BookInnerListPage() {
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
        heading="내지 만들기"
        description="저장된 문제지를 장으로 묶어 A4 무선제본 내지 PDF 를 뽑아요. 학생용 · 교사용 · 정답 및 해설 세 판을 따로 뽑고, 잰 쪽 수로 표지 만들기가 책등을 그려요."
        headerAction={<Button type="button" onClick={() => setCreating((n) => n + 1)}>+ 새 내지</Button>}
        loading={list.loading}
        books={list.books}
        emptyText="만드는 중인 책이 없어요."
        hrefOf={(book) => `/books/inner/${book.id}`}
        dateOf={(book) => `${new Date(book.createdAt).toLocaleDateString('ko-KR')} 만듦`}
        onRemove={(book) => { void list.remove(book); }}
      />
      <BookCreateDialog
        key={creating}
        open={creating > 0}
        onClose={() => setCreating(0)}
        title="새 내지 (책)"
        placeholder="예: 2026 고1 2학기 기말 대비 문학"
        onSubmit={async (title) => {
          const book = await list.create(title, 'book');
          if (book) router.push(`/books/inner/${book.id}`);
        }}
      />
    </>
  );
}
