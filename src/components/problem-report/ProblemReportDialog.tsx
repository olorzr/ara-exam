'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from '@/components/ui/dialog';
import { OptionSelect } from '@/components/ui/option-select';
import { Textarea } from '@/components/ui/textarea';
import { sourceLabelWithNumber } from '@/lib/problem-bank/source-label';
import { notifyProblemReport } from '@/lib/problem-report/notify-client';
import {
  countOpenReports, fetchPaperItemRefs, submitProblemReport, type PaperItemRef,
} from '@/lib/problem-report/queries';
import {
  REPORT_CATEGORIES, REPORT_NOTE_MAX, isReportCategory, reportExcerpt, type ReportCategory,
} from '@/lib/problem-report/types';
import ReportNumberGrid from './ReportNumberGrid';
import ReportOriginalPage from './ReportOriginalPage';
import { useVisualViewportAnchor } from '@/hooks/useVisualViewportAnchor';

/** 무엇을 신고하나 — 문제지(번호를 고른다) 또는 문제 은행 문항 하나 */
export type ReportTarget =
  /** `revision` = 화면이 보고 있는 문제지 판(`updated_at`) — 다른 곳에서 순서를 바꿨으면 번호가 어긋나 신고를 막는다 */
  | { kind: 'paper'; paperId: string; revision: string }
  | { kind: 'problem'; problemId: string; label: string };

interface ProblemReportDialogProps {
  open: boolean;
  onClose: () => void;
  target: ReportTarget;
}

/**
 * 문제 은행 오류 신고 창 — 문제지 보기 화면('오류 신고' 단추)과 문제 은행 문항 상세 창이 같이 쓴다.
 *
 * 번호는 숫자 판으로 고르고(`ReportNumberGrid`), 고른 문항의 원본 시험지 쪽을 옆(좁으면 아래)에 보여 준다(`ReportOriginalPage`,
 * 2026-11-22 원장 요청 — "번호 고르는 게 힘들다", "신고할 때 그 시험지(원본 사진)를 보여 주면 좋겠다").
 *
 * 저장(RPC)이 먼저이고 원장 웍스 알림은 그 뒤다 — 알림이 실패해도 신고는 남는다(목록에 '알림 안 감').
 * 열 때마다 새로 마운트된다(부르는 쪽 `key`) — 앞에 친 글이 남지 않는다.
 */
export default function ProblemReportDialog({ open, onClose, target }: ProblemReportDialogProps) {
  const [items, setItems] = useState<PaperItemRef[] | null>(target.kind === 'paper' ? null : []);
  // 화면이 보고 있는 판과 지금 판이 다르다 — 그대로 고르면 화면의 번호와 다른 문항이 신고된다(코덱스 1R)
  const [stale, setStale] = useState(false);
  const [itemId, setItemId] = useState('');
  const [category, setCategory] = useState<ReportCategory | ''>('');
  const [note, setNote] = useState('');
  const [openCount, setOpenCount] = useState(0);
  const [busy, setBusy] = useState(false);
  // 손가락으로 확대한 채 열어도 보이는 곳 가운데에 확대 전 크기로 — 신고·닫기 단추가 화면 밖에 남지 않게(코덱스 18R)
  const [popupEl, setPopupEl] = useState<HTMLDivElement | null>(null);
  useVisualViewportAnchor(popupEl, open, 'center');

  const paperId = target.kind === 'paper' ? target.paperId : null;
  const revision = target.kind === 'paper' ? target.revision : null;
  useEffect(() => {
    if (!paperId || !revision) return;
    let alive = true;
    fetchPaperItemRefs(paperId, revision)
      .then((read) => {
        if (!alive) return;
        setItems(read.items);
        setStale(read.stale);
      })
      .catch(() => { if (alive) { setItems([]); toast.error('문제지 문항을 불러오지 못했어요.'); } });
    return () => { alive = false; };
  }, [paperId, revision]);

  const picked = items?.find((i) => i.id === itemId) ?? null;
  const pickedNo = picked && items ? items.indexOf(picked) + 1 : 0;
  const problemId = target.kind === 'problem' ? target.problemId : picked?.problem_id ?? null;
  // 원본을 보여 줄 문항이 정해졌나 — 문제지는 번호를 골라야 한다(원본이 지워진 항목이면 problemId 가 null 이라 그 사실을 알린다)
  const originChosen = target.kind === 'problem' || picked !== null;
  useEffect(() => {
    if (!problemId) return;
    let alive = true;
    countOpenReports(problemId).then((n) => { if (alive) setOpenCount(n); });
    return () => { alive = false; };
  }, [problemId]);
  const shownCount = problemId ? openCount : 0;

  const ready = category !== '' && !stale && (target.kind === 'problem' || picked !== null)
    && (category !== 'other' || note.trim() !== '');

  const submit = async () => {
    if (!ready || busy) return;
    setBusy(true);
    try {
      const id = await submitProblemReport({
        category, note: note.trim(),
        ...(target.kind === 'problem'
          ? { problemId: target.problemId }
          : { paperItemId: itemId, paperRevision: target.revision }),
      });
      const notified = await notifyProblemReport(id);
      if (notified === 'reached') toast.success('신고했어요. 원장님께 알렸어요.');
      else toast.warning('신고는 저장됐어요. 원장님께 알림은 못 보냈어요(오류 신고 목록에 남아 있어요).');
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '신고하지 못했어요.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next && !busy) onClose(); }}>
      <DialogContent ref={setPopupEl} className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-4xl" noPrint>
        <DialogTitle className="text-base">문제 오류 신고</DialogTitle>
        <DialogDescription className="text-sm text-gray-500">
          신고하면 원장님께 웍스로 바로 알려요. 고쳐지면 오류 신고 목록에서 확인할 수 있어요.
        </DialogDescription>
        {/* 넓으면 왼쪽 신고 칸 · 오른쪽 원본, 좁으면 번호 → 원본 → 종류·내용 차례로 쌓인다 */}
        <form
          onSubmit={(e) => { e.preventDefault(); void submit(); }}
          className="grid min-w-0 gap-3 sm:grid-cols-2 sm:grid-rows-[auto_1fr] sm:gap-x-6"
        >
          <div className="min-w-0 space-y-3 sm:col-start-1">
            {target.kind === 'paper' ? (
              <div className="space-y-1 text-sm">
                <span className="text-gray-600">몇 번 문항인가요?</span>
                {items === null ? (
                  <p className="text-gray-400">문항을 불러오는 중…</p>
                ) : stale ? (
                  <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900">
                    이 문제지가 다른 곳에서 바뀌었어요. 화면을 새로 고친 뒤 다시 신고해 주세요 — 번호가 달라졌을 수 있어요.
                  </p>
                ) : items.length === 0 ? (
                  <p className="text-gray-400">이 문제지에 문항이 없어요.</p>
                ) : (
                  <ReportNumberGrid items={items} value={itemId} onChange={setItemId} disabled={busy} />
                )}
                {/* 고른 문항을 글로 확인 — 종이의 번호와 맞는지 발문 앞부분으로 본다 */}
                <div aria-live="polite" className="text-xs break-keep [overflow-wrap:anywhere] text-gray-500">
                  {picked && (
                    <>
                      <p className="font-semibold text-gray-700">
                        {pickedNo}번{reportExcerpt(picked.snapshot) ? ` · ${reportExcerpt(picked.snapshot)}` : ''}
                      </p>
                      <p>원본: {sourceLabelWithNumber(picked.snapshot.source, picked.snapshot.number)}</p>
                    </>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-sm break-keep [overflow-wrap:anywhere] text-gray-700">{target.label}</p>
            )}
            {shownCount > 0 && (
              <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900">
                이 문항은 이미 {shownCount}건 신고돼 있어요(접수 중). 다른 내용이면 그대로 신고해 주세요.
              </p>
            )}
          </div>

          <div className="min-w-0 sm:col-start-2 sm:row-span-2 sm:row-start-1">
            {originChosen ? (
              <ReportOriginalPage key={problemId ?? `gone:${itemId}`} problemId={problemId} />
            ) : (
              <p className="rounded-md bg-gray-50 px-3 py-6 text-center text-xs text-gray-500">
                번호를 고르면 원본 시험지 쪽이 여기 보여요.
              </p>
            )}
          </div>

          <div className="min-w-0 space-y-3 sm:col-start-1">
            <div className="space-y-1 text-sm">
              <span className="text-gray-600">어떤 오류인가요?</span>
              <OptionSelect
                value={category} options={REPORT_CATEGORIES}
                onChange={(v) => { if (isReportCategory(v)) setCategory(v); }}
                placeholder="종류 고르기" ariaLabel="오류 종류" disabled={busy} className="w-full"
              />
            </div>
            <label className="block space-y-1 text-sm">
              <span className="text-gray-600">내용 {category === 'other' ? '(꼭 적어 주세요)' : '(있으면 좋아요)'}</span>
              <Textarea
                value={note} maxLength={REPORT_NOTE_MAX} disabled={busy} rows={3}
                onChange={(e) => setNote(e.target.value)}
                placeholder="예: 정답이 ③이 아니라 ④예요 / 보기 ㄷ의 글자가 깨져요"
              />
            </label>
          </div>
          <DialogFooter className="sm:col-span-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={busy}>취소</Button>
            <Button type="submit" disabled={busy || !ready}>{busy ? '신고하는 중…' : '신고하기'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
