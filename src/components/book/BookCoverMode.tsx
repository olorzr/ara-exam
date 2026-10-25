'use client';

import { AlertTriangle, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { renderCoverSlots } from '@/components/problem-paper/PaperCoverPage';
import { useCoverFontsReady } from '@/hooks/useCoverFontsReady';
import { useCoverImages } from '@/hooks/useCoverImages';
import {
  coverSpreadGeometry, DEFAULT_BOOK_COVER, EDITION_LABELS, EDITION_SUFFIX, innerPaperOf, MIN_SPINE_TEXT_MM,
  pageCountFreshness, spineWidthMm, type Book, type BookChapter, type BookEdition,
} from '@/lib/book';
import { coverTeacherName, coverYearOf } from '@/lib/problem-paper/cover-text';
import BookCoverSpread from './BookCoverSpread';

interface BookCoverModeProps {
  book: Book;
  chapters: readonly BookChapter[];
  edition: BookEdition;
  creatorName: string;
  /** 내지 화면으로 — 쪽 수를 재러 간다 */
  onGoInner: () => void;
}

/**
 * 책등 제목 — 적은 책등 글자(없으면 책 제목)에 판 이름을 붙인다(학생용은 붙이지 않는다).
 * @param book - 책
 * @param edition - 판
 * @returns 책등 위쪽 글
 */
export function spineTitleOf(book: Book, edition: BookEdition): string {
  const base = book.settings.spineText || book.title;
  return edition === 'student' ? base : `${base} · ${EDITION_LABELS[edition]}`;
}

/**
 * 표지 화면 — 저장된 내지 쪽 수로 책등 폭을 계산해 펼침면 한 장을 그리고 PDF 로 인쇄한다.
 *
 * ⚠️ 쪽 수가 지금 구성의 것이 아니면(장·단 수 등을 바꿨다) 책등을 그리지 않고 다시 재라고 한다 — 옛 쪽 수로
 *    그린 책등은 조용히 틀린다. ⚠️ 그림 표지는 그림이 뜰 때까지 펼침면을 그리지 않는다(문제지 화면과 같은 규약 —
 *    그 틈에 Cmd/Ctrl+P 로 뽑으면 '불러오는 중' 이 표지로 나간다).
 */
export default function BookCoverMode({ book, chapters, edition, creatorName, onGoInner }: BookCoverModeProps) {
  const cover = book.cover ?? DEFAULT_BOOK_COVER;
  const coverImages = useCoverImages(cover);
  const year = coverYearOf(book.createdAt);
  const teacher = coverTeacherName(cover, creatorName);
  const fontsReady = useCoverFontsReady(cover, { paperTitle: book.title, year, teacher });

  const freshness = pageCountFreshness(book, chapters, edition);
  const stored = book.pageCounts[edition];
  const paper = innerPaperOf(book.settings.innerPaper);
  const spine = stored && freshness === 'fresh' ? spineWidthMm(stored.pages, paper.thicknessMm) : null;

  if (spine === null || !stored) {
    return (
      <div className="space-y-3 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900" data-no-print>
        <p className="flex items-center gap-2 font-semibold">
          <AlertTriangle className="h-4 w-4" />
          {freshness === 'stale'
            ? `장 구성이 바뀌어 ${EDITION_LABELS[edition]} 내지 쪽 수를 다시 재야 해요.`
            : `${EDITION_LABELS[edition]} 내지 쪽 수를 아직 재지 않았어요.`}
        </p>
        <p>책등 두께는 내지 쪽 수로 정해져요. &lsquo;내지&rsquo; 화면을 한 번 열면 쪽 수를 재서 저장하고, 여기서 그 값으로 책등을 그려요.</p>
        <Button type="button" size="sm" onClick={onGoInner}>내지 화면으로</Button>
      </div>
    );
  }

  const geometry = coverSpreadGeometry(spine);
  const slots = renderCoverSlots({
    cover, paperTitle: book.title, suffix: EDITION_SUFFIX[edition], images: coverImages, year, teacher,
  });
  const blocked = coverImages.pending || coverImages.broken || !fontsReady;
  const printLabel = coverImages.pending ? '표지 준비 중…'
    : coverImages.broken ? '표지 그림 확인 필요' : !fontsReady ? '글꼴 준비 중…' : '표지 인쇄';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 rounded-md border border-gray-200 bg-gray-50 p-3 text-sm" data-no-print>
        <span className="font-medium text-gray-900">{EDITION_LABELS[edition]} 표지</span>
        <span className="text-gray-600">
          내지 {stored.pages}쪽 · {paper.name} → 책등 <strong>{spine}mm</strong> · 작업사이즈 {geometry.widthMm} × {geometry.heightMm}mm
        </span>
        <Button type="button" size="sm" className="ml-auto" disabled={blocked} onClick={() => window.print()}>
          <Printer className="h-3.5 w-3.5" />
          <span className="ml-1">{printLabel}</span>
        </Button>
        <p className="w-full text-xs text-gray-500">
          인쇄 창에서 대상 &lsquo;PDF로 저장&rsquo; · 여백 &lsquo;없음&rsquo; · 배율 100% · &lsquo;배경 그래픽&rsquo; 켜기 — 용지 크기는 {geometry.widthMm} × {geometry.heightMm}mm 로 자동으로 맞춰져요.
          빨간 점선은 재단선, 파란 점선은 책등 경계예요(인쇄되지 않아요).
          {spine < MIN_SPINE_TEXT_MM && ` 책등이 ${MIN_SPINE_TEXT_MM}mm 보다 얇아 글자를 넣지 않았어요.`}
        </p>
        {coverImages.broken && (
          <Button type="button" size="sm" variant="outline" onClick={coverImages.reload}>표지 그림 다시 불러오기</Button>
        )}
      </div>

      {coverImages.pending ? (
        <div className="flex justify-center py-16" data-no-print>
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
        </div>
      ) : (
        <div className="book-cover-stack">
          <BookCoverSpread
            geometry={geometry}
            spineColor={book.settings.spineColor}
            spineTitle={spineTitleOf(book, edition)}
            front={slots.coverPage}
            back={slots.backCoverPage}
            backFill={book.settings.backFill}
          />
        </div>
      )}
    </div>
  );
}
