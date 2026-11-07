'use client';

import { useCallback, useState } from 'react';
import type { LayoutHandler } from './useA4Pagination';

/** 잰 본문 쪽 수와 그 판 */
interface Measured {
  edition: string;
  pageCount: number;
}

/** 훅이 내주는 것 */
export interface PaperBodyPages {
  /** 지금 판의 본문 쪽 수(표지 제외). 이 판에서 아직 못 쟀으면 null */
  bodyPages: number | null;
  /** 문서(`A4Document` 의 `onLayout`)에 넘길 알림 받이 — 판이 같으면 참조가 그대로다 */
  handleLayout: LayoutHandler;
}

/**
 * 문제지 보기 화면의 본문 쪽 수를 **어느 판(학생용·교사용·답지)에서 잰 것인지와 함께** 든다.
 *
 * 판마다 쪽 수가 다르다. 판을 바꾼 직후 새 판이 재기 전에 옛 판의 수를 지금 판 것처럼 내주면
 * 중철 안내(`adviseDropBackCover`)가 엉뚱하게 깜빡인다 — 그래서 판이 다르면 null 이다.
 *
 * ⚠️ 알림은 배치가 바뀔 때만 온다(`useA4Pagination`). 학생용과 교사용은 같은 컴포넌트라, 같은 인스턴스를
 *    다시 쓰면 쪽 배정이 우연히 같을 때 새 판의 알림이 안 와 null 에 머문다 — 화면이 판마다 `key` 를 줘
 *    새로 마운트한다(마운트하면 첫 배치에서 반드시 알린다).
 * @param edition - 지금 보는 판
 * @returns 본문 쪽 수와 알림 받이
 */
export function usePaperBodyPages(edition: string): PaperBodyPages {
  const [measured, setMeasured] = useState<Measured | null>(null);
  const handleLayout = useCallback<LayoutHandler>(({ pageCount }) => {
    setMeasured((prev) => (
      prev?.edition === edition && prev.pageCount === pageCount ? prev : { edition, pageCount }
    ));
  }, [edition]);
  return { bodyPages: measured?.edition === edition ? measured.pageCount : null, handleLayout };
}
