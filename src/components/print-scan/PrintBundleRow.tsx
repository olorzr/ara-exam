'use client';

import Link from 'next/link';
import { FileText, RefreshCw, Trash2, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { PrintBundleRow as BundleRow } from '@/types/print-scan';
import PrintBundleStatusBadge from './PrintBundleStatusBadge';

interface PrintBundleRowProps {
  bundle: BundleRow;
  busy: boolean;
  aiEnabled: boolean;
  onRead: (bundle: BundleRow) => void;
  onCreateSheet: (bundle: BundleRow) => void;
  onDelete: (bundle: BundleRow) => void;
}

/**
 * 목록의 프린트 한 줄.
 *
 * ⚠️ 줄 전체를 `<Link>` 로 감싸지 않는다 — 그 안에 버튼을 넣으면 잘못된 HTML 이고
 *    키보드로도 못 쓴다(문제지 목록과 같은 모양: flex 래퍼 + 링크 + 형제 버튼).
 */
export default function PrintBundleRow({
  bundle, busy, aiEnabled, onRead, onCreateSheet, onDelete,
}: PrintBundleRowProps) {
  const meta = [bundle.school_name, bundle.year && `${bundle.year}학년도`, bundle.grade]
    .filter(Boolean).join(' ');
  const reading = bundle.status === '읽는중';

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border border-gray-200 px-3 py-2">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium text-gray-900">{bundle.name}</span>
          <PrintBundleStatusBadge status={bundle.status} />
        </div>
        <p className="truncate text-xs text-gray-500">
          {meta || '학교 미지정'} · {bundle.pages.length}쪽
          {bundle.sheetId && ` · 빈칸 ${bundle.markCount}개`}
          {bundle.include_handwriting && ' · 손글씨 포함'}
        </p>
      </div>

      {bundle.sheetId ? (
        <Link href={`/print-sheets/${bundle.id}`}>
          <Button type="button" size="sm" className="bg-primary text-white hover:bg-primary-hover">
            <FileText className="mr-1 h-3.5 w-3.5" />
            시험지 열기
          </Button>
        </Link>
      ) : bundle.status === '읽기완료' ? (
        // 읽어 둔 원문이 있으니 ChatGPT 를 다시 쓰지 않는다
        <Button
          type="button" size="sm" variant="outline"
          onClick={() => onCreateSheet(bundle)}
          disabled={busy}
        >
          <Wand2 className="mr-1 h-3.5 w-3.5" />
          시험지 만들기
        </Button>
      ) : (
        <Button
          type="button" size="sm" variant="outline"
          onClick={() => onRead(bundle)}
          disabled={busy || reading || !aiEnabled}
          title={reading ? '다른 탭에서 읽고 있을 수 있어요' : undefined}
        >
          <RefreshCw className="mr-1 h-3.5 w-3.5" />
          {bundle.status === '실패' ? '다시 읽기' : '읽기'}
        </Button>
      )}

      <button
        type="button"
        onClick={() => onDelete(bundle)}
        disabled={busy}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500 disabled:opacity-30"
        aria-label={`${bundle.name} 지우기`}
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}
