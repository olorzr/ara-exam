'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { fetchPapersForPicker, PAPER_PICKER_LIMIT, type PickerPaper } from '@/lib/book';

/** 검색어를 이만큼 멈춘 뒤에 묻는다 */
const SEARCH_DEBOUNCE_MS = 300;

interface BookChapterPickerProps {
  open: boolean;
  onClose: () => void;
  /** 이미 담긴 문제지 — 고를 수 없게 흐리게 둔다 */
  addedPaperIds: ReadonlySet<string>;
  busy: boolean;
  onPick: (paperId: string) => void;
}

/**
 * 장 고르기 창 — 저장된 문제지(누가 만들었든) 가운데 하나를 골라 맨 뒤 장으로 담는다. 창은 열린 채로 여러 장을 담는다.
 *
 * 아카이브에서 문항을 골라 장을 만들고 싶으면 '문제지 조합' 에서 문제지를 먼저 만든다(그 화면을 그대로 쓴다 —
 * 책 전용 문항 담기를 새로 만들지 않았다, 2026-10-25 계획).
 */
export default function BookChapterPicker({ open, onClose, addedPaperIds, busy, onPick }: BookChapterPickerProps) {
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogTitle className="text-base">장으로 담을 문제지</DialogTitle>
        {open && <PickerBody addedPaperIds={addedPaperIds} busy={busy} onPick={onPick} />}
      </DialogContent>
    </Dialog>
  );
}

function PickerBody({ addedPaperIds, busy, onPick }: Omit<BookChapterPickerProps, 'open' | 'onClose'>) {
  const [search, setSearch] = useState('');
  const query = useDebouncedValue(search, SEARCH_DEBOUNCE_MS);
  const [loaded, setLoaded] = useState<{ query: string; papers: PickerPaper[] } | null>(null);

  useEffect(() => {
    let alive = true;
    fetchPapersForPicker(query)
      .then((papers) => { if (alive) setLoaded({ query, papers }); })
      .catch((e) => {
        if (!alive) return;
        toast.error(e instanceof Error && e.message ? e.message : '문제지를 불러오지 못했어요.');
        setLoaded({ query, papers: [] });
      });
    return () => { alive = false; };
  }, [query]);

  const current = loaded?.query === query ? loaded : null;

  return (
    <div className="space-y-3">
      <Input
        value={search} onChange={(e) => setSearch(e.target.value)}
        placeholder="문제지 제목으로 찾기" aria-label="문제지 제목으로 찾기"
      />
      {current === null ? (
        <div className="flex justify-center py-8">
          <div className="h-6 w-6 animate-spin rounded-full border-b-2 border-primary" />
        </div>
      ) : current.papers.length === 0 ? (
        <p className="py-6 text-center text-sm text-gray-500">맞는 문제지가 없어요.</p>
      ) : (
        <ul className="max-h-[50vh] space-y-1 overflow-y-auto">
          {current.papers.map((paper) => {
            const added = addedPaperIds.has(paper.id);
            return (
              <li key={paper.id}>
                <button
                  type="button"
                  disabled={added || busy}
                  onClick={() => onPick(paper.id)}
                  className="w-full rounded-md border border-gray-200 p-2.5 text-left hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span className="block text-sm font-medium text-gray-900">
                    {paper.title}{added && ' · 담김'}
                  </span>
                  <span className="block truncate text-xs text-gray-500">
                    {paper.total_questions}문항
                    {paper.source_labels.length > 0 && ` · ${paper.source_labels.join(', ')}`}
                    {' · '}{new Date(paper.created_at).toLocaleDateString('ko-KR')}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {current && current.papers.length >= PAPER_PICKER_LIMIT && (
        <p className="text-xs text-gray-400">최근 {PAPER_PICKER_LIMIT}개만 보여요 — 제목으로 찾아 주세요.</p>
      )}
      <p className="text-xs text-gray-500">
        아카이브에서 문항을 골라 새 장을 만들려면{' '}
        <Link href="/problems/papers/new" className="text-primary underline underline-offset-2">문제지 조합</Link>
        에서 문제지를 먼저 만든 뒤 여기서 담으세요.
      </p>
    </div>
  );
}
