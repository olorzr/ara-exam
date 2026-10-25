'use client';

import Link from 'next/link';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import {
  BOOK_EDITIONS, EDITION_LABELS, isManualPageCount, MANUAL_PAGES_MAX, padPageCount, pageCountFreshness,
  resolveSpinePages, spineMmOf,
  type Book, type BookChapter, type BookEdition, type BookManualPages, type BookSettings,
} from '@/lib/book';

interface BookSpinePagesFieldProps {
  book: Book;
  chapters: readonly BookChapter[];
  edition: BookEdition;
  disabled: boolean;
  onSettings: (settings: BookSettings) => void;
}

/**
 * 표지 화면의 '쪽 수' 칸 — 책등 두께는 내지 쪽 수로 정해진다.
 * - 표지만: 판마다 쪽 수를 직접 넣는다(칸을 떠날 때 저장). 4의 배수로 올린 값으로 책등을 계산한다.
 * - 책: 내지 만들기 화면이 잰 값을 보여 주고, 아직 안 쟀거나 구성이 바뀌었으면 그 화면으로 보낸다.
 */
export default function BookSpinePagesField({ book, chapters, edition, disabled, onSettings }: BookSpinePagesFieldProps) {
  if (book.kind === 'book') return <MeasuredPages book={book} chapters={chapters} edition={edition} />;

  const save = (target: BookEdition, raw: string, input: HTMLInputElement) => {
    const current = book.settings.manualPages[target];
    const text = raw.trim();
    if (text === '') {
      if (current === undefined) return;
      const rest: BookManualPages = { ...book.settings.manualPages };
      delete rest[target];
      onSettings({ ...book.settings, manualPages: rest });
      return;
    }
    const value = Number(text);
    if (!isManualPageCount(value)) {
      toast.error(`쪽 수는 1부터 ${MANUAL_PAGES_MAX} 사이의 정수로 넣어 주세요.`);
      input.value = current === undefined ? '' : String(current);
      return;
    }
    if (value === current) return;
    onSettings({ ...book.settings, manualPages: { ...book.settings.manualPages, [target]: value } });
  };

  return (
    <fieldset className="space-y-2" disabled={disabled}>
      <legend className="text-sm text-gray-600">내지 쪽 수 (책등 두께가 이 값으로 정해져요)</legend>
      {BOOK_EDITIONS.map((e) => {
        const entered = book.settings.manualPages[e];
        return (
          <div key={e} className={`flex flex-wrap items-center gap-2 text-sm ${e === edition ? 'font-medium' : ''}`}>
            <label className="flex items-center gap-2">
              <span className="w-24 text-gray-700">{EDITION_LABELS[e]}</span>
              <Input
                key={entered ?? 'none'} type="number" inputMode="numeric" min={1} max={MANUAL_PAGES_MAX} step={1}
                defaultValue={entered ?? ''} placeholder="쪽" className="h-8 w-24"
                aria-label={`${EDITION_LABELS[e]} 내지 쪽 수`}
                onBlur={(ev) => save(e, ev.target.value, ev.target)}
              />
            </label>
            {entered !== undefined && (
              <span className="text-xs text-gray-500">
                {padPageCount(entered) !== entered && `4의 배수로 올려 ${padPageCount(entered)}쪽 → `}
                책등 {spineMmOf(book, padPageCount(entered))}mm
              </span>
            )}
          </div>
        );
      })}
      <p className="text-xs text-gray-400">안 쓸 판은 비워 두세요. 무선제본 내지는 4의 배수라 남는 쪽은 빈 쪽으로 쳐요.</p>
    </fieldset>
  );
}

/** 책 — 내지 만들기 화면이 잰 쪽 수 */
function MeasuredPages({ book, chapters, edition }: Pick<BookSpinePagesFieldProps, 'book' | 'chapters' | 'edition'>) {
  const pages = resolveSpinePages(book, chapters, edition);
  const freshness = pageCountFreshness(book, chapters, edition);
  const innerHref = `/books/inner/${book.id}`;
  return (
    <div className="space-y-1 text-sm">
      <p className="text-gray-600">내지 쪽 수 ({EDITION_LABELS[edition]})</p>
      {pages ? (
        <p className="text-gray-900">
          {pages.pages}쪽 — 내지 만들기 화면이 잰 값 · 책등 <strong>{spineMmOf(book, pages.pages)}mm</strong>
        </p>
      ) : (
        <p className="text-amber-800">
          {freshness === 'stale'
            ? `장 구성이 바뀌어 ${EDITION_LABELS[edition]} 내지 쪽 수를 다시 재야 해요.`
            : `${EDITION_LABELS[edition]} 내지 쪽 수를 아직 재지 않았어요.`}{' '}
          <Link href={innerHref} className="text-primary underline underline-offset-2">내지 만들기로 →</Link>
        </p>
      )}
      <p className="text-xs text-gray-400">내지 만들기에서 &lsquo;내지&rsquo; 화면을 한 번 열면 쪽 수를 재서 저장해요.</p>
    </div>
  );
}
