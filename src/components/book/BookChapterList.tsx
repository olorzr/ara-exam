'use client';

import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CHAPTER_TITLE_MAX, type BookChapter } from '@/lib/book';

interface BookChapterListProps {
  chapters: readonly BookChapter[];
  /** 장 바꾸기 중 — 단추를 잠근다 */
  busy: boolean;
  onAdd: () => void;
  onMove: (id: string, delta: -1 | 1) => void;
  onRemove: (id: string) => void;
  onRename: (id: string, title: string) => void;
}

/**
 * 장 목록 — 차례 · 장 제목(비우면 문제지 제목) · 문항 수 · 출처, 위아래로 옮기기·빼기.
 * 장을 빼도 문제지는 그대로 남는다.
 */
export default function BookChapterList({
  chapters, busy, onAdd, onMove, onRemove, onRename,
}: BookChapterListProps) {
  return (
    <section className="space-y-2" aria-labelledby="book-chapters-title">
      <div className="flex items-center justify-between">
        <h2 id="book-chapters-title" className="text-sm font-semibold text-gray-900">장 ({chapters.length})</h2>
        <Button type="button" size="sm" onClick={onAdd} disabled={busy}>
          <Plus className="h-3.5 w-3.5" />
          <span className="ml-1">장 추가</span>
        </Button>
      </div>
      {chapters.length === 0 ? (
        <p className="rounded-lg border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500">
          아직 담은 장이 없어요. &lsquo;장 추가&rsquo; 로 저장된 문제지를 골라 담으세요.
        </p>
      ) : (
        <ol className="space-y-2">
          {chapters.map((chapter, i) => (
            <li key={chapter.id} className="flex items-center gap-2 rounded-lg border border-gray-200 p-3">
              <span className="w-10 shrink-0 text-sm font-semibold text-primary">{i + 1}장</span>
              <div className="min-w-0 flex-1 space-y-1">
                <Input
                  // 저장된 값이 바뀌면 칸을 새로 그린다 — 칸이 옛 글을 들고 있지 않게
                  key={`${chapter.id}:${chapter.titleOverride}`}
                  defaultValue={chapter.titleOverride}
                  placeholder={chapter.paper?.title ?? '문제지를 찾지 못했어요'}
                  maxLength={CHAPTER_TITLE_MAX}
                  aria-label={`${i + 1}장 제목`}
                  onBlur={(e) => {
                    if (e.target.value.trim() !== chapter.titleOverride) onRename(chapter.id, e.target.value);
                  }}
                />
                <p className="truncate text-xs text-gray-500">
                  {chapter.paper ? `${chapter.paper.total_questions}문항` : '문제지 없음'}
                  {chapter.paper && chapter.paper.source_labels.length > 0
                    && ` · ${chapter.paper.source_labels.join(', ')}`}
                </p>
              </div>
              <div className="flex shrink-0 items-center">
                <Button
                  type="button" variant="ghost" size="icon-sm" disabled={busy || i === 0}
                  onClick={() => onMove(chapter.id, -1)} aria-label={`${i + 1}장을 위로`}
                >
                  <ArrowUp className="h-4 w-4" />
                </Button>
                <Button
                  type="button" variant="ghost" size="icon-sm" disabled={busy || i === chapters.length - 1}
                  onClick={() => onMove(chapter.id, 1)} aria-label={`${i + 1}장을 아래로`}
                >
                  <ArrowDown className="h-4 w-4" />
                </Button>
                <Button
                  type="button" variant="ghost" size="icon-sm" disabled={busy}
                  onClick={() => onRemove(chapter.id)} aria-label={`${i + 1}장 빼기`}
                >
                  <Trash2 className="h-4 w-4 text-gray-400" />
                </Button>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
