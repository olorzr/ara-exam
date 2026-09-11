'use client';

import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { captureFigure, dropFigure } from '@/lib/problem-bank/figure-capture';
import type { Bbox } from '@/types/problem-bank';

/**
 * 검수 카드의 **본문 속 그림**을 붙이고 빼는 일.
 *
 * 문항 카드와 지문 카드가 같은 규칙을 쓴다 — 두 벌로 두면 한쪽만 고쳐져 번호가 어긋난다.
 *
 * ⚠️ 그림을 붙이거나 빼면 **곧바로 저장한다.** 본문 자리표시자와 `figure_paths` 는
 *    번호로 짝을 이루므로 따로 저장될 틈을 주면 안 된다 — 파일은 올라갔는데 본문에는
 *    자리표시자가 없거나 그 반대인 상태가 생기면 그림이 안 보이거나 빈칸이 남는다.
 *    같은 저장에 **지금 치던 본문도 함께** 실린다(사람이 쓴 글이라 잃으면 안 된다).
 */
export interface FigureEditorInput {
  kind: 'passage' | 'problem';
  id: string;
  /** 본문과 그림 경로를 **한 번에** 저장한다. 성공 여부를 돌려준다 */
  save: (next: { html: string; paths: string[] }) => Promise<boolean>;
}

export function useFigureEditor({ kind, id, save }: FigureEditorInput) {
  const [busy, setBusy] = useState(false);

  /**
   * 원본에서 끌어 잡은 영역을 그림으로 붙인다.
   * @param bbox - 0~1 정규화 영역
   * @param pageUrl - 그 쪽 이미지의 서명 URL
   * @param html - 지금 치고 있는 본문
   * @param paths - 지금 달린 그림 경로들
   * @returns 새 본문. 실패하면 null
   */
  const capture = useCallback(async (
    bbox: Bbox,
    pageUrl: string,
    html: string,
    paths: readonly string[],
  ): Promise<string | null> => {
    setBusy(true);
    try {
      const next = await captureFigure({ kind, id, pageUrl, bbox, paths, html });
      if (!next) {
        toast.error('원본에서 그림을 잘라내지 못했어요. 쪽 이미지를 다시 불러와 주세요.');
        return null;
      }
      if (!(await save(next))) return null;
      toast.success('그림을 붙였어요. 편집기에서 칩을 끌어 자리를 옮길 수 있어요.');
      return next.html;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '그림을 붙이지 못했어요.');
      return null;
    } finally {
      setBusy(false);
    }
  }, [kind, id, save]);

  /**
   * 그림 하나를 뺀다.
   * @param index - 1-based 순번
   * @param html - 지금 치고 있는 본문
   * @param paths - 지금 달린 그림 경로들
   * @returns 새 본문. 실패하면 null
   */
  const remove = useCallback(async (
    index: number,
    html: string,
    paths: readonly string[],
  ): Promise<string | null> => {
    if (!window.confirm(`${index}번 그림을 뺄까요? 되돌릴 수 없어요.`)) return null;
    setBusy(true);
    try {
      const next = await dropFigure({ index, paths, html });
      if (!(await save(next))) return null;
      return next.html;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '그림을 빼지 못했어요.');
      return null;
    } finally {
      setBusy(false);
    }
  }, [save]);

  return { busy, capture, remove };
}
