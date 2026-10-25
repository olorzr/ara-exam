import { ExternalLink } from 'lucide-react';
import {
  BOOK_EDITIONS, coverSpreadGeometry, EDITION_LABELS, innerPaperOf, pageCountFreshness, spineWidthMm,
  type Book, type BookChapter,
} from '@/lib/book';

/** 열림인쇄 '책만들기' 주문 화면 */
export const YEOLIM_BOOK_ORDER_URL = 'https://www.yeolimprinting.co.kr/product/book/option/?product-type=D413';

interface BookOrderSummaryProps {
  book: Book;
  chapters: readonly BookChapter[];
}

/**
 * 주문 요약 — 판마다 내지 쪽 수 · 책등 두께 · 표지 작업사이즈. 열림인쇄 견적 화면에 그대로 옮겨 적는 값이다.
 *
 * 쪽 수는 내지 화면이 재서 저장한 값이다. 장 구성이 그 뒤에 바뀌었으면 '다시 재야 함' 으로 보여 준다 —
 * 옛 쪽 수로 책등을 그리면 조용히 틀린다(`pageCountFreshness`).
 */
export default function BookOrderSummary({ book, chapters }: BookOrderSummaryProps) {
  const paper = innerPaperOf(book.settings.innerPaper);
  return (
    <section className="space-y-3 rounded-lg border border-gray-200 p-4" aria-labelledby="book-order-title">
      <h2 id="book-order-title" className="text-sm font-semibold text-gray-900">열림인쇄 주문 요약</h2>
      <p className="text-xs text-gray-500">
        판형 A4 (210 × 297mm) · 제본 무선 · 내지 {paper.name} 양면 · 파일 2개(내지 PDF, 표지 PDF)
      </p>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-gray-500">
            <th className="py-1 font-medium">판</th>
            <th className="py-1 font-medium">내지 쪽 수</th>
            <th className="py-1 font-medium">책등(세네카)</th>
            <th className="py-1 font-medium">표지 작업사이즈</th>
          </tr>
        </thead>
        <tbody>
          {BOOK_EDITIONS.map((edition) => {
            const stored = book.pageCounts[edition];
            const fresh = pageCountFreshness(book, chapters, edition);
            const spine = stored ? spineWidthMm(stored.pages, paper.thicknessMm) : null;
            const spread = spine === null ? null : coverSpreadGeometry(spine);
            return (
              <tr key={edition} className="border-t border-gray-100">
                <td className="py-1.5 text-gray-900">{EDITION_LABELS[edition]}</td>
                <td className="py-1.5">
                  {stored ? `${stored.pages}쪽` : '아직 안 잼'}
                  {fresh === 'stale' && <span className="ml-1 text-xs text-amber-600">(구성이 바뀜 — 다시 재야 함)</span>}
                </td>
                <td className="py-1.5 font-semibold">{spine === null ? '—' : `${spine}mm`}</td>
                <td className="py-1.5">{spread ? `${spread.widthMm} × ${spread.heightMm}mm` : '—'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="text-xs text-gray-500">
        쪽 수는 &lsquo;내지&rsquo; 화면을 한 번 열면 재서 저장해요. 견적 화면에 같은 쪽 수·용지를 넣으면 세네카 값이 같아야 해요.{' '}
        <a
          href={YEOLIM_BOOK_ORDER_URL} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-0.5 text-primary underline underline-offset-2"
        >
          열림인쇄 책만들기 주문 <ExternalLink className="h-3 w-3" />
        </a>
      </p>
    </section>
  );
}
