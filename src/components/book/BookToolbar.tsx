'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { OptionSelect } from '@/components/ui/option-select';
import { BOOK_EDITIONS, EDITION_LABELS, isBookEdition, type Book, type BookEdition } from '@/lib/book';

/** 책 화면의 모드 — 구성(장·설정·표지) / 내지 / 표지 펼침면 */
export type BookMode = 'compose' | 'inner' | 'cover';

const MODES: { mode: BookMode; label: string }[] = [
  { mode: 'compose', label: '구성' },
  { mode: 'inner', label: '내지' },
  { mode: 'cover', label: '표지' },
];

const EDITION_OPTIONS = BOOK_EDITIONS.map((e) => ({ value: e, label: EDITION_LABELS[e] }));

interface BookToolbarProps {
  book: Book;
  chapterCount: number;
  mode: BookMode;
  onModeChange: (mode: BookMode) => void;
  edition: BookEdition;
  onEditionChange: (edition: BookEdition) => void;
}

/**
 * 책 화면 위쪽 줄 — 목록으로 · 제목 · 모드 · 판. 인쇄 단추는 모드마다 따로 있다(내지·표지는 다른 인쇄 작업이다).
 * 인쇄물에는 나가지 않는다(`data-no-print`).
 */
export default function BookToolbar({
  book, chapterCount, mode, onModeChange, edition, onEditionChange,
}: BookToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2" data-no-print>
      <Link href="/books" className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900">
        <ArrowLeft className="h-4 w-4" /> 목록
      </Link>
      <span className="ml-2 font-semibold text-gray-900">{book.title}</span>
      <span className="text-sm text-gray-500">{chapterCount}장</span>

      <div className="ml-auto flex flex-wrap items-center gap-1">
        {MODES.map((m) => (
          <Button
            key={m.mode} type="button" size="sm"
            variant={mode === m.mode ? 'default' : 'outline'}
            aria-pressed={mode === m.mode}
            onClick={() => onModeChange(m.mode)}
          >
            {m.label}
          </Button>
        ))}
        <span className="mx-1 h-5 w-px bg-gray-200" aria-hidden="true" />
        <OptionSelect
          value={edition}
          options={EDITION_OPTIONS}
          onChange={(v) => { if (isBookEdition(v)) onEditionChange(v); }}
          ariaLabel="판"
          className="h-8 w-36"
        />
      </div>
    </div>
  );
}
