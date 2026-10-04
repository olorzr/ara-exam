'use client';

import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PaperCoverAlertsProps {
  /** 표지를 읽지 못했는가(아직 '표지 없이' 를 고르지 않았을 때만) */
  fetchFailed: boolean;
  /** 그림 표지를 끝내 못 받았는가 */
  imageBroken: boolean;
  onRetryFetch: () => void;
  onSkipCover: () => void;
  onRetryImage: () => void;
}

const ALERT_CLASS =
  'flex flex-wrap items-center gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900';

/**
 * 표지 문제 안내(화면 전용). 이 상태에서는 인쇄 단추가 잠기고, 표지 자리에는 인쇄물에도 보이는
 * 안내가 찍힌다(`PaperCoverNotice`) — Cmd/Ctrl+P 로 뽑아도 조용히 빈 첫 장이 나가지 않는다.
 */
export default function PaperCoverAlerts({
  fetchFailed, imageBroken, onRetryFetch, onSkipCover, onRetryImage,
}: PaperCoverAlertsProps) {
  return (
    <>
      {fetchFailed && (
        <div className={ALERT_CLASS} data-no-print role="alert">
          <AlertTriangle className="h-4 w-4" />
          <span>표지를 불러오지 못했어요. 표지가 있는 문제지라면 빠진 채 인쇄될 수 있어요.</span>
          <Button type="button" variant="outline" size="sm" onClick={onRetryFetch}>
            다시 시도
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={onSkipCover}>
            표지 없이 인쇄
          </Button>
        </div>
      )}
      {imageBroken && (
        <div className={ALERT_CLASS} data-no-print role="alert">
          <AlertTriangle className="h-4 w-4" />
          <span>표지 그림을 불러오지 못했어요. 지금 인쇄하면 첫 장에 안내 문구만 찍혀요.</span>
          <Button type="button" variant="outline" size="sm" onClick={onRetryImage}>
            다시 시도
          </Button>
        </div>
      )}
    </>
  );
}
