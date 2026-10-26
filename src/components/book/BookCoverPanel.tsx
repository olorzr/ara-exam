'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { OptionSelect } from '@/components/ui/option-select';
import PaperCoverDialog from '@/components/problem-paper/PaperCoverDialog';
import type { useBook } from '@/hooks/useBook';
import { useBookCover } from '@/hooks/useBookCover';
import { useCoverImages } from '@/hooks/useCoverImages';
import {
  BOOK_TITLE_MAX, contrastRatio, INNER_PAPERS, resolveSpineInk, SPINE_INK_MIN_CONTRAST, SPINE_INK_PRESETS, SPINE_TEXT_MAX,
  spineInkFor, spineTitleOf, type BackFill, type Book, type BookEdition, type BookSettings,
} from '@/lib/book';
import { COVER_LAYOUT_LABELS, type PaperCover } from '@/lib/problem-paper/cover';
import { coverYearOf } from '@/lib/problem-paper/cover-text';
import BookOrderSummary from './BookOrderSummary';
import BookSpineColorField from './BookSpineColorField';
import BookSpineFontField from './BookSpineFontField';
import BookSpinePagesField from './BookSpinePagesField';

const PAPER_OPTIONS = INNER_PAPERS.map((p) => ({ value: p.code, label: `${p.name} · ${p.thicknessMm}mm` }));
const BACK_OPTIONS: { value: BackFill; label: string }[] = [
  { value: 'white', label: '흰색 + 학원 이름' },
  { value: 'spine', label: '책등 색 + 학원 이름' },
];

function coverLabel(cover: PaperCover | null): string {
  if (!cover) return '기본(제목만)';
  const front = cover.kind === 'image' ? '그림' : COVER_LAYOUT_LABELS[cover.layout];
  return cover.backKind === 'none' ? front : `${front} · 뒷표지 있음`;
}

interface BookCoverPanelProps {
  book: Book;
  edition: BookEdition;
  state: ReturnType<typeof useBook>;
}

/**
 * 표지 만들기 오른쪽 칸 — 쪽 수 · 내지 용지(책등 두께) · 책등 색·글자 색·글꼴·글자 · 뒷표지 바탕 · 앞·뒤표지 · 주문 요약.
 * 고르면 바로 저장하고, 글 칸은 칸을 떠날 때 저장한다. 앞·뒤표지는 문제지 표지 창을 그대로 쓴다.
 */
export default function BookCoverPanel({ book, edition, state }: BookCoverPanelProps) {
  const [coverOpen, setCoverOpen] = useState(false);
  const coverImages = useCoverImages(book.cover);
  const { save } = state;
  const coverSave = useBookCover(book.id, save);
  const s = book.settings;
  /**
   * 마지막으로 보낸(또는 받은) 설정 — 바꾼 칸만 받아 **이 위에** 합쳐 저장한다. 렌더의 `s` 로 합치면 같은 렌더 안에서
   * 저장이 두 번 나갈 때(두 색 칸이 화면을 떠나며 함께 보낸다) 나중 것이 앞의 변경을 되돌린다(코덱스 2026-10-26 1R).
   * 서버 값·실패 되돌림은 다음 렌더에 따라온다.
   */
  const latestRef = useRef(s);
  useEffect(() => { latestRef.current = book.settings; }, [book.settings]);
  // 책등 색의 지연 저장이 렌더마다 다시 걸리지 않게 참조를 고정한다
  const patchSettings = useCallback((partial: Partial<BookSettings>) => {
    const next = { ...latestRef.current, ...partial };
    latestRef.current = next;
    void save({ settings: next });
  }, [save]);
  const saveSettings = useCallback((settings: BookSettings) => patchSettings(settings), [patchSettings]);
  const ink = resolveSpineInk(s.spineColor, s.spineInk);
  const patch = patchSettings;

  return (
    <div className="space-y-4" data-no-print>
      <section className="space-y-4 rounded-lg border border-gray-200 p-4" aria-labelledby="book-cover-settings-title">
        <h2 id="book-cover-settings-title" className="text-sm font-semibold text-gray-900">표지 설정</h2>

        {/* 표지만 항목은 내지 설정 화면이 없어 제목을 여기서 고친다. 책의 제목은 내지 머리글에 찍혀 쪽 수를 바꾸므로
            내지 설정에서 고친다(바꾸면 쪽 수를 다시 잰다) — 코덱스 2R */}
        {book.kind === 'cover' && (
          <label className="block space-y-1 text-sm">
            <span className="text-gray-600">제목</span>
            <Input
              key={book.title} defaultValue={book.title} maxLength={BOOK_TITLE_MAX}
              onBlur={(e) => {
                const next = e.target.value.trim();
                if (next && next !== book.title) void save({ title: next });
                if (!next) e.target.value = book.title;
              }}
            />
            <span className="block text-xs text-gray-400">목록에 보이는 이름이자, 책등 글자를 비웠을 때 책등에 찍히는 글이에요.</span>
          </label>
        )}

        <BookSpinePagesField book={book} chapters={state.chapters} edition={edition} disabled={false} onSettings={saveSettings} />

        <div className="space-y-1 text-sm">
          <span className="text-gray-600">내지 용지 (책등 두께 계산용)</span>
          <OptionSelect
            value={s.innerPaper} options={PAPER_OPTIONS}
            onChange={(v) => patch({ innerPaper: v })} ariaLabel="내지 용지" className="w-full"
          />
          <span className="block text-xs text-gray-400">열림인쇄 주문 때 고르는 내지와 같아야 책등 두께가 맞아요.</span>
        </div>

        <BookSpineColorField settings={s} disabled={false} onPatch={patchSettings} />

        <div className="space-y-1">
          <BookSpineColorField
            settings={s} disabled={false} onPatch={patchSettings}
            field="spineInk" legend="책등 글자 색" presets={SPINE_INK_PRESETS}
            auto={{ label: '자동(바탕에 맞춰 검정/흰색)', preview: spineInkFor(s.spineColor) }}
          />
          {contrastRatio(ink, s.spineColor) < SPINE_INK_MIN_CONTRAST && (
            <p className="text-xs text-amber-700" role="status">글자가 책등 색과 비슷해 잘 안 보일 수 있어요.</p>
          )}
        </div>

        <BookSpineFontField
          settings={s} sample={spineTitleOf(book, edition)} ink={ink} disabled={false} onSettings={saveSettings}
        />

        <label className="block space-y-1 text-sm">
          <span className="text-gray-600">책등 글자</span>
          <Input
            key={s.spineText} defaultValue={s.spineText} maxLength={SPINE_TEXT_MAX} placeholder={book.title}
            onBlur={(e) => { if (e.target.value.trim() !== s.spineText) patch({ spineText: e.target.value.trim() }); }}
          />
          <span className="block text-xs text-gray-400">비워 두면 책 제목. 아래쪽에는 학원 이름이 들어가요.</span>
        </label>

        <div className="space-y-1 text-sm">
          <span className="text-gray-600">뒷표지 (표지 창에서 뒷표지를 안 골랐을 때)</span>
          <OptionSelect
            value={s.backFill} options={BACK_OPTIONS}
            onChange={(v) => patch({ backFill: v === 'spine' ? 'spine' : 'white' })}
            ariaLabel="뒷표지 바탕" className="w-full"
          />
        </div>

        <div className="flex items-center gap-2 text-sm">
          <span className="text-gray-600">앞·뒤표지</span>
          <Button type="button" size="sm" variant="outline" onClick={() => setCoverOpen(true)}>
            <BookOpen className="h-3.5 w-3.5" />
            <span className="ml-1">{coverLabel(book.cover)}</span>
          </Button>
        </div>
      </section>

      <BookOrderSummary book={book} chapters={state.chapters} />

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
