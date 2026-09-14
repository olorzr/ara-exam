'use client';

import { Maximize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { bundleColor, type BundleDraft, type PageAssignment } from '@/lib/print-scan/bundles';

/** 묶음 색 → 테두리·배지 클래스. Tailwind 는 문자열을 조립하면 못 알아보므로 나열한다 */
const COLOR_CLASS: Record<string, { ring: string; badge: string }> = {
  sky: { ring: 'ring-sky-500', badge: 'bg-sky-500' },
  emerald: { ring: 'ring-emerald-500', badge: 'bg-emerald-500' },
  amber: { ring: 'ring-amber-500', badge: 'bg-amber-500' },
  violet: { ring: 'ring-violet-500', badge: 'bg-violet-500' },
  rose: { ring: 'ring-rose-500', badge: 'bg-rose-500' },
  teal: { ring: 'ring-teal-500', badge: 'bg-teal-500' },
};

interface PrintPageGridProps {
  pageCount: number;
  from: number;
  windowSize: number;
  thumbnails: string[];
  bundles: BundleDraft[];
  assignments: PageAssignment;
  activeId: string;
  loading: boolean;
  onTogglePage: (page: number) => void;
  onAssignWindow: (toActive: boolean) => void;
  onShowFrom: (from: number) => void;
  /** 쪽을 크게 보기 */
  onPreview: (page: number) => void;
}

/**
 * 쪽마다 **어느 프린트(묶음)** 인지 고르는 썸네일 판.
 *
 * 누르면 지금 고른 묶음에 들어가고, 이미 그 묶음이면 빠진다. 아무 묶음에도 안 든 쪽은
 * **읽지 않는다** — 한 스캔에서 실제로 쓰는 쪽이 일부인 경우가 많아 그쪽이 기본이다.
 */
export default function PrintPageGrid({
  pageCount, from, windowSize, thumbnails, bundles, assignments, activeId, loading,
  onTogglePage, onAssignWindow, onShowFrom, onPreview,
}: PrintPageGridProps) {
  const end = Math.min(pageCount, from + thumbnails.length - 1);
  const orderOf = new Map(bundles.map((b, i) => [b.localId, i]));
  const activeOrder = orderOf.get(activeId) ?? 0;
  const activeName = bundles.find((b) => b.localId === activeId)?.name || `${activeOrder + 1}번 프린트`;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-gray-600">
          {pageCount}쪽 중 {from}~{end}쪽 · 썸네일을 누르면{' '}
          <strong className="text-gray-900">{activeName}</strong> 에 들어갑니다
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

      <p className="text-xs text-gray-400">
        고르지 않은 쪽은 읽지 않아요. 프린트 한 장이 시험지 한 장이 됩니다.
        무슨 쪽인지 흐릿하면 <strong className="text-gray-500">구석의 확대 단추</strong>로 크게 볼 수 있어요.
      </p>

      <div className="flex flex-wrap items-center gap-1 text-xs">
        <span className="mr-1 text-gray-500">보이는 쪽 전체를</span>
        <Button
          type="button" variant="outline" size="sm"
          onClick={() => onAssignWindow(true)}
          disabled={loading || !activeId}
        >
          이 프린트에
        </Button>
        <Button
          type="button" variant="outline" size="sm"
          onClick={() => onAssignWindow(false)}
          disabled={loading}
        >
          건너뛰기
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        {thumbnails.map((src, i) => {
          const page = from + i;
          const assigned = assignments.get(page);
          const order = assigned !== undefined ? orderOf.get(assigned) : undefined;
          const color = order !== undefined ? COLOR_CLASS[bundleColor(order)] : null;
          const label = order !== undefined
            ? `${order + 1}번 프린트`
            : '건너뜀';

          return (
            /*
              타일 자체가 이미 '이 프린트에 넣기' 단추라, 확대는 **형제 단추**로 얹는다 —
              단추 안에 단추를 넣는 것은 잘못된 HTML 이고 키보드로도 못 쓴다.
            */
            <div key={page} className="relative">
              <button
                type="button"
                onClick={() => onTogglePage(page)}
                className={`relative block w-full overflow-hidden rounded border bg-white ring-2 transition ${
                  color ? color.ring : 'ring-gray-200 opacity-60 hover:opacity-100'
                }`}
                aria-label={
                  assigned === activeId
                    ? `${page}쪽 — ${label}. 누르면 뺍니다`
                    : `${page}쪽 — 지금 ${label}. 누르면 ${activeName} 에 넣습니다`
                }
              >
                {/* next/image 는 지연 로딩이라 썸네일 판에서 깜빡인다 — data URL 이므로 img 로 그린다 */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt={`${page}쪽`} className="block w-full" />
                <span className="absolute left-1 top-1 rounded bg-black/60 px-1 text-[10px] text-white">
                  {page}
                </span>
                {order !== undefined && color && (
                  <span className={`absolute right-1 top-1 rounded px-1 text-[10px] text-white ${color.badge}`}>
                    {order + 1}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => onPreview(page)}
                className="absolute bottom-1 right-1 rounded bg-black/60 p-1 text-white transition-colors hover:bg-black/80"
                aria-label={`${page}쪽 크게 보기`}
              >
                <Maximize2 className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
