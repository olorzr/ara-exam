'use client';

import { AlertTriangle, BookOpen, Lock, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PAPER_EDIT_BLOCK_MESSAGES, type PaperEditBlock } from '@/lib/problem-paper/paper-edit';

type PaperEditBannerProps =
  | { kind: 'omr' }
  | { kind: 'in-book' }
  | { kind: 'conflict'; onReload: () => void }
  | { kind: 'blocked'; reason: PaperEditBlock };

/** 띠 모양 — 경고(노랑) / 안내(회색) / 막힘(빨강) */
const TONE = {
  warn: 'border-amber-200 bg-amber-50 text-amber-900',
  info: 'border-gray-200 bg-gray-50 text-gray-700',
  stop: 'border-red-200 bg-red-50 text-red-800',
} as const;

/**
 * 문제지 고치기 화면의 띠 — OMR 경고 · 책에 담김 안내 · 충돌 · 막힘.
 * 인쇄물이 아니라 화면 안내라 `role` 로 읽어 준다(막힘·충돌은 alert, 나머지는 status).
 * @param props - 띠 종류
 * @returns 띠
 */
export default function PaperEditBanner(props: PaperEditBannerProps) {
  if (props.kind === 'omr') {
    return (
      <div role="status" className={`flex gap-2 rounded-md border p-3 text-sm ${TONE.warn}`}>
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          <strong>OMR 채점 문제지예요.</strong> 번호가 곧 답안지 칸이라 순서를 바꾸거나 문항을 넣고 빼면 이미 뽑아 둔
          문제지와 번호가 달라져요. 저장하면 학원 성적의 정답표도 새로 등록하고, 채점이 시작되면 더는 고칠 수 없어요.
        </p>
      </div>
    );
  }
  if (props.kind === 'in-book') {
    return (
      <div role="status" className={`flex gap-2 rounded-md border p-3 text-sm ${TONE.info}`}>
        <BookOpen className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          원장님 책에 담긴 문제지예요. 고치면 책 내지가 함께 바뀌어서, 표지 만들기에서 쪽 수(책등 두께)를 다시 재야 해요.
        </p>
      </div>
    );
  }
  if (props.kind === 'conflict') {
    return (
      <div role="alert" className={`flex flex-wrap items-center gap-2 rounded-md border p-3 text-sm ${TONE.stop}`}>
        <RefreshCw className="h-4 w-4 shrink-0" />
        <p className="min-w-0 flex-1">
          다른 곳에서 이 문제지가 먼저 바뀌었어요. 저장된 것을 다시 불러온 뒤 고쳐 주세요(여기서 고친 것은 사라져요).
        </p>
        <Button type="button" size="sm" variant="outline" onClick={props.onReload}>저장된 것 불러오기</Button>
      </div>
    );
  }
  return (
    <div role="alert" className={`flex gap-2 rounded-md border p-3 text-sm ${TONE.stop}`}>
      <Lock className="mt-0.5 h-4 w-4 shrink-0" />
      <p>{PAPER_EDIT_BLOCK_MESSAGES[props.reason]}</p>
    </div>
  );
}
