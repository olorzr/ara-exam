'use client';

import { useRef, type KeyboardEvent } from 'react';
import type { PaperItemRef } from '@/lib/problem-report/queries';
import { reportExcerpt } from '@/lib/problem-report/types';

/** 한 줄 칸 수 — 화살표 위·아래가 이만큼 건너뛴다(CSS `grid-cols-8` 과 같은 값) */
const GRID_COLUMNS = 8;

interface ReportNumberGridProps {
  items: readonly PaperItemRef[];
  /** 고른 항목 id(없으면 '') */
  value: string;
  onChange: (itemId: string) => void;
  disabled?: boolean;
}

/**
 * 신고 창의 번호판 — 문제지 번호(인쇄 번호 = 배열 차례 + 1)를 숫자 단추로 늘어놓는다.
 *
 * 원장님(2026-11-22): "번호 고르는 게 좀 힘들다". 예전엔 드롭다운이라 166문항 문제지면 한참 내려야 했다. 종이를 보며 '17번' 을
 * 찾는 사람에게는 숫자가 한눈에 보이는 판이 빠르다. 많으면 판 안에서만 스크롤한다.
 * 키보드는 라디오 묶음 규약이다 — 묶음 안 한 칸만 Tab 으로 들어가고(고른 칸, 없으면 1번) 화살표·Home·End 로 옮겨 고른다.
 */
export default function ReportNumberGrid({ items, value, onChange, disabled = false }: ReportNumberGridProps) {
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const selected = items.findIndex((item) => item.id === value);
  const focusable = selected >= 0 ? selected : 0;

  const move = (from: number, to: number) => {
    const next = Math.min(Math.max(to, 0), items.length - 1);
    if (next === from) return;
    onChange(items[next].id);
    buttons.current[next]?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const step: Record<string, number> = {
      ArrowRight: 1, ArrowLeft: -1, ArrowDown: GRID_COLUMNS, ArrowUp: -GRID_COLUMNS,
      Home: -index, End: items.length - 1 - index,
    };
    if (!(event.key in step)) return;
    event.preventDefault();
    move(index, index + step[event.key]);
  };

  return (
    <div
      role="radiogroup" aria-label="신고할 문항 번호"
      className="grid max-h-60 grid-cols-8 gap-1 overflow-y-auto rounded-md border border-gray-200 bg-white p-1.5"
    >
      {items.map((item, index) => {
        const checked = index === selected;
        return (
          <button
            key={item.id}
            ref={(el) => { buttons.current[index] = el; }}
            type="button" role="radio" aria-checked={checked} aria-label={`${index + 1}번`} disabled={disabled}
            tabIndex={index === focusable ? 0 : -1}
            title={reportExcerpt(item.snapshot) || undefined}
            onClick={() => onChange(item.id)}
            onKeyDown={(e) => onKeyDown(e, index)}
            className={`h-9 rounded-md border font-tag text-sm font-bold tabular-nums transition-colors disabled:opacity-50 ${
              checked ? 'border-ink bg-ink text-white' : 'border-gray-200 text-gray-700 hover:border-ink hover:text-ink'
            }`}
          >
            {index + 1}
          </button>
        );
      })}
    </div>
  );
}
