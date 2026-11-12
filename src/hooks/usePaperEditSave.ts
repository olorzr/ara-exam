'use client';

import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { gradeSyncFailureMessage, requestGradeSync } from '@/lib/grade-sync-client';
import { toEditEntries } from '@/lib/problem-paper/edit-items';
import {
  PaperEditBlockedError, PaperEditConflictError, updatePaper, type PaperEditBlock, type PaperUpdateResult,
} from '@/lib/problem-paper/paper-edit';
import { paperSaveProblem } from '@/lib/problem-paper/paper-validate';
import type { PaperComposer } from './usePaperComposer';

/** OMR 문제지를 저장하기 직전에 묻는 말 */
export const OMR_EDIT_CONFIRM =
  'OMR 채점 문제지예요.\n'
  + '번호가 곧 답안지 칸이라, 이미 뽑아 나눠 준 문제지가 있으면 고친 뒤 다시 뽑아야 해요.\n'
  + '저장하면 학원 성적의 정답표도 새로 등록해요. 저장할까요?';

/** 학원 성적 정답표를 다시 등록한 결과 */
export type GradeResyncOutcome =
  | { kind: 'synced' }
  | { kind: 'frozen' }
  | { kind: 'failed'; message: string };

interface PaperEditSaveArgs {
  paperId: string;
  /** 읽어 둔 문제지 `updated_at` — 글자 그대로 */
  expectUpdatedAt: string;
  /** OMR 채점 문제지인가(저장값 — 고치기 화면에서 바뀌지 않는다) */
  omr: boolean;
  paper: Pick<PaperComposer, 'items' | 'title' | 'settings' | 'omrPlan'>;
}

/**
 * 수정한 OMR 문제지의 정답표를 학원 성적에 다시 등록한다 — **기다린다**(결과를 알려야 한다).
 * 못 닿아도 서버의 '반영 대기' 표시가 남아 보기 화면이 경고한다(sql/103).
 */
async function resyncGrades(paperId: string, revision: string): Promise<GradeResyncOutcome> {
  // 방금 저장한 판을 싣는다 — 그사이 또 누가 고쳤으면 라우트가 거절하고(paper_changed) 반영 대기 표시가 남는다
  const body: Record<string, string> = revision ? { paperId, revision } : { paperId };
  const res = await requestGradeSync('/api/sync-paper-to-grades', body, { keepalive: true });
  if (res === null) return { kind: 'failed', message: '로그인이 만료됐어요' };
  const failure = gradeSyncFailureMessage(res);
  if (failure) return { kind: 'failed', message: failure };
  if (res?.result?.answerKeyFrozen) return { kind: 'frozen' };
  // stale = 이보다 더 새로 고친 정답표가 이미 들어가 있다(겹친 전송, Ara-system mig599) — 옛것으로 덮이지 않았으니 반영된 것이다
  return { kind: 'synced' };
}

/** 저장 뒤 알림 — 지문 판 · 성적 반영 결과 */
function announceSaved(result: PaperUpdateResult, grades: GradeResyncOutcome | null): void {
  if (result.passageChanged.length > 0) {
    toast.info(
      `${result.passageChanged.join(', ')}번은 같은 묶음의 기존 지문으로 인쇄돼요(문제 은행의 지문이 그 뒤 바뀌었어요). `
      + '새 지문으로 바꾸려면 다시 \'수정\' 에서 그 묶음 머리의 \'최신 지문으로\' 를 눌러 주세요.',
      { duration: 10000 },
    );
  }
  if (!grades) {
    toast.success('문제지를 고쳤어요.');
    return;
  }
  if (grades.kind === 'synced') {
    toast.success('문제지를 고치고 학원 성적의 정답표도 새로 등록했어요.');
  } else if (grades.kind === 'frozen') {
    toast.error('고친 것은 저장했지만, 그 사이 채점이 시작돼 학원 성적의 정답표는 바뀌지 않았어요. 원장님께 알려 주세요.', { duration: 15000 });
  } else {
    toast.warning(`고친 것은 저장했지만 학원 성적에 반영하지 못했어요 — ${grades.message}. 문제지 화면의 '학원 성적에 등록' 으로 다시 보내 주세요.`, { duration: 15000 });
  }
}

/**
 * 고친 문제지를 저장한다.
 *
 * 차례: 저장 전 검사 → (OMR 이면) 확인창 → `update_problem_paper` → (OMR 이면) 정답표 재등록을 기다림 → 알림.
 * 충돌·막힘은 화면이 띠로 보여 주도록 상태로 남긴다(캔버스는 그대로 — 무엇을 고쳤는지 볼 수 있게).
 * @param args - 문제지 id · 읽어 둔 버전 · OMR 여부 · 조합 상태
 * @returns 저장 중 · 충돌 · 막힌 까닭 · 저장 동작(성공하면 true)
 */
export function usePaperEditSave({ paperId, expectUpdatedAt, omr, paper }: PaperEditSaveArgs) {
  const [saving, setSaving] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [blocked, setBlocked] = useState<PaperEditBlock | null>(null);
  const { items, title, settings, omrPlan } = paper;

  const save = useCallback(async (): Promise<boolean> => {
    const problem = paperSaveProblem({ items, title, omrPlan }, 'edit');
    if (problem) {
      toast.error(problem);
      return false;
    }
    if (omr && !window.confirm(OMR_EDIT_CONFIRM)) return false;

    setSaving(true);
    try {
      const result = await updatePaper({
        paperId, expectUpdatedAt, title, entries: toEditEntries(items),
        settings: { columns: settings.columns, showSource: settings.showSource },
      });
      const grades = omr ? await resyncGrades(paperId, result.updatedAt) : null;
      announceSaved(result, grades);
      return true;
    } catch (e) {
      if (e instanceof PaperEditConflictError) setConflict(true);
      if (e instanceof PaperEditBlockedError) setBlocked(e.reason);
      toast.error(e instanceof Error ? e.message : '저장하지 못했어요.');
      return false;
    } finally {
      setSaving(false);
    }
  }, [items, title, settings, omrPlan, omr, paperId, expectUpdatedAt]);

  return { saving, conflict, blocked, save };
}
