'use client';

import { useRef, useState } from 'react';
import { Flag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useVisualViewportAnchor } from '@/hooks/useVisualViewportAnchor';
import ProblemReportDialog, { type ReportTarget } from './ProblemReportDialog';

interface ProblemReportButtonProps {
  target: ReportTarget;
  /**
   * 단추 모양 — 상세 창 링크 줄은 글자 링크, 문제지 보기 화면은 오른쪽 아래에 떠 있는 단추(`floating`, 2026-11-22 원장님
   * "드래그를 해도 둥둥 떠서 같이 있도록 — 오른쪽 하단"), `button` 은 보통 테두리 단추
   */
  look?: 'button' | 'link' | 'floating';
}

/**
 * '오류 신고' 단추 — 스스로 창을 연다(문제지 보기 화면 · 문제 은행 상세 창).
 * 창은 열 때마다 새로 마운트한다(`key`) — 앞에 친 글·고른 번호가 남지 않는다.
 * 떠 있는 단추는 `fixed` 라 문서 높이·쪽 배치에 들지 않고, 스크롤해도 오른쪽 아래에 있다. ⚠️ `data-no-print` 를 **단추 자신에**
 * 단다 — 부르는 쪽 상자 밖으로 옮겨도 인쇄물(Cmd/Ctrl+P)에 안 찍히게. 창(z-50)보다 아래(z-40)라 창이 열리면 덮인다.
 * 토스트·새 배포 안내는 오른쪽 위라 겹치지 않는다.
 */
export default function ProblemReportButton({ target, look = 'button' }: ProblemReportButtonProps) {
  const [round, setRound] = useState(0);
  const [open, setOpen] = useState(false);
  // 손가락으로 확대한 화면에서도 보이는 곳 오른쪽 아래에 둔다(코덱스 17R)
  const floatingRef = useRef<HTMLButtonElement>(null);
  useVisualViewportAnchor(floatingRef, look === 'floating');
  const show = () => { setRound((n) => n + 1); setOpen(true); };
  return (
    <>
      {look === 'floating' ? (
        <button
          ref={floatingRef} type="button" onClick={show} data-no-print
          className="fixed right-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-40 inline-flex items-center gap-1.5 rounded-full bg-ink px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-ink/25 transition-colors hover:bg-ink/85 focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none sm:right-6 sm:bottom-[calc(1.5rem+env(safe-area-inset-bottom))]"
        >
          <Flag className="h-4 w-4" aria-hidden="true" />
          오류 신고
        </button>
      ) : look === 'button' ? (
        <Button type="button" size="sm" variant="outline" onClick={show}>
          <Flag className="h-3.5 w-3.5" />
          <span className="ml-1">오류 신고</span>
        </Button>
      ) : (
        <button type="button" onClick={show} className="text-primary underline underline-offset-2">
          오류 신고
        </button>
      )}
      {round > 0 && (
        <ProblemReportDialog key={round} open={open} onClose={() => setOpen(false)} target={target} />
      )}
    </>
  );
}
