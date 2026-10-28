'use client';

import { useCallback, useEffect, useState } from 'react';
import { fetchReferenceText } from '@/lib/reference-texts/queries';
import type { ReferenceText } from '@/types/reference-text';

/** 읽어 온 결과 — 어느 요청의 것인지와 함께 든다(옛 응답이 새 화면을 덮지 않게) */
interface ViewResult {
  key: string;
  row: ReferenceText | null;
  failed: boolean;
}

/**
 * 작품 전문 · 개념 한 편을 **읽기만** 한다(보기 화면).
 *
 * 로딩은 state 가 아니라 "지금 열쇠의 결과가 있는가" 에서 파생한다 — 효과 본문의 동기 setState 는 lint 가 막는다.
 * @param id - 전문 id
 * @returns 행 · 읽는 중 · 실패 · 없음 · 다시 읽기
 */
export function useReferenceTextView(id: string) {
  const [seq, setSeq] = useState(0);
  const [result, setResult] = useState<ViewResult | null>(null);
  const key = `${id}#${seq}`;

  useEffect(() => {
    let alive = true;
    const requested = `${id}#${seq}`;
    fetchReferenceText(id)
      .then((row) => { if (alive) setResult({ key: requested, row, failed: false }); })
      .catch(() => { if (alive) setResult({ key: requested, row: null, failed: true }); });
    return () => { alive = false; };
  }, [id, seq]);

  const current = result?.key === key ? result : null;
  const reload = useCallback(() => setSeq((n) => n + 1), []);
  return {
    row: current?.row ?? null,
    loading: current === null,
    failed: current?.failed ?? false,
    missing: current !== null && !current.failed && current.row === null,
    reload,
  };
}
