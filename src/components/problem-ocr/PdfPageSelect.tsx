'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { PageRole } from '@/hooks/usePdfPages';

/** 역할별 표시 */
const ROLE_STYLE: Record<PageRole, { label: string; ring: string; badge: string }> = {
  problem: { label: '문제', ring: 'ring-primary', badge: 'bg-primary text-white' },
  answer: { label: '정답표', ring: 'ring-amber-500', badge: 'bg-amber-500 text-white' },
  skip: { label: '제외', ring: 'ring-gray-300', badge: 'bg-gray-300 text-gray-700' },
};

/** 누를 때마다 문제 → 정답표 → 제외 → 문제 로 돈다 */
const NEXT_ROLE: Record<PageRole, PageRole> = {
  problem: 'answer',
  answer: 'skip',
  skip: 'problem',
};

interface PdfPageSelectProps {
  pageCount: number;
  from: number;
  windowSize: number;
  thumbnails: string[];
  roles: Map<number, PageRole>;
  loading: boolean;
  onRole: (page: number, role: PageRole) => void;
  onRoleForWindow: (role: PageRole) => void;
  /** 문서 마지막 n쪽을 한 역할로 */
  onRoleForLast: (count: number, role: PageRole) => void;
  onShowFrom: (from: number) => void;
}

/**
 * 쪽마다 역할(문제·정답표·제외)을 고르는 썸네일 판.
 *
 * 한 번에 다 그리지 않고 창 단위로 본다 — 모의고사는 정답표가 25쪽 뒤에 붙는 일이 흔해서
 * 앞쪽만 보여 주면 정작 필요한 쪽을 고를 수가 없다.
 */
export default function PdfPageSelect({
  pageCount, from, windowSize, thumbnails, roles, loading,
  onRole, onRoleForWindow, onRoleForLast, onShowFrom,
}: PdfPageSelectProps) {
  const end = Math.min(pageCount, from + thumbnails.length - 1);
  const [lastRaw, setLastRaw] = useState(1);
  // 친 값을 렌더 단계에서 가둔다 — 효과로 되돌리면 lint(set-state-in-effect)에 걸리고
  // 한 박자 늦게 고쳐지는 구간도 생긴다
  const last = Math.min(Math.max(1, Math.floor(lastRaw) || 1), Math.max(1, pageCount));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-gray-600">
          {pageCount}쪽 중 {from}~{end}쪽 · 썸네일을 누르면 역할이 바뀝니다
        </p>
        <div className="flex items-center gap-1">
          <Button
            type="button" variant="outline" size="sm"
            onClick={() => onShowFrom(Math.max(1, from - windowSize))}
            disabled={from <= 1 || loading}
          >
            이전
          </Button>
          <Button
            type="button" variant="outline" size="sm"
            onClick={() => onShowFrom(Math.min(pageCount, from + windowSize))}
            disabled={end >= pageCount || loading}
          >
            다음
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-1 text-xs">
        <span className="text-gray-500 mr-1">보이는 쪽 전체를</span>
        {(Object.keys(ROLE_STYLE) as PageRole[]).map((role) => (
          <Button
            key={role} type="button" variant="outline" size="sm"
            onClick={() => onRoleForWindow(role)}
          >
            {ROLE_STYLE[role].label}
          </Button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-1 text-xs">
        <span className="mr-1 text-gray-500">답지가 뒤에 붙어 있으면 · 마지막</span>
        <Input
          type="number"
          min={1}
          max={pageCount}
          value={lastRaw}
          onChange={(e) => setLastRaw(Number(e.target.value))}
          className="h-8 w-16 text-sm"
          aria-label="정답표로 지정할 마지막 쪽 수"
        />
        <span className="text-gray-500">쪽을</span>
        <Button
          type="button" variant="outline" size="sm"
          onClick={() => onRoleForLast(last, 'answer')}
          disabled={loading}
        >
          정답표로
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        {thumbnails.map((src, i) => {
          const page = from + i;
          const role = roles.get(page) ?? 'problem';
          const style = ROLE_STYLE[role];
          return (
            <button
              key={page}
              type="button"
              onClick={() => onRole(page, NEXT_ROLE[role])}
              className={`relative overflow-hidden rounded border bg-white ring-2 ${style.ring} transition`}
              aria-label={`${page}쪽 — 지금 ${style.label}. 누르면 ${ROLE_STYLE[NEXT_ROLE[role]].label} 로 바뀝니다`}
            >
              {/* next/image 는 지연 로딩이라 썸네일 판에서 깜빡인다 — data URL 이므로 img 로 그린다 */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt={`${page}쪽`} className="block w-full" />
              <span className="absolute left-1 top-1 rounded bg-black/60 px-1 text-[10px] text-white">
                {page}
              </span>
              <span className={`absolute right-1 top-1 rounded px-1 text-[10px] ${style.badge}`}>
                {style.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
