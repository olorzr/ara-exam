'use client';

import { useCallback, useMemo, useState } from 'react';
import { defaultAnswerTargets } from '@/lib/print-qa';
import type { PrintQaItem } from '@/types/print-scan';

/**
 * 모범답안을 만들 **대상 고르기** 상태.
 *
 * `usePrintQa` 에서 떼어 둔 까닭: 그 훅이 300줄을 넘었고, 고름은 문항 목록과 **수명이 다르다** —
 * 문항은 저장되지만 고름은 이 화면에 있는 동안만 산다.
 *
 * ⚠️ 화면이 아니라 훅이 들고 있다. 나누기가 끝나면 기본 대상(답 없음·학생 손글씨)으로 다시
 *    채워야 하는데, 새 목록은 나누기가 끝난 자리에서만 알 수 있다 — 화면에 두면 한 박자 늦게
 *    채워지거나 지워진 문항의 옛 id 가 남는다.
 */
export function usePrintQaSelection(initial: readonly PrintQaItem[]) {
  const [picked, setPicked] = useState<ReadonlySet<string>>(
    () => new Set(defaultAnswerTargets(initial)),
  );

  /** 기본 대상(답 없음·학생 손글씨)으로 다시 채운다 */
  const reset = useCallback((items: readonly PrintQaItem[]) => {
    setPicked(new Set(defaultAnswerTargets(items)));
  }, []);

  /** 문항 하나를 대상에 넣거나 뺀다 */
  const pick = useCallback((id: string, on: boolean) => {
    setPicked((prev) => {
      if (prev.has(id) === on) return prev;
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  /**
   * 지운 문항을 고름에서도 뺀다.
   *
   * ⚠️ 안 빼면 '고른 3개' 라고 해 놓고 둘만 만든다 — 그 차이는 결과를 보고서야 드러난다.
   */
  const drop = useCallback((id: string) => {
    setPicked((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  /** 고름을 모두 푼다 */
  const clear = useCallback(() => setPicked(new Set<string>()), []);

  // 돌려주는 객체를 고정한다 — 매번 새로 만들면 이것을 의존성에 넣은 쪽의 콜백이
  // 렌더마다 다시 만들어진다
  return useMemo(
    () => ({ picked, reset, pick, drop, clear }),
    [picked, reset, pick, drop, clear],
  );
}
