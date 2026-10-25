'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useBookList } from '@/hooks/useBookList';
import { useDirectorGate } from '@/hooks/useDirectorGate';
import { BOOK_EDITIONS, BOOK_TITLE_MAX, EDITION_LABELS, type BookListItem } from '@/lib/book';

function pageCountsLine(book: BookListItem): string {
  const parts = BOOK_EDITIONS.flatMap((e) => {
    const count = book.pageCounts[e];
    return count ? [`${EDITION_LABELS[e]} ${count.pages}쪽`] : [];
  });
  return parts.length > 0 ? parts.join(' · ') : '쪽 수 아직 안 잼';
}

/**
 * 책 목록 (`/books`) — **원장 전용**. 저장된 문제지를 장으로 묶어 무선제본 책을 만든다.
 */
export default function BooksPage() {
  const gate = useDirectorGate();
  const router = useRouter();
  const { books, loading, create, remove } = useBookList(gate.allowed);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);

  if (gate.checking || !gate.allowed) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
      </div>
    );
  }

  const submit = async () => {
    const next = title.trim();
    if (!next || busy) return;
    setBusy(true);
    const book = await create(next);
    setBusy(false);
    if (book) router.push(`/books/${book.id}`);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">📚 책 만들기</h1>
          <p className="mt-1 text-sm text-gray-500">
            저장된 문제지를 장으로 묶어 A4 무선제본 책을 만들어요. 내지 PDF 와 표지(책등 포함) PDF 를 따로 뽑아
            열림인쇄에 올립니다. 원장님만 보이는 메뉴예요.
          </p>
        </div>
        <Button type="button" onClick={() => { setTitle(''); setCreating(true); }}>+ 새 책</Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
        </div>
      ) : books.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-gray-500">아직 만든 책이 없어요.</CardContent>
        </Card>
      ) : (
        <ul className="space-y-2">
          {books.map((book) => (
            <li key={book.id} className="flex items-center gap-3 rounded-lg border border-gray-200 p-4">
              <Link href={`/books/${book.id}`} className="min-w-0 flex-1">
                <p className="font-semibold text-gray-900">{book.title}</p>
                <p className="mt-0.5 text-xs text-gray-500">
                  {book.chapterCount}장 · {pageCountsLine(book)} · {new Date(book.createdAt).toLocaleDateString('ko-KR')}
                </p>
              </Link>
              <button
                type="button" onClick={() => remove(book)}
                className="shrink-0 rounded p-2 text-gray-400 hover:bg-gray-100"
                aria-label={`${book.title} 지우기`}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={creating} onOpenChange={(next) => { if (!next && !busy) setCreating(false); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogTitle className="text-base">새 책</DialogTitle>
          <form onSubmit={(e) => { e.preventDefault(); void submit(); }} className="space-y-3">
            <label className="block space-y-1 text-sm">
              <span className="text-gray-600">책 제목</span>
              <Input
                autoFocus value={title} maxLength={BOOK_TITLE_MAX} disabled={busy}
                onChange={(e) => setTitle(e.target.value)} placeholder="예: 2026 고1 2학기 기말 대비 문학"
              />
            </label>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreating(false)} disabled={busy}>취소</Button>
              <Button type="submit" disabled={busy || !title.trim()}>만들기</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
