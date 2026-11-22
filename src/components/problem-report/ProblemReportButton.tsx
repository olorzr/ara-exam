'use client';

import { useState } from 'react';
import { Flag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ProblemReportDialog, { type ReportTarget } from './ProblemReportDialog';

interface ProblemReportButtonProps {
  target: ReportTarget;
  /** 단추 모양 — 툴바는 테두리 단추, 상세 창 링크 줄은 글자 링크 */
  look?: 'button' | 'link';
}

/**
 * '오류 신고' 단추 — 스스로 창을 연다(문제지 보기 툴바 · 문제 은행 상세 창).
 * 창은 열 때마다 새로 마운트한다(`key`) — 앞에 친 글·고른 번호가 남지 않는다.
 * 문제지 보기 화면에서는 툴바(`data-no-print`)에 놓여 인쇄물에 나가지 않는다 — 문서 안에 넣으면 쪽 배치가 바뀐다.
 */
export default function ProblemReportButton({ target, look = 'button' }: ProblemReportButtonProps) {
  const [round, setRound] = useState(0);
  const [open, setOpen] = useState(false);
  const show = () => { setRound((n) => n + 1); setOpen(true); };
  return (
    <>
      {look === 'button' ? (
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
