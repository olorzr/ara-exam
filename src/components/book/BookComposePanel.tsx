'use client';

import { useCallback, useMemo, useState } from 'react';
import type { useBook } from '@/hooks/useBook';
import type { Book, BookSettings } from '@/lib/book';
import BookChapterList from './BookChapterList';
import BookChapterPicker from './BookChapterPicker';
import BookOrderSummary from './BookOrderSummary';
import BookSettingsPanel from './BookSettingsPanel';

interface BookComposePanelProps {
  book: Book;
  state: ReturnType<typeof useBook>;
}

/**
 * 내지 만들기의 구성 화면 — 장 목록(담기·차례·빼기·제목) · 내지 설정 · 주문 요약.
 * 표지(앞·뒤표지 · 책등)는 표지 만들기 화면에서 정한다(2026-10-26).
 */
export default function BookComposePanel({ book, state }: BookComposePanelProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const added = useMemo(() => new Set(state.chapters.map((c) => c.paperId)), [state.chapters]);
  const { save } = state;
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
        <BookSettingsPanel book={book} disabled={false} onTitle={saveTitle} onSettings={saveSettings} />
        <BookOrderSummary book={book} chapters={state.chapters} />
      </div>

      <BookChapterPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        addedPaperIds={added}
        busy={state.busy}
        onPick={(paperId) => { void state.addChapter(paperId); }}
      />
    </div>
  );
}
