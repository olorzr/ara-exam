'use client';

import { useEffect, useRef, useState } from 'react';
import { BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { OptionSelect } from '@/components/ui/option-select';
import {
  BOOK_TITLE_MAX, INNER_PAPERS, SPINE_COLOR_PRESETS, SPINE_TEXT_MAX,
  type BackFill, type Book, type BookSettings, type ChapterStart,
} from '@/lib/book';
import { COVER_LAYOUT_LABELS, type PaperCover } from '@/lib/problem-paper/cover';

const PAPER_OPTIONS = INNER_PAPERS.map((p) => ({ value: p.code, label: `${p.name} · ${p.thicknessMm}mm` }));
const COLUMN_OPTIONS = [{ value: '2', label: '2단' }, { value: '1', label: '1단' }];
const START_OPTIONS: { value: ChapterStart; label: string }[] = [
  { value: 'odd', label: '오른쪽 면(홀수 쪽)에서' },
  { value: 'page', label: '바로 다음 쪽에서' },
];
/** 색 고르기 창을 움직이는 동안은 저장하지 않고, 이만큼 멈춘 뒤 한 번 저장한다 */
const COLOR_SAVE_DELAY_MS = 500;

const BACK_OPTIONS: { value: BackFill; label: string }[] = [
  { value: 'white', label: '흰색 + 학원 이름' },
  { value: 'spine', label: '책등 색 + 학원 이름' },
];

interface BookSettingsPanelProps {
  book: Book;
  disabled: boolean;
  onTitle: (title: string) => void;
  onSettings: (settings: BookSettings) => void;
  onCoverClick: () => void;
}

function coverLabel(cover: PaperCover | null): string {
  if (!cover) return '기본(제목만)';
  const front = cover.kind === 'image' ? '그림' : COVER_LAYOUT_LABELS[cover.layout];
  return cover.backKind === 'none' ? front : `${front} · 뒷표지 있음`;
}

/**
 * 책 설정 — 제목 · 내지 용지(책등 두께) · 단 수 · 장 시작 · 복합 지문 · 책등 색과 글자 · 뒷표지 바탕 · 표지.
 * 고르면 바로 저장하고, 글 칸은 칸을 떠날 때 저장한다.
 */
export default function BookSettingsPanel({ book, disabled, onTitle, onSettings, onCoverClick }: BookSettingsPanelProps) {
  const s = book.settings;
  const patch = (next: Partial<BookSettings>) => onSettings({ ...s, ...next });
  // 색 고르기 창은 끄는 동안 change 를 계속 낸다 — 그때마다 저장하지 않고 화면에만 두었다가 멈추면 한 번 저장한다
  const [draftColor, setDraftColor] = useState<string | null>(null);
  const shownColor = draftColor ?? s.spineColor;
  /** 아직 안 보낸 색 저장 — 기다리는 사이 화면을 떠나면(모드 바꾸기) 그 자리에서 보낸다(코덱스 2R) */
  const pendingRef = useRef<(() => void) | null>(null);
  useEffect(() => {
    if (draftColor === null || draftColor === s.spineColor) {
      pendingRef.current = null;
      return;
    }
    // 보내면서 고른 색을 비운다 — 남겨 두면 저장이 실패해 설정이 되돌아갈 때마다 다시 보낸다(코덱스 1R).
    // 화면은 낙관적으로 얹힌 설정 색을 보여 주고, 실패하면 저장된 색으로 돌아간다
    const send = () => {
      pendingRef.current = null;
      setDraftColor(null);
      onSettings({ ...s, spineColor: draftColor });
    };
    pendingRef.current = send;
    const timer = setTimeout(send, COLOR_SAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [draftColor, s, onSettings]);
  useEffect(() => {
    const pending = pendingRef;
    return () => pending.current?.();
  }, []);

  return (
    <section className="space-y-4 rounded-lg border border-gray-200 p-4" aria-labelledby="book-settings-title">
      <h2 id="book-settings-title" className="text-sm font-semibold text-gray-900">책 설정</h2>

      <label className="block space-y-1 text-sm">
        <span className="text-gray-600">책 제목</span>
        <Input
          key={book.title} defaultValue={book.title} maxLength={BOOK_TITLE_MAX} disabled={disabled}
          onBlur={(e) => {
            const next = e.target.value.trim();
            if (next && next !== book.title) onTitle(next);
            if (!next) e.target.value = book.title;
          }}
        />
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1 text-sm">
          <span className="text-gray-600">내지 용지</span>
          <OptionSelect
            value={s.innerPaper} options={PAPER_OPTIONS} disabled={disabled}
            onChange={(v) => patch({ innerPaper: v })} ariaLabel="내지 용지" className="w-full"
          />
          <span className="block text-xs text-gray-400">열림인쇄 주문 때 고르는 내지와 같아야 책등 두께가 맞아요.</span>
        </div>
        <div className="space-y-1 text-sm">
          <span className="text-gray-600">단 수 (학생용·교사용)</span>
          <OptionSelect
            value={String(s.columns)} options={COLUMN_OPTIONS} disabled={disabled}
            onChange={(v) => patch({ columns: v === '1' ? 1 : 2 })} ariaLabel="단 수" className="w-full"
          />
        </div>
        <div className="space-y-1 text-sm">
          <span className="text-gray-600">장 시작</span>
          <OptionSelect
            value={s.chapterStart} options={START_OPTIONS} disabled={disabled}
            onChange={(v) => patch({ chapterStart: v === 'page' ? 'page' : 'odd' })}
            ariaLabel="장 시작" className="w-full"
          />
        </div>
        <label className="flex items-center gap-2 self-end pb-2 text-sm text-gray-700">
          <input
            type="checkbox" checked={s.trimWorks} disabled={disabled}
            onChange={(e) => patch({ trimWorks: e.target.checked })}
            className="h-4 w-4 accent-[color:var(--primary)]"
          />
          복합 지문은 묻는 작품만 인쇄
        </label>
      </div>

      <fieldset className="space-y-2" disabled={disabled}>
        <legend className="text-sm text-gray-600">책등 색</legend>
        <div className="flex flex-wrap items-center gap-2">
          {SPINE_COLOR_PRESETS.map((c) => (
            <button
              key={c.value} type="button"
              onClick={() => { setDraftColor(null); patch({ spineColor: c.value }); }}
              aria-pressed={shownColor === c.value} aria-label={c.label} title={c.label}
              className={`h-7 w-7 rounded-full border ${shownColor === c.value ? 'ring-2 ring-primary ring-offset-2' : 'border-gray-300'}`}
              style={{ background: c.value }}
            />
          ))}
          <label className="flex items-center gap-1 text-xs text-gray-500">
            직접
            <input
              type="color" value={shownColor} aria-label="책등 색 직접 고르기"
              onChange={(e) => setDraftColor(e.target.value.toLowerCase())}
              className="h-7 w-10 cursor-pointer rounded border border-gray-300"
            />
          </label>
        </div>
      </fieldset>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block space-y-1 text-sm">
          <span className="text-gray-600">책등 글자</span>
          <Input
            key={s.spineText} defaultValue={s.spineText} maxLength={SPINE_TEXT_MAX} placeholder={book.title}
            disabled={disabled}
            onBlur={(e) => { if (e.target.value.trim() !== s.spineText) patch({ spineText: e.target.value.trim() }); }}
          />
          <span className="block text-xs text-gray-400">비워 두면 책 제목. 아래쪽에는 학원 이름이 들어가요.</span>
        </label>
        <div className="space-y-1 text-sm">
          <span className="text-gray-600">뒷표지 (표지 창에서 뒷표지를 안 골랐을 때)</span>
          <OptionSelect
            value={s.backFill} options={BACK_OPTIONS} disabled={disabled}
            onChange={(v) => patch({ backFill: v === 'spine' ? 'spine' : 'white' })}
            ariaLabel="뒷표지 바탕" className="w-full"
          />
        </div>
      </div>

      <div className="flex items-center gap-2 text-sm">
        <span className="text-gray-600">앞·뒤표지</span>
        <Button type="button" size="sm" variant="outline" onClick={onCoverClick} disabled={disabled}>
          <BookOpen className="h-3.5 w-3.5" />
          <span className="ml-1">{coverLabel(book.cover)}</span>
        </Button>
      </div>
    </section>
  );
}
