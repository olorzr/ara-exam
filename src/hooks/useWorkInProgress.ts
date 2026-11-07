'use client';

import { useEffect } from 'react';
import { holdWorkInProgress } from '@/lib/work-in-progress';

/**
 * 이 화면에 새로 고치면 사라질 것이 있는 동안 자동 새로 고침을 미룬다.
 * @param active - 지금 사라질 것이 있는가
 */
export function useWorkInProgress(active: boolean): void {
  useEffect(() => (active ? holdWorkInProgress() : undefined), [active]);
}
