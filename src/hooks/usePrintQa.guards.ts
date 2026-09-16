'use client';

import { toast } from 'sonner';
import { aiErrorMessage } from '@/lib/ai/errors';
import { isAiError } from '@/lib/ai/types';
import { ocrStillEnabled } from './useProblemOcr';

/**
 * 문답 시험지 훅이 쓰는 잠금·알림 도우미.
 *
 * `usePrintQa` 에서 떼어 둔 까닭은 줄 수뿐이다 — 둘 다 훅 바깥의 순수한 곁일이라
 * 상태를 건드리지 않는다.
 */

/**
 * 킬스위치를 다시 묻되 **취소하면 곧바로 돌아온다**.
 *
 * ⚠️ 신호를 넘기는 것만으로는 모자란다(코덱스 3R). `authFetch` 는 요청을 보내기 **전에**
 *    세션을 받아 오는데 그 기다림은 신호를 안 본다 — 로그인 갱신이 멈추면 취소를 눌러도
 *    `finally` 까지 못 가서 편집도 저장도 잠긴 채로 남는다. 그래서 신호와 **경주시킨다.**
 * @param signal - 취소 신호
 * @returns 쓸 수 있으면 true (취소됐으면 false)
 */
export async function featureAllowed(signal: AbortSignal): Promise<boolean> {
  return Promise.race([
    ocrStillEnabled('print_qa', signal),
    new Promise<boolean>((resolve) => {
      if (signal.aborted) resolve(false);
      else signal.addEventListener('abort', () => resolve(false), { once: true });
    }),
  ]);
}

/**
 * 오류를 사람 말로 — 취소는 사람이 한 일이라 알리지 않는다.
 * @param e - 잡은 값
 * @param fallback - AI 오류가 아닐 때 보일 말
 */
export function reportQaError(e: unknown, fallback: string): void {
  if (isAiError(e)) {
    if (e.code !== 'cancelled') toast.error(aiErrorMessage(e.code));
    return;
  }
  toast.error(e instanceof Error ? e.message : fallback);
}
