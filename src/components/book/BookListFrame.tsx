'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { Trash2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import {
  BOOK_EDITIONS, EDITION_LABELS, spineMmOf, storedSpinePages, type BookListItem,
} from '@/lib/book';
import BookKindBadge from './BookKindBadge';

/**
 * 목록 한 줄의 쪽 수 — 판마다 'N쪽 · 책등 Xmm'. 목록은 장을 읽지 않아 저장된 값을 그대로 보여 준다(`storedSpinePages`).
 * @param book - 항목
 * @returns 한 줄 글
 */
export function bookPagesLine(book: BookListItem): string {
  const parts = BOOK_EDITIONS.flatMap((e) => {
    const pages = storedSpinePages(book, e);
    return pages ? [`${EDITION_LABELS[e]} ${pages.pages}쪽 · 책등 ${spineMmOf(book, pages.pages)}mm`] : [];
  });
  if (parts.length > 0) return parts.join(' / ');
  return book.kind === 'cover' ? '쪽 수 아직 안 넣음' : '쪽 수 아직 안 잼';
}

interface BookListFrameProps {
  heading: string;
  description: ReactNode;
  /** 머리 오른쪽 단추(새로 만들기) */
  headerAction?: ReactNode;
  loading: boolean;
  books: readonly BookListItem[];
  emptyText: string;
  /** 줄을 누르면 갈 곳 */
  hrefOf: (book: BookListItem) => string;
  /** 줄의 날짜 글 — 만든 날 / 다 만든 날 */
  dateOf: (book: BookListItem) => string;
  /** 줄 오른쪽 단추들(지우기 앞) */
  actions?: (book: BookListItem) => ReactNode;
  onRemove: (book: BookListItem) => void;
}

/**
 * 책 목록 화면의 틀 — 표지 만들기 · 내지 만들기 · 다 만든 책이 함께 쓴다(머리 · 로딩 · 빈 목록 · 줄 모양 한 벌).
 * 줄 전체를 링크로 감싸지 않는다 — 안에 단추를 넣으면 잘못된 HTML 이고 키보드로도 못 쓴다(문제지 목록과 같은 모양).
 */
export default function BookListFrame({
  heading, description, headerAction, loading, books, emptyText, hrefOf, dateOf, actions, onRemove,
}: BookListFrameProps) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{heading}</h1>
          <p className="mt-1 text-sm text-gray-500">{description}</p>
        </div>
        {headerAction}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
        </div>
      ) : books.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-gray-500">{emptyText}</CardContent>
        </Card>
      ) : (
        <ul className="space-y-2">
          {books.map((book) => (
            <li key={book.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-gray-200 p-4">
              <Link href={hrefOf(book)} className="min-w-0 flex-1">
                <p className="flex items-center gap-2 font-semibold text-gray-900">
                  <span className="truncate">{book.title}</span>
                  <BookKindBadge kind={book.kind} />
                </p>
                <p className="mt-0.5 text-xs text-gray-500">
                  {book.kind === 'book' && `${book.chapterCount}장 · `}{bookPagesLine(book)} · {dateOf(book)}
                </p>
              </Link>
              {actions?.(book)}
              <button
                type="button" onClick={() => onRemove(book)}
                className="shrink-0 rounded p-2 text-gray-400 hover:bg-gray-100"
                aria-label={`${book.title} 지우기`}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
