'use client';

import { AlertTriangle } from 'lucide-react';

interface PaperShrunkNoticeProps {
  /** 줄여 찍히는 자리 이름들(`shrunkLabelsOf`) — 비면 아무것도 그리지 않는다 */
  labels: readonly string[];
}

/**
 * 글씨가 줄어 찍히는 곳 안내(화면 전용, 인쇄되지 않는다).
 *
 * 한 쪽(단)에 다 안 들어가는 덩어리는 인쇄 엔진이 통째로 줄여 찍는다. 인쇄해 보기 전에는 몰랐던 것을 보기 화면에서
 * 미리 알린다 — 같은 부류의 제보가 세 번 있었다(shrunk-blocks.ts). 인쇄를 막지는 않는다(내용이 사라지는 것은 아니다).
 */
export default function PaperShrunkNotice({ labels }: PaperShrunkNoticeProps) {
  if (labels.length === 0) return null;
  return (
    <div
      className="mb-3 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"
      data-no-print
      role="status"
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <span className="min-w-0 break-keep [overflow-wrap:anywhere]">
        <b>글씨가 줄어 찍히는 곳이 있어요: {labels.join(', ')}</b>{' '}
        한 단에 다 안 들어가는 덩어리라 작게 찍혀요. 인쇄하기 전에 그 자리를 한 번 봐 주세요.
      </span>
    </div>
  );
}
