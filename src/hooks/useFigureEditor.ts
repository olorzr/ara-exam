'use client';

import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { uploadFigure, dropFigure } from '@/lib/problem-bank/figure-capture';
import {
  figurePlaceholder, MAX_FIGURES, replaceFigureAt,
} from '@/lib/problem-bank/figure-placeholders';
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

/**
 * 누를 때와 **그림 목록이 통째로 같은가**.
 *
 * ⚠️ 그 자리 하나만 견주면 **빈 자리(`''`)가 여럿일 때 뚫린다** — `['a','','']` 에서 2번을
 *    다시 자르려다 2번을 빼면(빼기는 저장을 기다리기 전에 화면부터 고친다) 목록이
 *    `['a','']` 가 되는데, 2번 자리가 여전히 `''` 라 **원래 3번이던 자리**를 채운다
 *    (코덱스 리뷰 2R). 목록 전체를 견주면 그 틈이 없다.
 * @param paths - 지금 경로 목록
 * @param index - 1-based 순번
 * @param expected - 누를 때의 경로 목록
 * @returns 그 자리를 그대로 믿어도 되는가
 */
function holdsExpected(
  paths: readonly string[],
  index: number,
  expected: readonly string[],
): boolean {
  if (index < 1 || index > expected.length) return false;
  return paths.length === expected.length && paths.every((p, i) => p === expected[i]);
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
   * 잘못 잘린 그림을 **그 자리에서** 다시 자른다.
   *
   * AI 는 단 폭 전체와 위아래 여유를 통째로 자르므로(crop.ts) 그림보다 큰 영역이 잡히는
   * 일이 잦다. 빼고 다시 붙이면 그림이 **맨 뒤로 가고 번호가 바뀌어** 편집기의 칩을 도로
   * 옮겨야 한다 — 여기서는 본문을 건드리지 않고 경로 한 자리만 갈아끼운다.
   *
   * ⚠️ 옛 파일은 **남긴다**(`dropFigure` 와 같은 규약) — 이미 만든 문제지가 그 경로를
   *    스냅샷에 들고 있어 지우면 인쇄물에서 그 자리가 빈칸이 된다.
   * ⚠️ **번호만으로 자리를 정하지 않는다.** 잡기를 기다리는 사이 **앞 그림을 빼면**
   *    뒷번호가 당겨져, 그 번호가 가리키는 것이 **다른 그림**이 된다(`A B C` 에서 2번을
   *    다시 자르려다 A 를 빼면 2번이 C 다). 그래서 누를 때의 **목록 전체**(`expected`)를 받아
   *    **올리기 전과 갈아끼우기 직전에** 그대로인지 본다 — 다르면 손대지 않는다.
   * @param index - 다시 자를 그림의 1-based 순번
   * @param bbox - 0~1 정규화 영역
   * @param pageUrl - 그 쪽 이미지의 서명 URL
   * @param expected - 누를 때의 그림 경로 **목록 전체** (빈 자리는 `''`)
   */
  const recapture = useCallback(async (
    index: number,
    bbox: Bbox,
    pageUrl: string,
    expected: readonly string[],
  ): Promise<void> => {
    if (!holdsExpected(read().paths, index, expected)) {
      toast.error('그 사이 그림 목록이 바뀌었어요. 다시 자를 그림을 한 번 더 눌러 주세요.');
      return;
    }
    setBusy(true);
    try {
      const path = await uploadFigure({ kind, id, pageUrl, bbox });
      if (!path) {
        toast.error('원본에서 그림을 잘라내지 못했어요. 쪽 이미지를 다시 불러와 주세요.');
        return;
      }

      // ⚠️ 붙이기와 같은 규약 — 올린 **뒤에** 읽고, 저장을 **기다리기 전에** 반영한다.
      //    올리는 동안에도 그림을 뺄 수 있으므로 자리를 **여기서 한 번 더** 확인한다
      //    (올린 파일은 고아로 남지만, 엉뚱한 자리를 덮어쓰는 것보다 낫다)
      const now = read();
      if (!holdsExpected(now.paths, index, expected)) {
        toast.error('그 사이 그림 목록이 바뀌어 그대로 두었어요. 다시 해 주세요.');
        return;
      }
      const next = { html: now.html, paths: replaceFigureAt(now.paths, index, path) };
      apply(next);
      if (await save(next)) toast.success(`${index}번 그림을 다시 잘랐어요.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '그림을 다시 자르지 못했어요.');
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

  return { busy, capture, recapture, remove };
}
