'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { useBook } from '@/hooks/useBook';
import { useDirectorGate } from '@/hooks/useDirectorGate';
import type { Book } from '@/lib/book';

/** 책 한 권의 상태 — `useBook` 그대로 */
export type BookState = ReturnType<typeof useBook>;

interface BookEditorShellProps {
  bookId: string;
  /** 못 찾았을 때 돌아갈 목록 */
  listHref: string;
  children: (book: Book, state: BookState) => ReactNode;
}

/**
 * 책 편집 화면의 틀 — **원장 전용** 문지기 · 책 읽기 · 스피너 · '찾지 못했어요'. 표지 만들기와 내지 만들기 편집 화면이
 * 함께 쓴다(두 벌로 두면 문지기·로딩 규약이 언젠가 한쪽만 고쳐진다).
 */
export default function BookEditorShell({ bookId, listHref, children }: BookEditorShellProps) {
  const gate = useDirectorGate();
  const state = useBook(bookId, gate.allowed);

  if (gate.checking || !gate.allowed || !state.loaded) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
      </div>
    );
  }

  if (!state.book) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-gray-500">
          {state.failed ? '책을 불러오지 못했어요.' : '책을 찾지 못했어요.'}{' '}
          <Link href={listHref} className="text-primary underline underline-offset-2">목록으로</Link>
        </CardContent>
      </Card>
    );
  }

  return <>{children(state.book, state)}</>;
}
