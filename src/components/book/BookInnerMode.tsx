'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useBookChapterItems } from '@/hooks/useBookChapterItems';
import { useBookPageCount, type BookPageCountStatus } from '@/hooks/useBookPageCount';
import { useDocumentFontsReady } from '@/hooks/useDocumentFontsReady';
import { useImagesReady } from '@/hooks/useImagesReady';
import { useSignedImageUrls } from '@/hooks/useSignedImageUrls';
import {
  bookLayoutKeyFor, EDITION_LABELS, innerPaperOf, spineWidthMm,
  type Book, type BookChapter, type BookEdition, type BookPageCount,
} from '@/lib/book';
import { imagePathsOf, renumberedImageItems } from '@/lib/problem-paper/blocks';
import BookInnerView from './BookInnerView';

const STATUS_TEXT: Record<BookPageCountStatus, string> = {
  measuring: '쪽 수를 재는 중…',
  saving: '쪽 수 저장 중…',
  saved: '쪽 수 저장됨 — 표지 만들기가 이 값으로 책등을 그려요',
  failed: '쪽 수를 저장하지 못했어요',
};

interface BookInnerModeProps {
  book: Book;
  chapters: readonly BookChapter[];
  edition: BookEdition;
  savePageCount: (edition: BookEdition, count: BookPageCount) => Promise<boolean>;
}

/**
 * 내지 화면 — 한 판의 내지를 그리고, 잰 쪽 수를 책에 기록하고, A4 PDF 로 인쇄한다.
 *
 * 인쇄·쪽 수 저장은 장의 문항과 그림이 **다 온 뒤**에만 연다 — 덜 온 채 뽑으면 그림이 빈칸으로 나가고,
 * 덜 온 채 잰 쪽 수로는 책등이 틀린다(문제지 보기 화면과 같은 잠금).
 */
export default function BookInnerMode({ book, chapters, edition, savePageCount }: BookInnerModeProps) {
  const paperIds = useMemo(() => chapters.map((c) => c.paperId), [chapters]);
  const chapterItems = useBookChapterItems(paperIds, true);
  const { trimWorks } = book.settings;

  // 그림은 문항을 그리는 판만 — 정답 및 해설 판은 그림을 찍지 않는다
  const imagePaths = useMemo(() => (edition === 'key' ? [] : chapters.flatMap((c) => (
    imagePathsOf(chapterItems.items.get(c.paperId) ?? [], { trimWorks })
  ))), [edition, chapters, chapterItems.items, trimWorks]);
  const images = useSignedImageUrls(imagePaths);
  const ready = useImagesReady(useMemo(() => [...images.urls.values()], [images.urls]));
  const brokenCount = images.missing.length + ready.failed.length;
  const imagesBlocked = images.loading || ready.loading || brokenCount > 0;
  const fontsReady = useDocumentFontsReady();

  const renumbered = useMemo(() => (edition === 'key' ? 0 : chapters.reduce(
    (sum, c) => sum + renumberedImageItems(chapterItems.items.get(c.paperId) ?? []).length, 0,
  )), [edition, chapters, chapterItems.items]);

  const layoutKey = bookLayoutKeyFor(book, chapters, edition);
  const itemsReady = !chapterItems.loading && !chapterItems.failed;
  const canPersist = itemsReady && !imagesBlocked && fontsReady && chapters.length > 0;
  const save = useCallback((count: BookPageCount) => savePageCount(edition, count), [edition, savePageCount]);
  const pageCount = useBookPageCount({ stored: book.pageCounts[edition], layoutKey, canPersist, save });
  const paper = innerPaperOf(book.settings.innerPaper);

  /**
   * 번호 어긋남을 사람이 확인했는가. ⚠️ 확인 전에는 경고가 **인쇄물에도** 찍힌다 — 단추의 확인창만 두면 Cmd/Ctrl+P 가
   * 그것을 건너뛴다(문제지 화면과 같은 규약, 코덱스 2R). 경고는 `position: fixed` 덮개라 쪽 배정을 바꾸지 않는다
   * (쪽 수가 바뀌면 책등이 틀린다).
   */
  const [renumberAcked, setRenumberAcked] = useState(false);
  const printAfterAckRef = useRef(false);
  useEffect(() => {
    if (!renumberAcked || !printAfterAckRef.current) return;
    printAfterAckRef.current = false;
    window.print();
  }, [renumberAcked]);
  const renumberWarning = renumbered > 0 && !renumberAcked;

  if (chapters.length === 0) {
    return <p className="py-12 text-center text-sm text-gray-500">담은 장이 없어요. &lsquo;구성&rsquo; 에서 장을 먼저 담으세요.</p>;
  }

  const handlePrint = () => {
    if (renumbered === 0 || renumberAcked) { window.print(); return; }
    if (!window.confirm(
      `이미지로 출제한 문항 ${renumbered}개는 원본 번호가 이미지에 찍혀 있어 인쇄 번호와 함께 보여요. 그대로 인쇄할까요?`,
    )) return;
    // 확인하면 인쇄물에 찍히는 경고를 걷은 **뒤에** 인쇄한다(아래 효과)
    printAfterAckRef.current = true;
    setRenumberAcked(true);
  };
  const printLabel = !itemsReady ? '문항 준비 중…' : imagesBlocked ? '이미지 준비 중…' : !fontsReady ? '글꼴 준비 중…' : '내지 인쇄';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 rounded-md border border-gray-200 bg-gray-50 p-3 text-sm" data-no-print>
        <span className="font-medium text-gray-900">{EDITION_LABELS[edition]} 내지</span>
        <span className="text-gray-600">
          {pageCount.measured === null ? '쪽 수 재는 중' : `${pageCount.measured}쪽(4의 배수까지 빈 쪽 포함)`}
          {pageCount.measured !== null && ` · 책등 ${spineWidthMm(pageCount.measured, paper.thicknessMm)}mm (${paper.name})`}
        </span>
        <span className={pageCount.status === 'failed' ? 'text-red-600' : 'text-gray-500'}>{STATUS_TEXT[pageCount.status]}</span>
        {pageCount.status === 'failed' && (
          <Button type="button" size="sm" variant="outline" onClick={pageCount.retry}>다시 저장</Button>
        )}
        <Button
          type="button" size="sm" className="ml-auto" onClick={handlePrint}
          disabled={!itemsReady || imagesBlocked || !fontsReady}
        >
          <Printer className="h-3.5 w-3.5" />
          <span className="ml-1">{printLabel}</span>
        </Button>
        <p className="w-full text-xs text-gray-500">
          인쇄 창에서 대상 &lsquo;PDF로 저장&rsquo; · 용지 A4 · 여백 &lsquo;없음&rsquo; · &lsquo;배경 그래픽&rsquo; 켜기로 저장해 열림인쇄에 내지 파일로 올리세요.
        </p>
      </div>

      {chapterItems.failed && (
        <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800" data-no-print>
          <AlertTriangle className="h-4 w-4" /> 장의 문항을 불러오지 못했어요.
          <Button type="button" size="sm" variant="outline" onClick={chapterItems.reload}>다시 시도</Button>
        </div>
      )}
      {renumberWarning && (
        <>
          <div className="flex flex-wrap items-center gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900" data-no-print>
            <AlertTriangle className="h-4 w-4" />
            이미지로 출제한 문항 {renumbered}개는 원본 번호가 이미지에 찍혀 있어 인쇄 번호와 함께 보여요.
            확인하기 전에는 인쇄물에도 경고가 찍혀요.
            <Button type="button" size="sm" variant="outline" onClick={() => setRenumberAcked(true)}>
              확인했어요 — 인쇄물에서 경고 빼기
            </Button>
          </div>
          {/* 인쇄에서만 보이는 덮개 — 쪽마다 위에 찍히고 배치(쪽 수)는 바꾸지 않는다 */}
          <div className="bk-print-warning" role="note">
            확인 필요: 이미지로 출제한 문항 {renumbered}개는 원본 번호가 함께 찍혀 있어요. 책 만들기 내지 화면에서 확인한 뒤 다시 인쇄하세요.
          </div>
        </>
      )}
      {brokenCount > 0 && (
        <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900" data-no-print>
          <AlertTriangle className="h-4 w-4" /> 이미지 {brokenCount}개를 불러오지 못했어요. 지금 인쇄하면 그 문항이 빈칸으로 나갑니다.
          <Button type="button" size="sm" variant="outline" onClick={images.reload}>다시 시도</Button>
        </div>
      )}

      {chapterItems.loading ? (
        <div className="flex justify-center py-16" data-no-print>
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
        </div>
      ) : itemsReady && (
        <BookInnerView
          key={layoutKey}
          book={book} edition={edition} chapters={chapters}
          itemsByPaper={chapterItems.items} imageUrls={images.urls} onLayout={pageCount.onLayout}
        />
      )}
    </div>
  );
}
