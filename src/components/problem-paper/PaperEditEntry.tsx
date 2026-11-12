'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { AlertTriangle, Lock, Pencil } from 'lucide-react';
import { usePaperEditStates } from '@/hooks/usePaperEditStates';
import { PAPER_EDIT_BLOCK_MESSAGES, paperEditHref, type PaperEditBlock } from '@/lib/problem-paper/paper-edit';

/** 툴바에 들어갈 짧은 까닭 — 긴 말은 `title` 로 */
const SHORT_REASON: Record<Exclude<PaperEditBlock, 'not_owner'>, string> = {
  in_book: '책에 담겨 원장님만 수정',
  graded: '채점이 시작돼 수정 잠김',
  grade_check_failed: '수정 잠김 · 채점 확인 실패',
};

interface PaperEditEntryProps {
  paperId: string;
  /** 바뀌면 다시 묻는다 — 학원 성적에 다시 등록한 뒤 '반영 대기' 를 지우려고 */
  refreshKey: number;
  /** OMR 채점 문제지인가 — 상태를 못 읽었을 때 '반영 여부를 확인하지 못했다' 를 알린다 */
  omr: boolean;
}

const ALERT_LINE = 'order-last flex basis-full items-center gap-2 rounded-md border p-2.5 text-sm';

/**
 * 문제지 보기 화면의 '수정' 입구와 '성적 반영 대기' 경고 — 보기 툴바 안에서 그린다.
 *
 * - 고칠 수 있으면 '수정' 링크(책에 담겼거나 평가문제집 문항이 든 문제지는 원장 쪽 주소 — 평가문제집이 보인다).
 * - 작성자가 아니면 아무것도 안 그린다. 그 밖의 까닭(책에 담김 · 채점됨 · 확인 실패)은 잠긴 표시에 까닭을 단다.
 * - OMR 문제지를 고쳤는데 학원 성적 정답표가 아직 옛것이면 **누구에게나** 경고 줄을 띄운다(sql/103 의 반영 대기 표시).
 *   그 줄은 툴바의 다음 줄을 통째로 쓴다(`basis-full order-last`). 다시 물어 실패해도 마지막으로 알던 경고를 지키고,
 *   OMR 문제지인데 상태를 못 읽었으면 '확인하지 못했다' 를 띄운다(코덱스 2R — 경고가 조용히 사라지면 안 된다).
 * @param props - 문제지 id · 다시 묻기 열쇠 · OMR 여부
 * @returns 입구와 경고
 */
export default function PaperEditEntry({ paperId, refreshKey, omr }: PaperEditEntryProps) {
  const ids = useMemo(() => [paperId], [paperId]);
  const { states, failed } = usePaperEditStates(ids, refreshKey);
  const state = states.get(paperId);
  const unverified = failed && omr && !state?.pending ? (
    <p role="status" className={`${ALERT_LINE} border-amber-200 bg-amber-50 text-amber-900`}>
      <AlertTriangle className="h-4 w-4 shrink-0" />
      학원 성적에 고친 내용이 반영됐는지 확인하지 못했어요. 새로 고치거나 &lsquo;학원 성적에 등록&rsquo; 을 한 번 더 눌러 주세요.
    </p>
  ) : null;
  if (!state) return unverified;

  const href = paperEditHref(paperId, state);

  return (
    <>
      {state.reason === null && (
        <Link
          href={href}
          className="inline-flex items-center gap-1 rounded-full border border-ink px-3 py-1 text-sm font-medium text-ink hover:bg-ink hover:text-white"
        >
          <Pencil className="h-3.5 w-3.5" /> 수정
        </Link>
      )}
      {state.reason !== null && state.reason !== 'not_owner' && (
        <span
          className="inline-flex items-center gap-1 text-xs text-gray-500"
          title={PAPER_EDIT_BLOCK_MESSAGES[state.reason]}
        >
          <Lock className="h-3.5 w-3.5" aria-hidden="true" />
          <span>{SHORT_REASON[state.reason]}</span>
        </span>
      )}
      {state.pending && (
        <p role="alert" className={`${ALERT_LINE} border-red-200 bg-red-50 text-red-800`}>
          <AlertTriangle className="h-4 w-4 shrink-0" />
          고친 내용이 학원 성적의 정답표에 아직 반영되지 않았어요. 이대로 채점하면 틀리게 매겨져요 —
          &lsquo;학원 성적에 등록&rsquo; 을 눌러 다시 보내 주세요.
        </p>
      )}
      {unverified}
    </>
  );
}
