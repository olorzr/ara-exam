'use client';

import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { bundleColor, type BundleDraft, type PageAssignment } from '@/lib/print-scan/bundles';
import { pagesOfBundle } from '@/lib/print-scan/bundles';

/** 묶음 색 → 칩 배경. Tailwind 는 조립한 클래스명을 못 알아보므로 나열한다 */
const DOT_CLASS: Record<string, string> = {
  sky: 'bg-sky-500',
  emerald: 'bg-emerald-500',
  amber: 'bg-amber-500',
  violet: 'bg-violet-500',
  rose: 'bg-rose-500',
  teal: 'bg-teal-500',
};

interface BundleListProps {
  bundles: BundleDraft[];
  assignments: PageAssignment;
  activeId: string;
  invalidIds: string[];
  disabled?: boolean;
  onSelect: (localId: string) => void;
  onAdd: () => void;
  onRemove: (localId: string) => void;
}

/**
 * 이 스캔에 들어 있는 프린트 목록.
 *
 * 한 PDF 에 아이들이 가져온 프린트가 여러 장 섞여 있어서, 무엇을 몇 장으로 나눴는지가
 * 늘 보여야 한다. 고른 프린트가 곧 썸네일을 누를 때 들어갈 자리다.
 */
export default function BundleList({
  bundles, assignments, activeId, invalidIds, disabled, onSelect, onAdd, onRemove,
}: BundleListProps) {
  return (
    <div className="space-y-2">
      <ul className="space-y-1.5">
        {bundles.map((bundle, i) => {
          const pages = pagesOfBundle(assignments, bundle.localId);
          const active = bundle.localId === activeId;
          const invalid = invalidIds.includes(bundle.localId);
          return (
            <li key={bundle.localId}>
              <div
                className={`flex items-center gap-2 rounded-md border px-2.5 py-2 transition ${
                  active ? 'border-primary bg-primary/5' : 'border-gray-200 hover:bg-gray-50'
                }`}
              >
                <button
                  type="button"
                  onClick={() => onSelect(bundle.localId)}
                  className="flex flex-1 items-center gap-2 text-left"
                  aria-current={active ? 'true' : undefined}
                >
                  <span
                    className={`h-2.5 w-2.5 shrink-0 rounded-full ${DOT_CLASS[bundleColor(i)]}`}
                    aria-hidden="true"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-gray-900">
                      {bundle.name || `${i + 1}번 프린트 (이름 없음)`}
                    </span>
                    <span className="block truncate text-xs text-gray-500">
                      {pages.length}쪽
                      {invalid && <span className="ml-1 text-red-600">· 확인 필요</span>}
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => onRemove(bundle.localId)}
                  disabled={disabled || bundles.length <= 1}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500 disabled:opacity-30"
                  aria-label={`${bundle.name || `${i + 1}번 프린트`} 지우기`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      <Button type="button" variant="outline" size="sm" className="w-full" onClick={onAdd} disabled={disabled}>
        <Plus className="mr-1 h-3.5 w-3.5" />
        프린트 추가
      </Button>
      <p className="text-xs text-gray-400">
        학교·학년은 스캔 전체에 한 번만 고릅니다. 프린트 이름은 스캔 제목 뒤에 붙어요.
      </p>
    </div>
  );
}
