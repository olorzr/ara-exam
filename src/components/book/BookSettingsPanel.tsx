'use client';

import Link from 'next/link';
import { Input } from '@/components/ui/input';
import { OptionSelect } from '@/components/ui/option-select';
import { BOOK_TITLE_MAX, type Book, type BookSettings, type ChapterStart } from '@/lib/book';

const COLUMN_OPTIONS = [{ value: '2', label: '2단' }, { value: '1', label: '1단' }];
const START_OPTIONS: { value: ChapterStart; label: string }[] = [
  { value: 'odd', label: '오른쪽 면(홀수 쪽)에서' },
  { value: 'page', label: '바로 다음 쪽에서' },
];

interface BookSettingsPanelProps {
  book: Book;
  disabled: boolean;
  onTitle: (title: string) => void;
  onSettings: (settings: BookSettings) => void;
}

/**
 * 책 설정(내지) — 제목 · 단 수 · 장 시작 · 복합 지문. 고르면 바로 저장하고, 글 칸은 칸을 떠날 때 저장한다.
 *
 * 표지 쪽 설정(내지 용지 = 책등 두께 · 책등 색과 글자 · 뒷표지 바탕 · 앞·뒤표지)은 표지 만들기 화면에 있다(2026-10-26 —
 * 표지만 만드는 항목도 같은 칸을 쓰게 한 곳으로 모았다).
 */
export default function BookSettingsPanel({ book, disabled, onTitle, onSettings }: BookSettingsPanelProps) {
  const s = book.settings;
  const patch = (next: Partial<BookSettings>) => onSettings({ ...s, ...next });

  return (
    <section className="space-y-4 rounded-lg border border-gray-200 p-4" aria-labelledby="book-settings-title">
      <h2 id="book-settings-title" className="text-sm font-semibold text-gray-900">내지 설정</h2>

      <label className="block space-y-1 text-sm">
        <span className="text-gray-600">책 제목</span>
        <Input
          key={book.title} defaultValue={book.title} maxLength={BOOK_TITLE_MAX} disabled={disabled}
          onBlur={(e) => {
            const next = e.target.value.trim();
            if (next && next !== book.title) onTitle(next);
            if (!next) e.target.value = book.title;
          }}
        />
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1 text-sm">
          <span className="text-gray-600">단 수 (학생용·교사용)</span>
          <OptionSelect
            value={String(s.columns)} options={COLUMN_OPTIONS} disabled={disabled}
            onChange={(v) => patch({ columns: v === '1' ? 1 : 2 })} ariaLabel="단 수" className="w-full"
          />
        </div>
        <div className="space-y-1 text-sm">
          <span className="text-gray-600">장 시작</span>
          <OptionSelect
            value={s.chapterStart} options={START_OPTIONS} disabled={disabled}
            onChange={(v) => patch({ chapterStart: v === 'page' ? 'page' : 'odd' })}
            ariaLabel="장 시작" className="w-full"
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-700 sm:col-span-2">
          <input
            type="checkbox" checked={s.trimWorks} disabled={disabled}
            onChange={(e) => patch({ trimWorks: e.target.checked })}
            className="h-4 w-4 accent-[color:var(--primary)]"
          />
          복합 지문은 묻는 작품만 인쇄
        </label>
      </div>

      <p className="text-sm text-gray-600">
        내지 용지(책등 두께) · 책등 색과 글자 · 앞·뒤표지는{' '}
        <Link href={`/books/covers/${book.id}`} className="text-primary underline underline-offset-2">표지 만들기</Link>
        에서 정해요.
      </p>
    </section>
  );
}
