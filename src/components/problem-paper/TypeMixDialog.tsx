'use client';

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { TypeMixRow } from '@/lib/problem-paper/type-mix';
import TypeMixForm from './TypeMixForm';

interface TypeMixDialogProps {
  open: boolean;
  /** 창을 연 횟수 — 폼을 다시 마운트해 기본값으로 되돌리는 key */
  session: number;
  /** 조건에 걸린 문항의 가벼운 풀. null 이면 아직 읽는 중 */
  pool: readonly TypeMixRow[] | null;
  poolError: string | null;
  busy: boolean;
  added: ReadonlySet<string>;
  onConfirm: (request: { total: number; objectivePercent: number }) => void;
  onClose: () => void;
}

/**
 * **유형 비율로 담기** 창 — 껍데기다(불러오는 중·오류·폼을 가른다).
 *
 * 읽기와 담기는 `usePaperTypeMix` 가 하고 계산은 `TypeMixForm` 이 한다. 여기서 상태를 들지
 * 않으므로 창을 닫았다 열어도 남는 값이 없다.
 */
export default function TypeMixDialog({
  open, session, pool, poolError, busy, added, onConfirm, onClose,
}: TypeMixDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>유형 비율로 담기</DialogTitle>
          <DialogDescription>
            지금 조건에 걸린 문항에서 무작위로 골라요. 같은 지문의 문항은 붙여 담습니다.
          </DialogDescription>
        </DialogHeader>

        {poolError && <p className="text-sm text-red-600">{poolError}</p>}
        {!poolError && !pool && <p className="text-sm text-gray-500">문항을 불러오는 중…</p>}
        {!poolError && pool && (
          // key 로 다시 마운트한다 — 창을 열 때마다 기본값(20문항·80%)으로 돌아간다
          <TypeMixForm
            key={session}
            rows={pool}
            added={added}
            busy={busy}
            onConfirm={onConfirm}
            onCancel={onClose}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
