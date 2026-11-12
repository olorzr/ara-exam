'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface DuplicateWordsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  inBatchDuplicates: string[];
  existingDuplicates: string[];
  onConfirmSkipDuplicates: () => void;
  onCancel: () => void;
}

/**
 * 단어 업로드 전 중복 단어를 안내하는 다이얼로그.
 * - inBatchDuplicates: 이번 입력 목록 내부에서 같은 이름으로 2번 이상 등장한 단어
 * - existingDuplicates: 선택된 단원에 이미 저장되어 있어 겹치는 단어
 * 사용자는 중복을 제외하고 저장하거나, 수정하러 돌아갈 수 있다.
 */
export default function DuplicateWordsDialog({
  open,
  onOpenChange,
  inBatchDuplicates,
  existingDuplicates,
  onConfirmSkipDuplicates,
  onCancel,
}: DuplicateWordsDialogProps) {
  const totalCount = inBatchDuplicates.length + existingDuplicates.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>중복된 단어가 있습니다</DialogTitle>
          <DialogDescription>
            총 {totalCount}개의 중복 단어가 감지되었습니다. 계속 진행하면 중복은 제외하고 저장합니다.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 max-h-64 overflow-y-auto">
          {inBatchDuplicates.length > 0 && (
            <section>
              <h3 className="text-sm font-semibold text-gray-800 mb-1">
                🔁 입력 목록 내 중복 ({inBatchDuplicates.length}개)
              </h3>
              <ul className="text-sm text-gray-700 list-disc pl-5 space-y-0.5">
                {inBatchDuplicates.map((w) => (
                  <li key={`batch-${w}`}>{w}</li>
                ))}
              </ul>
            </section>
          )}

          {existingDuplicates.length > 0 && (
            <section>
              <h3 className="text-sm font-semibold text-gray-800 mb-1">
                📦 이미 단원에 저장된 단어 ({existingDuplicates.length}개)
              </h3>
              <ul className="text-sm text-gray-700 list-disc pl-5 space-y-0.5">
                {existingDuplicates.map((w) => (
                  <li key={`existing-${w}`}>{w}</li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            수정하러 돌아가기
          </Button>
          <Button
            onClick={onConfirmSkipDuplicates}
          >
            중복 제거하고 저장
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
