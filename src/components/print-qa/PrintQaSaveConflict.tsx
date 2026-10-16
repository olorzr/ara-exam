'use client';

import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { PrintQaSaveFailure } from '@/hooks/usePrintQaPersist';

interface PrintQaSaveConflictProps {
  failure: PrintQaSaveFailure;
  /** 저장·AI 가 도는 중이면 단추를 잠근다 */
  busy: boolean;
  onReload: () => void;
  onOverwrite: () => void;
}

/**
 * 문답 저장이 멈췄을 때의 안내 (2026-10-15 리뷰 2·7번).
 *
 * ⚠️ 어느 쪽도 **알아서 고르지 않는다.** 저장된 것을 다시 불러오면 이 화면의 편집·AI 결과가,
 *    덮어쓰면 먼저 저장한 선생님의 교정이 사라진다 — 단추 둘 다 확인창을 거친다(훅이 묻는다).
 *    묶음이 지워진 경우에는 덮어쓸 곳이 없으니 안내만 한다(화면의 내용은 그대로 남아 옮겨 적을 수 있다).
 * @param props - 멈춘 까닭과 두 길
 * @returns 안내 띠
 */
export default function PrintQaSaveConflict({ failure, busy, onReload, onOverwrite }: PrintQaSaveConflictProps) {
  return (
    <div
      role="alert"
      className="flex flex-wrap items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-900"
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1 space-y-2">
        {failure === 'conflict' ? (
          <p>
            다른 탭이나 다른 선생님이 이 문답을 <b>먼저 저장했어요.</b> 이 화면의 내용은 아직 저장되지 않았어요.
            저장된 것을 불러와 다시 고치거나, 이 화면의 내용으로 덮어쓸 수 있어요(덮어쓰면 그쪽에서 고친 답은 사라집니다).
          </p>
        ) : (
          <p>
            이 프린트를 <b>찾지 못해</b> 저장하지 못했어요. 다른 탭에서 지웠을 수 있어요.
            이 화면의 내용은 남아 있으니 필요한 답은 옮겨 적어 두세요.
          </p>
        )}
        {failure === 'conflict' && (
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" disabled={busy} onClick={onReload}>
              저장된 것 불러오기
            </Button>
            <Button type="button" variant="outline" size="sm" disabled={busy} onClick={onOverwrite}>
              이 화면의 내용으로 덮어쓰기
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
