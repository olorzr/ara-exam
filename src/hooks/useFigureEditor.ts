'use client';

import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { uploadFigure, dropFigure } from '@/lib/problem-bank/figure-capture';
import { figurePlaceholder, MAX_FIGURES } from '@/lib/problem-bank/figure-placeholders';
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
 *
 * ⚠️ 본문·경로를 **인자로 받지 않고 부를 때 읽어 온다**(`read`). '그림 추가' 를 누른 뒤
 *    원본을 끌기까지, 그리고 파일이 올라가는 동안에도 선생님은 계속 글을 친다. 누를 때의
 *    값을 들고 있으면 그 사이 친 글이 **말없이 되돌아간다**(코덱스 리뷰).
 * ⚠️ 그래서 바뀐 본문은 저장을 **기다리기 전에** 화면에 반영한다(`apply`). 저장을 기다린
 *    뒤에 덮어쓰면 그 왕복 동안 친 글을 잃는다. 저장이 실패해도 카드가 '저장 안 됨' 으로
 *    남아 사람이 다시 누르면 되므로(수동 저장이 `figure_paths` 도 함께 보낸다) 잃는 것이 없다.
 */
export interface FigureEditorInput {
  kind: 'passage' | 'problem';
  id: string;
  /** **부를 때의** 본문과 그림 경로를 읽어 온다 — 값을 미리 받아 두면 그 사이 친 글을 잃는다 */
  read: () => { html: string; paths: readonly string[] };
  /** 바뀐 값을 화면에 반영한다 — **저장을 기다리기 전에** 부른다 */
  apply: (next: { html: string; paths: string[] }) => void;
  /** 본문과 그림 경로를 **한 번에** 저장한다. 성공 여부를 돌려준다 */
  save: (next: { html: string; paths: string[] }) => Promise<boolean>;
}

export function useFigureEditor({ kind, id, read, apply, save }: FigureEditorInput) {
  const [busy, setBusy] = useState(false);

  /**
   * 원본에서 끌어 잡은 영역을 그림으로 붙인다.
   * @param bbox - 0~1 정규화 영역
   * @param pageUrl - 그 쪽 이미지의 서명 URL
   */
  const capture = useCallback(async (bbox: Bbox, pageUrl: string): Promise<void> => {
    if (read().paths.length >= MAX_FIGURES) {
      toast.error(`그림은 ${MAX_FIGURES}개까지 붙일 수 있어요.`);
      return;
    }
    setBusy(true);
    try {
      const path = await uploadFigure({ kind, id, pageUrl, bbox });
      if (!path) {
        toast.error('원본에서 그림을 잘라내지 못했어요. 쪽 이미지를 다시 불러와 주세요.');
        return;
      }

      // ⚠️ 본문은 **파일을 올린 뒤에** 읽고, **저장을 기다리기 전에** 반영한다 —
      //    두 왕복 어느 쪽에서도 친 글자를 잃지 않는다
      const now = read();
      const paths = [...now.paths, path];
      const next = { paths, html: `${now.html}${figurePlaceholder(paths.length)}` };
      apply(next);
      if (await save(next)) {
        toast.success('그림을 붙였어요. 편집기에서 칩을 끌어 자리를 옮길 수 있어요.');
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '그림을 붙이지 못했어요.');
    } finally {
      setBusy(false);
    }
  }, [kind, id, read, apply, save]);

  /**
   * 그림 하나를 뺀다.
   * @param index - 1-based 순번
   */
  const remove = useCallback(async (index: number): Promise<void> => {
    if (!window.confirm(`${index}번 그림을 본문에서 뺄까요?`)) return;
    setBusy(true);
    try {
      const next = dropFigure({ index, ...read() });
      apply(next);
      await save(next);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '그림을 빼지 못했어요.');
    } finally {
      setBusy(false);
    }
  }, [read, apply, save]);

  return { busy, capture, remove };
}
