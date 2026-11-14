'use client';

import { Badge } from '@/components/ui/badge';
import type { PrintBundleStatus } from '@/types/print-scan';

/** 상태별 꼬리표 갈래 — 색만으로 뜻을 전하지 않게 늘 글자와 함께 쓴다(공용 Badge, 2026-11-14) */
const STATUS_VARIANT = {
  대기: 'muted',
  읽는중: 'info',
  읽기완료: 'ok',
  실패: 'danger',
} as const satisfies Record<PrintBundleStatus, string>;

/**
 * 묶음의 읽기 상태.
 * @param status - 묶음 상태
 */
export default function PrintBundleStatusBadge({ status }: { status: PrintBundleStatus }) {
  return <Badge variant={STATUS_VARIANT[status]}>{status}</Badge>;
}
