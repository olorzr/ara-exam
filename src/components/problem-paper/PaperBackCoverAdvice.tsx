'use client';

import { Lightbulb } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PaperBackCoverAdviceProps {
  /** 지금 뒷표지가 올린 그림인가 — 그림은 다시 넣으려면 다시 골라야 한다고 알린다 */
  backIsImage: boolean;
  /** 표지를 저장하는 중인가 — 그동안 '뒷표지 없애기' 를 잠근다 */
  busy: boolean;
  /** 뒷표지를 뺀다(권하는 선택) */
  onDrop: () => void;
  /** 그대로 둔다 — 이 화면에서 안내를 접는다 */
  onKeep: () => void;
}

/**
 * 중철에서 뒷표지만 빼면 빈 면 없이 딱 맞을 때 띄우는 안내(화면 전용, 인쇄되지 않는다).
 *
 * '뒷표지 없애기' 를 앞에, 눈에 띄는 단추로 둔다 — 권하는 선택이다(2026-11-07 원장 요청).
 * 언제 띄우는지는 `adviseDropBackCover`(booklet-advice.ts)가 정한다. 그때는 늘 빈 면 셋이 생기고
 * A3 가 한 장 더 든다(booklet-advice.test 가 고정) — 문구가 그 사실에 기댄다.
 */
export default function PaperBackCoverAdvice({ backIsImage, busy, onDrop, onKeep }: PaperBackCoverAdviceProps) {
  return (
    <div
      className="flex flex-wrap items-center gap-2 rounded-md border border-primary/30 bg-primary/5 p-3 text-sm text-gray-700"
      data-no-print
      role="status"
    >
      <Lightbulb className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
      <span className="min-w-0 flex-1">
        <b>뒷표지만 빼면 빈 면 없이 딱 맞아요.</b>{' '}
        지금은 빈 면이 세 쪽 생기고 A3 도 한 장 더 들어요. 뒷표지는 표지 창에서 다시 넣을 수 있어요
        {backIsImage ? '(그림은 다시 골라야 해요).' : '.'}
      </span>
      <Button type="button" size="sm" disabled={busy} onClick={onDrop}>
        뒷표지 없애기
      </Button>
      <Button type="button" variant="ghost" size="sm" onClick={onKeep}>
        그대로 두기
      </Button>
    </div>
  );
}
