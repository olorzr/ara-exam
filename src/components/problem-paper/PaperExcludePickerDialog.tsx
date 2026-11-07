'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { fetchPapersForPicker, PAPER_PICKER_LIMIT, type PickerPaper } from '@/lib/book/queries';
import type { ExcludedPaper } from '@/lib/problem-bank/filters';
import { PAPER_EXCLUDE_MAX } from '@/lib/problem-bank/paper-exclusions';

/** 검색어를 이만큼 멈춘 뒤에 묻는다 */
const SEARCH_DEBOUNCE_MS = 300;

interface PaperExcludePickerDialogProps {
  open: boolean;
  /** 지금 빼고 있는 문제지 — 체크된 채로 열린다 */
  selected: readonly ExcludedPaper[];
  onClose: () => void;
  /** 고른 문제지로 통째로 바꾼다(아무것도 안 고르면 빈 배열) */
  onApply: (papers: ExcludedPaper[]) => void;
}

/**
 * 담긴 문항을 뺄 문제지 고르기 창 — 저장된 문제지(누가 만들었든) 가운데 여럿을 고른다.
 *
 * 장 고르기 창(`BookChapterPicker`)과 같은 목록을 쓴다. 다른 점은 하나를 고르면 바로 끝나는 것이 아니라
 * 체크해 두고 '빼기' 로 한 번에 정한다는 것이다 — 고를 때마다 목록이 다시 읽히면 창 뒤가 계속 바뀐다.
 */
export default function PaperExcludePickerDialog({ open, selected, onClose, onApply }: PaperExcludePickerDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogTitle className="text-base">담긴 문항을 뺄 문제지</DialogTitle>
        {/* 창을 열 때마다 처음부터 — 취소한 체크가 다음에 남으면 안 된다 */}
        {open && <PickerBody selected={selected} onClose={onClose} onApply={onApply} />}
      </DialogContent>
    </Dialog>
  );
}

function PickerBody({ selected, onClose, onApply }: Omit<PaperExcludePickerDialogProps, 'open'>) {
  const [search, setSearch] = useState('');
  const query = useDebouncedValue(search, SEARCH_DEBOUNCE_MS);
  /** `papers` 가 null 이면 못 읽었다 — '맞는 문제지가 없어요' 는 거짓말이 된다 */
  const [loaded, setLoaded] = useState<{ query: string; papers: PickerPaper[] | null } | null>(null);
  // 지도로 든다 — 검색으로 목록이 바뀌어도 앞에서 체크한 문제지가 풀리면 안 된다
  const [picked, setPicked] = useState(() => new Map(selected.map((paper) => [paper.id, paper])));

  useEffect(() => {
    let alive = true;
    fetchPapersForPicker(query)
      .then((papers) => { if (alive) setLoaded({ query, papers }); })
      .catch((e) => {
        if (!alive) return;
        toast.error(e instanceof Error && e.message ? e.message : '문제지를 불러오지 못했어요.');
        setLoaded({ query, papers: null });
      });
    return () => { alive = false; };
  }, [query]);

  const toggle = ({ id, title, total_questions }: PickerPaper) => {
    setPicked((prev) => {
      const next = new Map(prev);
      if (next.delete(id)) return next;
      // 칸을 잠가도 여기서 한 번 더 본다 — 두 번 빠르게 누르면 잠기기 전의 칸이 눌린다
      if (next.size >= PAPER_EXCLUDE_MAX) return prev;
      next.set(id, { id, title, total_questions });
      return next;
    });
  };

  const current = loaded?.query === query ? loaded : null;
  const full = picked.size >= PAPER_EXCLUDE_MAX;

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
      ) : current.papers === null ? (
        <p className="py-6 text-center text-sm text-gray-500">문제지를 불러오지 못했어요.</p>
      ) : current.papers.length === 0 ? (
        <p className="py-6 text-center text-sm text-gray-500">맞는 문제지가 없어요.</p>
      ) : (
        <ul className="max-h-[50vh] space-y-1 overflow-y-auto">
          {current.papers.map((paper) => (
            <li key={paper.id}>
              <label className="flex cursor-pointer items-start gap-2 rounded-md border border-gray-200 p-2.5 hover:bg-gray-50 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50">
                <input
                  type="checkbox" checked={picked.has(paper.id)} onChange={() => toggle(paper)}
                  // 체크된 칸은 상한에 닿아도 풀 수 있어야 한다
                  disabled={full && !picked.has(paper.id)}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-[color:var(--primary)]"
                />
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-gray-900">{paper.title}</span>
                  <span className="block truncate text-xs text-gray-500">
                    {paper.total_questions}문항
                    {paper.source_labels.length > 0 && ` · ${paper.source_labels.join(', ')}`}
                    {' · '}{new Date(paper.created_at).toLocaleDateString('ko-KR')}
                  </span>
                </span>
              </label>
            </li>
          ))}
        </ul>
      )}
      {current?.papers && current.papers.length >= PAPER_PICKER_LIMIT && (
        <p className="text-xs text-gray-400">최근 {PAPER_PICKER_LIMIT}개만 보여요 — 제목으로 찾아 주세요.</p>
      )}
      {full && <p className="text-xs text-gray-500">한 번에 {PAPER_EXCLUDE_MAX}개까지 고를 수 있어요.</p>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onClose}>취소</Button>
        <Button type="button" size="sm" onClick={() => onApply([...picked.values()])}>
          {picked.size > 0 ? `${picked.size}개 문제지의 문항 빼기` : '빼지 않기'}
        </Button>
      </div>
    </div>
  );
}
