'use client';

import { useState } from 'react';
import { FileMinus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ExcludedPaper, ProblemFilters } from '@/lib/problem-bank/filters';
import PaperExcludePickerDialog from './PaperExcludePickerDialog';

interface PaperExcludeBarProps {
  papers: readonly ExcludedPaper[];
  answeredOnly: boolean;
  /** 고치기 화면이면 그 문제지 id — 자신을 빼기에 고르면 방금 뺀 문항을 다시 담을 수 없게 된다 */
  hidePaperId?: string;
  /** ⚠️ 조합 화면의 `bulk.patch` — 조건을 바꾸면 고른 행도 비워야 한다 */
  onChange: (patch: Partial<ProblemFilters>) => void;
}

/**
 * 문제지 조합 화면의 **빼기 줄** — 정답 없는 문항과 다른 문제지에 담긴 문항을 걸러 낸다(2026-11-07).
 *
 * 필터 줄에 넣지 않은 까닭: 그쪽은 '어느 폴더인가' 를 고르고 '조건 지우기' 로 풀리는데, 이 둘은 폴더를 바꿔도 남는다.
 * 그래서 지금 무엇을 빼고 있는지가 늘 보이도록 칩으로 둔다.
 */
export default function PaperExcludeBar({ papers, answeredOnly, hidePaperId, onChange }: PaperExcludeBarProps) {
  const [picking, setPicking] = useState(false);
  const setPapers = (next: ExcludedPaper[]) => onChange({ exclude_papers: next, page: 0 });

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-gray-200 px-4 py-2.5">
      <label className="flex items-center gap-1.5 text-sm text-gray-700">
        <input
          type="checkbox" checked={answeredOnly}
          onChange={(e) => onChange({ answered_only: e.target.checked, page: 0 })}
          className="h-4 w-4 accent-[color:var(--primary)]"
        />
        정답 없는 문항 빼기
      </label>

      <Button type="button" variant="outline" size="sm" onClick={() => setPicking(true)}>
        <FileMinus className="h-4 w-4" />
        <span className="ml-1">다른 문제지에 담긴 문항 빼기</span>
      </Button>

      {papers.length > 0 && (
        <ul className="flex flex-wrap items-center gap-1.5" aria-label="문항을 빼고 있는 문제지">
          {papers.map((paper) => (
            <li
              key={paper.id}
              className="inline-flex items-center gap-1 rounded-full border border-ink bg-card py-0.5 pl-2.5 pr-1 text-xs text-ink"
            >
              <span className="max-w-56 truncate">{paper.title}</span>
              <span className="shrink-0 text-gray-500">· {paper.total_questions}문항</span>
              <button
                type="button"
                aria-label={`${paper.title} 빼기 풀기`}
                onClick={() => setPapers(papers.filter((p) => p.id !== paper.id))}
                className="rounded-full p-0.5 text-gray-500 hover:bg-accent-soft hover:text-ink"
              >
                <X className="h-3 w-3" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {papers.length > 1 && (
        <Button type="button" variant="ghost" size="sm" className="text-xs" onClick={() => setPapers([])}>
          모두 풀기
        </Button>
      )}

      <PaperExcludePickerDialog
        open={picking}
        selected={papers}
        hidePaperId={hidePaperId}
        onClose={() => setPicking(false)}
        onApply={(next) => { setPicking(false); setPapers(next); }}
      />
    </div>
  );
}
