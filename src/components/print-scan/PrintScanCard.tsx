'use client';

import { Trash2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { formatDateKR } from '@/lib/format';
import type { PrintBundleRow, PrintScanRow } from '@/types/print-scan';
import PrintBundleRowItem from './PrintBundleRow';

interface PrintScanCardProps {
  scan: PrintScanRow;
  /** 읽기·삭제가 도는 중이면 이 카드의 버튼을 전부 잠근다 (한 번에 하나만 돈다) */
  busy: boolean;
  aiEnabled: boolean;
  onRead: (bundle: PrintBundleRow) => void;
  onCreateSheet: (bundle: PrintBundleRow) => void;
  onDeleteBundle: (bundle: PrintBundleRow) => void;
  onDeleteScan: (scan: PrintScanRow) => void;
}

/** 스캔 한 건 + 그 안의 프린트들 */
export default function PrintScanCard({
  scan, busy, aiEnabled, onRead, onCreateSheet, onDeleteBundle, onDeleteScan,
}: PrintScanCardProps) {
  return (
    <Card>
      <CardContent className="space-y-3 py-4">
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-base font-semibold text-gray-900">
              {scan.title || '제목 없는 스캔'}
            </h2>
            <p className="text-xs text-gray-500">
              {formatDateKR(scan.created_at)} · {scan.page_count}쪽 · 프린트 {scan.bundles.length}장
            </p>
          </div>
          <button
            type="button"
            onClick={() => onDeleteScan(scan)}
            disabled={busy}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500 disabled:opacity-30"
            aria-label={`${scan.title || '제목 없는 스캔'} 통째로 지우기`}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-1.5">
          {scan.bundles.map((bundle) => (
            <PrintBundleRowItem
              key={bundle.id}
              bundle={bundle}
              busy={busy}
              aiEnabled={aiEnabled}
              onRead={onRead}
              onCreateSheet={onCreateSheet}
              onDelete={onDeleteBundle}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
