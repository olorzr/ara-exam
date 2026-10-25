'use client';

import { useCallback, useMemo, useState } from 'react';
import PaperCoverDialog from '@/components/problem-paper/PaperCoverDialog';
import { useBookCover } from '@/hooks/useBookCover';
import { useCoverImages } from '@/hooks/useCoverImages';
import type { useBook } from '@/hooks/useBook';
import type { Book, BookSettings } from '@/lib/book';
import { coverYearOf } from '@/lib/problem-paper/cover-text';
import BookChapterList from './BookChapterList';
import BookChapterPicker from './BookChapterPicker';
import BookOrderSummary from './BookOrderSummary';
import BookSettingsPanel from './BookSettingsPanel';

interface BookComposePanelProps {
  book: Book;
  state: ReturnType<typeof useBook>;
}

/**
 * 구성 화면 — 장 목록(담기·차례·빼기·제목) · 책 설정 · 표지(문제지 표지 창을 그대로 쓴다) · 주문 요약.
 */
export default function BookComposePanel({ book, state }: BookComposePanelProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [coverOpen, setCoverOpen] = useState(false);
  const coverImages = useCoverImages(book.cover);
  const added = useMemo(() => new Set(state.chapters.map((c) => c.paperId)), [state.chapters]);
  const { save } = state;
  const coverSave = useBookCover(book.id, save);
  // 설정 칸의 지연 저장(색 고르기)이 렌더마다 다시 걸리지 않게 참조를 고정한다
  const saveTitle = useCallback((title: string) => { void save({ title }); }, [save]);
  const saveSettings = useCallback((settings: BookSettings) => { void save({ settings }); }, [save]);

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="space-y-4">
        <BookChapterList
          chapters={state.chapters}
          busy={state.busy}
          onAdd={() => setPickerOpen(true)}
          onMove={(id, delta) => { void state.moveChapter(id, delta); }}
          onRemove={(id) => { void state.removeChapter(id); }}
          onRename={(id, title) => { void state.renameChapter(id, title); }}
        />
      </div>
      <div className="space-y-4">
        <BookSettingsPanel
          book={book}
          disabled={false}
          onTitle={saveTitle}
          onSettings={saveSettings}
          onCoverClick={() => setCoverOpen(true)}
        />
        <BookOrderSummary book={book} chapters={state.chapters} />
      </div>

      <BookChapterPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        addedPaperIds={added}
        busy={state.busy}
        onPick={(paperId) => { void state.addChapter(paperId); }}
      />
      <PaperCoverDialog
        open={coverOpen}
        paperTitle={book.title}
        cover={book.cover}
        coverImageUrl={coverImages.frontUrl}
        backImageUrl={coverImages.backUrl}
        year={coverYearOf(book.createdAt)}
        creatorName={state.creatorName}
        busy={coverSave.saving}
        onClose={() => setCoverOpen(false)}
        onSave={coverSave.save}
        onRemove={coverSave.remove}
      />
    </div>
  );
}
