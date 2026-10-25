import { BOOK_KIND_LABELS, type BookKind } from '@/lib/book';

/**
 * 종류 표시 — 책 / 표지만. 글자로 알린다(색만으로 정보를 전하지 않는다).
 */
export default function BookKindBadge({ kind }: { kind: BookKind }) {
  const tone = kind === 'cover' ? 'border-sky-200 bg-sky-50 text-sky-800' : 'border-gray-200 bg-gray-50 text-gray-700';
  return (
    <span className={`inline-flex shrink-0 items-center rounded border px-1.5 py-0.5 text-xs ${tone}`}>
      {BOOK_KIND_LABELS[kind]}
    </span>
  );
}
