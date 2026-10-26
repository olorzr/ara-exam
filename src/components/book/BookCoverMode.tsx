'use client';

import { Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { renderCoverSlots } from '@/components/problem-paper/PaperCoverPage';
import { useCoverFontsReady } from '@/hooks/useCoverFontsReady';
import { useCoverImages } from '@/hooks/useCoverImages';
import { useFontsReady } from '@/hooks/useFontsReady';
import {
  coverSpreadGeometry, DEFAULT_BOOK_COVER, EDITION_LABELS, EDITION_SUFFIX, innerPaperOf, MIN_SPINE_TEXT_MM,
  SPINE_BRAND_FONT_SPEC, spineFontOf, spineFontSpec, spineMmOf, spineTitleOf,
  type Book, type BookEdition, type SpinePages,
} from '@/lib/book';
import { COVER_COPY } from '@/lib/problem-paper/cover-copy';
import { coverTeacherName, coverYearOf } from '@/lib/problem-paper/cover-text';
import BookCoverSpread from './BookCoverSpread';

interface BookCoverModeProps {
  book: Book;
  edition: BookEdition;
  creatorName: string;
  /**
   * 책등을 그릴 쪽 수 — 부르는 쪽이 `resolveSpinePages` 로 정해 넘긴다(못 그리면 이 컴포넌트를 부르지 않는다).
   * 책은 내지 화면이 잰 값, 표지만은 직접 넣은 값이다.
   */
  spinePages: SpinePages;
}

/**
 * 표지 화면 — 내지 쪽 수로 책등 폭을 계산해 펼침면 한 장을 그리고 PDF 로 인쇄한다.
 *
 * ⚠️ 쪽 수를 믿어도 되는지(책: 지금 구성에서 잰 값인가)는 부르는 쪽이 `resolveSpinePages` 로 이미 판정했다 —
 *    옛 쪽 수로 그린 책등은 조용히 틀리므로 그 판정 없이 부르지 말 것. ⚠️ 그림 표지는 그림이 뜰 때까지 펼침면을
 *    그리지 않는다(문제지 화면과 같은 규약 — 그 틈에 Cmd/Ctrl+P 로 뽑으면 '불러오는 중' 이 표지로 나간다).
 */
export default function BookCoverMode({ book, edition, creatorName, spinePages }: BookCoverModeProps) {
  const cover = book.cover ?? DEFAULT_BOOK_COVER;
  const coverImages = useCoverImages(cover);
  const year = coverYearOf(book.createdAt);
  const teacher = coverTeacherName(cover, creatorName);
  const fontsReady = useCoverFontsReady(cover, { paperTitle: book.title, year, teacher });

  const paper = innerPaperOf(book.settings.innerPaper);
  const spine = spineMmOf(book, spinePages.pages);
  const geometry = coverSpreadGeometry(spine);
  const slots = renderCoverSlots({
    cover, paperTitle: book.title, suffix: EDITION_SUFFIX[edition], images: coverImages, year, teacher,
  });
  // 책등 글자의 글꼴 조각도 인쇄 전에 받는다 — 고른 제목 글꼴 + 학원 이름(지마켓 산스). 학원 이름은 책등이 얇아도
  // 뒷표지에 찍히므로 늘 기다린다(글꼴 조각 하나라 싸다)
  const spineFont = spineFontOf(book.settings.spineFont);
  const spineTitle = spineTitleOf(book, edition);
  const spineFontsReady = useFontsReady(
    [spineFontSpec(spineFont), SPINE_BRAND_FONT_SPEC], `${spineTitle} ${COVER_COPY.brandKo}`, true,
  );
  const blocked = coverImages.pending || coverImages.broken || !fontsReady || !spineFontsReady;
  const printLabel = coverImages.pending ? '표지 준비 중…'
    : coverImages.broken ? '표지 그림 확인 필요' : !fontsReady || !spineFontsReady ? '글꼴 준비 중…' : '표지 인쇄';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 rounded-md border border-gray-200 bg-gray-50 p-3 text-sm" data-no-print>
        <span className="font-medium text-gray-900">{EDITION_LABELS[edition]} 표지</span>
        <span className="text-gray-600">
          {spinePages.source === 'manual' ? '입력한 내지' : '내지'} {spinePages.pages}쪽 · {paper.name} → 책등 <strong>{spine}mm</strong> · 작업사이즈 {geometry.widthMm} × {geometry.heightMm}mm
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
            spineTitle={spineTitle}
            spineFont={spineFont}
            front={slots.coverPage}
            back={slots.backCoverPage}
            backFill={book.settings.backFill}
          />
        </div>
      )}
    </div>
  );
}
