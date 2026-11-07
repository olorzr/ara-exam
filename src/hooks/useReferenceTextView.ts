'use client';

import { useCallback, useEffect, useState } from 'react';
import { fetchReferenceAttachments, fetchReferenceText } from '@/lib/reference-texts/queries';
import type { ReferenceText } from '@/types/reference-text';

/** 읽어 온 본문 — 어느 요청의 것인지와 함께 든다(옛 응답이 새 화면을 덮지 않게) */
interface ViewResult {
  key: string;
  row: ReferenceText | null;
  failed: boolean;
}

/** 이 글에 붙어 보이는 글(제재 정리 · 여백 글, sql/102) — 본문과 따로 온다 */
interface AttachResult {
  key: string;
  attachments: readonly ReferenceText[];
  failed: boolean;
}

const NO_ATTACHMENTS: readonly ReferenceText[] = [];

/**
 * 작품 전문 · 개념 한 편을 **읽기만** 한다(보기 화면).
 *
 * 로딩은 state 가 아니라 "지금 열쇠의 결과가 있는가" 에서 파생한다 — 효과 본문의 동기 setState 는 lint 가 막는다.
 * ⚠️ 붙은 글은 본문과 **따로** 받는다(코덱스 2R). 함께 기다리면 붙은 글 조회가 느리거나 멈출 때 이미 받은 본문까지 스피너에 묶인다.
 *    본문이 먼저 오면 바로 그리고, 붙은 글은 오는 대로 얹는다. 붙은 글만 실패하면 본문은 그대로 두고 실패만 알린다.
 *    붙은 글을 읽는 동안은 `attachLoading` 이다 — 그 사이 인쇄하면 제재 정리·여백이 빠진 인쇄물이 나온다(코덱스 3R).
 * @param id - 전문 id
 * @returns 행 · 붙은 글(읽는 중 · 실패) · 읽는 중 · 실패 · 없음 · 다시 읽기
 */
export function useReferenceTextView(id: string) {
  const [seq, setSeq] = useState(0);
  const [result, setResult] = useState<ViewResult | null>(null);
  const [attached, setAttached] = useState<AttachResult | null>(null);
  const key = `${id}#${seq}`;

  useEffect(() => {
    let alive = true;
    const requested = `${id}#${seq}`;
    fetchReferenceText(id)
      .then((row) => { if (alive) setResult({ key: requested, row, failed: false }); })
      .catch(() => { if (alive) setResult({ key: requested, row: null, failed: true }); });
    fetchReferenceAttachments(id)
      .then((attachments) => { if (alive) setAttached({ key: requested, attachments, failed: false }); })
      .catch(() => { if (alive) setAttached({ key: requested, attachments: NO_ATTACHMENTS, failed: true }); });
    return () => { alive = false; };
  }, [id, seq]);

  const current = result?.key === key ? result : null;
  const currentAttached = attached?.key === key ? attached : null;
  const reload = useCallback(() => setSeq((n) => n + 1), []);
  return {
    row: current?.row ?? null,
    attachments: currentAttached?.attachments ?? NO_ATTACHMENTS,
    attachFailed: currentAttached?.failed ?? false,
    attachLoading: currentAttached === null,
    loading: current === null,
    failed: current?.failed ?? false,
    missing: current !== null && !current.failed && current.row === null,
    reload,
  };
}
