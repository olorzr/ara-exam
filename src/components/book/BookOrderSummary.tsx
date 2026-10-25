import { ExternalLink } from 'lucide-react';
import {
  BOOK_EDITIONS, coverSpreadGeometry, EDITION_LABELS, innerPaperOf, pageCountFreshness, resolveSpinePages, spineMmOf,
  type Book, type BookChapter, type BookEdition,
} from '@/lib/book';

/** 열림인쇄 '책만들기' 주문 화면 */
export const YEOLIM_BOOK_ORDER_URL = 'https://www.yeolimprinting.co.kr/product/book/option/?product-type=D413';

interface BookOrderSummaryProps {
  book: Book;
  chapters: readonly BookChapter[];
}

/**
 * 판 하나의 쪽 수 칸 글 — 책등을 그릴 수 없으면 왜 못 그리는지 말한다.
 * @param book - 항목
 * @param chapters - 장
 * @param edition - 판
 * @returns 칸 글
 */
function pagesCell(book: Book, chapters: readonly BookChapter[], edition: BookEdition): string {
  const pages = resolveSpinePages(book, chapters, edition);
  if (pages) return pages.source === 'manual' ? `${pages.pages}쪽 (입력)` : `${pages.pages}쪽`;
  if (book.kind === 'cover') return '아직 안 넣음';
  return pageCountFreshness(book, chapters, edition) === 'stale' ? '구성이 바뀜 — 다시 재야 함' : '아직 안 잼';
}

/**
 * 주문 요약 — 판마다 내지 쪽 수 · 책등 두께 · 표지 작업사이즈. 열림인쇄 견적 화면에 그대로 옮겨 적는 값이다.
 *
 * 쪽 수는 표지 화면과 **같은 함수**(`resolveSpinePages`)로 정한다 — 책은 내지 화면이 잰 값(장 구성이 그 뒤에 바뀌었으면
 * 쓰지 않는다), 표지만은 직접 넣은 값을 4의 배수로 올린 값이다.
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
            const pages = resolveSpinePages(book, chapters, edition);
            const spine = pages ? spineMmOf(book, pages.pages) : null;
            const spread = spine === null ? null : coverSpreadGeometry(spine);
            return (
              <tr key={edition} className="border-t border-gray-100">
                <td className="py-1.5 text-gray-900">{EDITION_LABELS[edition]}</td>
                <td className={`py-1.5 ${pages ? '' : 'text-xs text-amber-700'}`}>{pagesCell(book, chapters, edition)}</td>
                <td className="py-1.5 font-semibold">{spine === null ? '—' : `${spine}mm`}</td>
                <td className="py-1.5">{spread ? `${spread.widthMm} × ${spread.heightMm}mm` : '—'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="text-xs text-gray-500">
        {book.kind === 'cover'
          ? '쪽 수는 표지 설정의 ‘내지 쪽 수’ 칸에 넣은 값이에요(4의 배수로 올림).'
          : '쪽 수는 내지 만들기의 ‘내지’ 화면을 한 번 열면 재서 저장해요.'}{' '}
        견적 화면에 같은 쪽 수·용지를 넣으면 세네카 값이 같아야 해요.{' '}
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
