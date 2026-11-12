'use client';

import { Button } from '@/components/ui/button';

interface PaperRenumberNoticeProps {
  /** 원본 번호와 인쇄 번호가 다른 이미지 문항 */
  renumbered: readonly { printed: number; original: number }[];
  /** 사람이 확인했는가 — 확인 뒤에는 인쇄물에서 뺀다 */
  acked: boolean;
  onAck: () => void;
}

/** 안내에 번호를 늘어놓는 최대 수 */
const SHOWN_MAX = 5;

/**
 * 이미지로 출제한 문항의 번호가 인쇄 번호와 다르다는 안내 — 보기 화면에서 뗐다(쪽 300줄 상한).
 *
 * ⚠️ 확인 전에는 `data-no-print` 를 붙이지 않는다 — Cmd/Ctrl+P 로 바로 뽑아도 이 안내가 함께 찍혀야 번호가 어긋난
 *    사실이 조용히 넘어가지 않는다(코덱스 리뷰 3R).
 * @param props - 어긋난 문항 · 확인 여부
 * @returns 안내 띠
 */
export default function PaperRenumberNotice({ renumbered, acked, onAck }: PaperRenumberNoticeProps) {
  return (
    <div
      className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"
      data-no-print={acked ? '' : undefined}
    >
      <p className="font-semibold">이미지로 출제한 문항의 번호가 달라요.</p>
      <p className="mt-0.5">
        잘라 둔 이미지에는 원본 번호가 찍혀 있어 인쇄 번호와 함께 보입니다
        ({renumbered.slice(0, SHOWN_MAX).map((r) => `${r.printed}번(원본 ${r.original}번)`).join(', ')}
        {renumbered.length > SHOWN_MAX && ` 외 ${renumbered.length - SHOWN_MAX}개`}).
        자리를 원래 번호에 맞추거나, 검수에서 그 문항을 글로 출제하도록 바꿔 주세요.
      </p>
      {!acked && (
        <Button type="button" variant="outline" size="sm" className="mt-2" data-no-print onClick={onAck}>
          확인했어요 — 인쇄물에서 이 안내 빼기
        </Button>
      )}
    </div>
  );
}
