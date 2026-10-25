'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { OptionSelect } from '@/components/ui/option-select';
import { BOOK_EDITIONS, EDITION_LABELS, isBookEdition, type Book, type BookEdition } from '@/lib/book';
import BookKindBadge from './BookKindBadge';

/** 내지 만들기 화면의 모드 — 구성(장·내지 설정) / 내지 */
export type BookMode = 'compose' | 'inner';

/** 내지 만들기 화면의 모드 단추 */
export const INNER_MODES: readonly { mode: BookMode; label: string }[] = [
  { mode: 'compose', label: '구성' },
  { mode: 'inner', label: '내지' },
];

const EDITION_OPTIONS = BOOK_EDITIONS.map((e) => ({ value: e, label: EDITION_LABELS[e] }));

interface BookToolbarProps {
  book: Book;
  /** 목록으로 돌아갈 곳(표지 만들기 / 내지 만들기) */
  backHref: string;
  /** 장 수 — 표지만 항목은 장이 없어 넘기지 않는다 */
  chapterCount?: number;
  /** 모드 단추 — 넘기지 않으면 그리지 않는다(표지 만들기는 한 화면이다) */
  modes?: readonly { mode: BookMode; label: string }[];
  mode?: BookMode;
  onModeChange?: (mode: BookMode) => void;
  edition: BookEdition;
  onEditionChange: (edition: BookEdition) => void;
  /** 오른쪽 끝 — 다 만든 표시 단추 자리 */
  trailing?: ReactNode;
}

/**
 * 책 화면 위쪽 줄 — 목록으로 · 제목 · 종류 · (모드) · 판 · 다 만든 표시. 인쇄 단추는 화면마다 따로 있다
 * (내지·표지는 다른 인쇄 작업이다). 인쇄물에는 나가지 않는다(`data-no-print`).
 */
export default function BookToolbar({
  book, backHref, chapterCount, modes, mode, onModeChange, edition, onEditionChange, trailing,
}: BookToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2" data-no-print>
      <Link href={backHref} className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900">
        <ArrowLeft className="h-4 w-4" /> 목록
      </Link>
      <span className="ml-2 font-semibold text-gray-900">{book.title}</span>
      <BookKindBadge kind={book.kind} />
      {chapterCount !== undefined && <span className="text-sm text-gray-500">{chapterCount}장</span>}

      <div className="ml-auto flex flex-wrap items-center gap-1">
        {modes && modes.length > 1 && (
          <>
            {modes.map((m) => (
              <Button
                key={m.mode} type="button" size="sm"
                variant={mode === m.mode ? 'default' : 'outline'}
                aria-pressed={mode === m.mode}
                onClick={() => onModeChange?.(m.mode)}
              >
                {m.label}
              </Button>
            ))}
            <span className="mx-1 h-5 w-px bg-gray-200" aria-hidden="true" />
          </>
        )}
        <OptionSelect
          value={edition}
          options={EDITION_OPTIONS}
          onChange={(v) => { if (isBookEdition(v)) onEditionChange(v); }}
          ariaLabel="판"
          className="h-8 w-36"
        />
        {trailing && <span className="ml-1 flex items-center">{trailing}</span>}
      </div>
    </div>
  );
}
