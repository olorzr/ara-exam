'use client';

import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import type { Editor } from '@tiptap/react';
import { aiErrorMessage } from '@/lib/ai/errors';
import { getCodexModelPref } from '@/lib/ai/localModelPref';
import { getCodexPort } from '@/lib/ai/localPort';
import { isAiError } from '@/lib/ai/types';
import { conceptPickEmptyNotice, runConceptPick, type ConceptPick } from '@/lib/concept-pick';
import type { MarkItem } from '@/components/exam-builder';
import { ocrStillEnabled } from './useProblemOcr';

/**
 * AI 추천 빈칸 — 본문에서 외울 용어를 골라 **곧바로 마킹**한다.
 *
 * 몇 개를 고를지는 **사람이 정하지 않는다** — 프롬프트가 눈대중과 상한만 주고 AI 가 본문을 보고 정한다.
 *
 * 목록만 보여 주고 사람이 하나씩 누르게 하지 않는 이유: 10개를 일일이 누르는 것은
 * 드래그로 직접 마킹하는 것과 품이 비슷해 도움이 안 된다. 대신 **되돌리기를 쉽게** 둔다 —
 * 붙인 것을 기억해 두었다가 하나씩 빼거나 통째로 되돌릴 수 있다.
 */

export interface UseConceptPickInput {
  editorRef: { current: Editor | null };
  marks: MarkItem[];
  /** 붙었으면 true 를 돌려준다 — 이 값으로 적용 수를 센다 */
  addMarkByText: (text: string) => boolean;
  removeMarkByText: (text: string) => void;
}

export function useConceptPick({
  editorRef, marks, addMarkByText, removeMarkByText,
}: UseConceptPickInput) {
  const [running, setRunning] = useState(false);
  /** 이번 화면에서 AI 가 붙인 것들 — 되돌리기의 대상이자 근거 표시의 재료 */
  const [applied, setApplied] = useState<ConceptPick[]>([]);
  /** 골랐지만 본문에서 자리를 못 찾은 것 (서식으로 쪼개진 구절) */
  const [notFound, setNotFound] = useState<string[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  // 화면이 사라지면 진행 중인 생성을 끊는다(useProblemOcr 과 같은 이유로 layout effect)
  useLayoutEffect(() => () => abortRef.current?.abort(), []);

  const cancel = useCallback(() => abortRef.current?.abort(), []);

  const run = useCallback(async () => {
    if (abortRef.current) return;
    const editor = editorRef.current;
    if (!editor) return;

    // 킬스위치 재확인 — 탭을 열어 둔 사이에 기능을 껐을 수 있다(fail-closed)
    if (!(await ocrStillEnabled('concept_pick'))) {
      toast.error(aiErrorMessage('feature_disabled'));
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    setRunning(true);
    try {
      const result = await runConceptPick({
        html: editor.getHTML(),
        existing: marks.map((m) => m.text),
        port: getCodexPort(),
        pref: getCodexModelPref(),
        signal: controller.signal,
      });

      const added: ConceptPick[] = [];
      const missed: string[] = [];
      for (const pick of result.picks) {
        if (addMarkByText(pick.text)) added.push(pick);
        else missed.push(pick.text);
      }

      setApplied((prev) => [...prev, ...added]);
      setNotFound(missed);

      if (added.length === 0) {
        // AI 가 일부러 안 고른 것과 골랐는데 다 걸러진 것을 가른다 — 앞은 오류가 아니다
        const notice = conceptPickEmptyNotice(result, marks.length > 0);
        toast[notice.level](notice.text);
      } else {
        // 못 붙인 것도 함께 알린다 — 안 그러면 "10개 골랐다" 고 하고 7개만 붙는다
        const tail = missed.length > 0 ? ` · 본문에서 못 찾은 ${missed.length}개는 빼고요` : '';
        toast.success(`${added.length}개를 마킹했어요${tail}.`);
      }
    } catch (e) {
      if (isAiError(e)) {
        // 취소는 사람이 한 일이라 오류로 알리지 않는다
        if (e.code !== 'cancelled') toast.error(aiErrorMessage(e.code));
      } else {
        toast.error(e instanceof Error ? e.message : '추천을 받지 못했어요.');
      }
    } finally {
      abortRef.current = null;
      setRunning(false);
    }
  }, [editorRef, marks, addMarkByText]);

  /** 추천 하나만 빼기 */
  const removeOne = useCallback((text: string) => {
    removeMarkByText(text);
    setApplied((prev) => prev.filter((p) => p.text !== text));
  }, [removeMarkByText]);

  /** AI 가 붙인 것만 전부 되돌린다 — 손으로 한 마킹은 건드리지 않는다 */
  const undoAll = useCallback(() => {
    for (const pick of applied) removeMarkByText(pick.text);
    setApplied([]);
    setNotFound([]);
    toast.success('추천 마킹을 되돌렸어요.');
  }, [applied, removeMarkByText]);

  return { running, applied, notFound, run, cancel, removeOne, undoAll };
}
