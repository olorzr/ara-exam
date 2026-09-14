'use client';

import type { PrintBundleStatus } from '@/types/print-scan';

/** 상태별 배지 색 — 기출 출처 목록(STATUS_STYLE)과 같은 규약 */
const STATUS_STYLE: Record<PrintBundleStatus, string> = {
  대기: 'bg-gray-200 text-gray-700',
  읽는중: 'bg-sky-500 text-white',
  읽기완료: 'bg-emerald-500 text-white',
  실패: 'bg-red-500 text-white',
};

/**
 * 묶음의 읽기 상태.
 * @param status - 묶음 상태
 */
export default function PrintBundleStatusBadge({ status }: { status: PrintBundleStatus }) {
  return (
    <span className={`shrink-0 rounded px-1.5 py-0.5 text-xs font-medium ${STATUS_STYLE[status]}`}>
      {status}
    </span>
  );
}
