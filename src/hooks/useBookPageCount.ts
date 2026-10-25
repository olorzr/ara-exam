'use client';

import { useCallback, useEffect, useState } from 'react';
import type { A4LayoutInfo } from '@/hooks/useA4Pagination';
import type { BookPageCount } from '@/lib/book';
import { useDebouncedValue } from './useDebouncedValue';

/** 쪽 수가 이만큼 바뀌지 않아야 저장한다 — 그림·글꼴이 늦게 오면 엔진이 다시 재 쪽 수가 바뀐다 */
export const BOOK_PAGE_COUNT_SETTLE_MS = 1500;

/** 쪽 수 기록 상태 */
export type BookPageCountStatus = 'measuring' | 'saving' | 'saved' | 'failed';

interface Args {
  /** 저장돼 있는 이 판의 기록 */
  stored: BookPageCount | undefined;
  /** 지금 내지 구성의 지문(`bookLayoutKey`) */
  layoutKey: string;
  /** 저장해도 되는가 — 그림이 다 오고 글꼴이 준비됐는가(그 전 값은 곧 바뀐다) */
  canPersist: boolean;
  /** 기록한다 — 저장했으면 true */
  save: (count: BookPageCount) => Promise<boolean>;
}

/**
 * 내지를 잰 쪽 수를 책에 기록한다 — 표지 화면이 그 값으로 책등을 그린다.
 *
 * 엔진(`A4Document.onLayout`)이 알린 쪽 수를 받아, 가라앉고(`BOOK_PAGE_COUNT_SETTLE_MS`) 저장해도 될 때
 * 저장값과 다르면 한 번 저장한다. 저장에 실패한 값은 다시 시도하지 않는다(`retry` 로만 — 실패마다 다시 보내면
 * 토스트가 끝없이 뜬다). 저장 뒤에는 저장값이 같아져 효과가 멈춘다.
 * @param args - 저장값·지문·저장 가능 여부·저장 함수(안정적인 참조)
 * @returns 엔진에 넘길 `onLayout`, 잰 쪽 수, 상태, 다시 시도
 */
export function useBookPageCount({ stored, layoutKey, canPersist, save }: Args) {
  /**
   * 잰 쪽 수는 **어느 구성에서 잰 것인지**와 함께 든다. 판·구성이 바뀐 직후에는 옛 구성의 쪽 수가 아직 남아 있는데,
   * 그것을 새 지문으로 저장하면 다른 판의 쪽 수로 책등이 그려진다.
   */
  const [measured, setMeasured] = useState<{ key: string; pages: number } | null>(null);
  const onLayout = useCallback(({ pageCount }: A4LayoutInfo) => {
    setMeasured(pageCount > 0 ? { key: layoutKey, pages: pageCount } : null);
  }, [layoutKey]);
  // 준비(그림·글꼴)가 끝난 **뒤에** 다시 가라앉아야 한다 — 준비 전 값을 넣으면, 준비가 늦게 끝나 배치가 바뀔 때 이미 가라앉은
  // 옛 쪽 수가 준비되는 그 순간 저장된다(코덱스 2R). 준비 전에는 null 을 넣어 타이머를 처음부터 다시 돌린다
  const settled = useDebouncedValue(canPersist ? measured : null, BOOK_PAGE_COUNT_SETTLE_MS);
  const [failedFor, setFailedFor] = useState<string | null>(null);

  const current = measured?.key === layoutKey ? measured.pages : null;
  /** 저장할 값 — 지금 구성에서 재서 가라앉았을 때만(같은 객체여야 그 사이 다시 잰 값이 없다) */
  const pages = settled !== null && settled === measured && settled.key === layoutKey ? settled.pages : null;
  const target = pages === null ? null : `${pages}|${layoutKey}`;
  const upToDate = pages !== null && stored?.pages === pages && stored.key === layoutKey;

  useEffect(() => {
    if (!canPersist || target === null || pages === null || upToDate || failedFor === target) return;
    let alive = true;
    void save({ pages, key: layoutKey }).then((ok) => {
      if (alive && !ok) setFailedFor(target);
    });
    return () => { alive = false; };
  }, [canPersist, target, pages, upToDate, failedFor, save, layoutKey]);

  const retry = useCallback(() => setFailedFor(null), []);

  let status: BookPageCountStatus = 'saving';
  if (current === null || target === null || !canPersist) status = 'measuring';
  else if (upToDate) status = 'saved';
  else if (failedFor === target) status = 'failed';

  return { onLayout, measured: current, status, retry };
}
