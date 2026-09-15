'use client';

import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import type { Editor } from '@tiptap/react';
import { aiErrorMessage } from '@/lib/ai/errors';
import { getCodexModelPref } from '@/lib/ai/localModelPref';
import { getCodexPort } from '@/lib/ai/localPort';
import { isAiError } from '@/lib/ai/types';
import {
  conceptPickEmptyNotice, runConceptPick,
  type ConceptPick, type ConceptPickDropped, type ConceptPickResult,
} from '@/lib/concept-pick';
import type { MarkItem } from '@/components/exam-builder';
import { ocrStillEnabled } from './useProblemOcr';

/**
 * AI 추천 빈칸 — 본문에서 외울 용어를 골라 **곧바로 마킹**한다.
 *
 * 몇 개를 고를지는 **사람이 정하지 않는다** — 프롬프트가 선생님 손 마킹에서 뽑은 **밀도**
 * (설명 100자에 5개)를 주고 AI 가 본문 길이에 맞춰 낸다.
 *
 * ⚠️ 본문을 **묶음으로 나눠** 차례로 묻고, 묶음이 끝날 때마다 **그 자리에서 마킹한다.**
 *    다 받고 나서 한꺼번에 붙이면 취소·실패가 곧 전부 잃는 일이 된다 — 긴 시험지는 묶음이
 *    여럿이라 몇 분이 걸린다.
 *
 * 목록만 보여 주고 사람이 하나씩 누르게 하지 않는 이유: 수십 개를 일일이 누르는 것은
 * 드래그로 직접 마킹하는 것과 품이 비슷해 도움이 안 된다. 대신 **되돌리기를 쉽게** 둔다 —
 * 붙인 것을 기억해 두었다가 하나씩 빼거나 통째로 되돌릴 수 있다.
 */

export interface UseConceptPickInput {
  editorRef: { current: Editor | null };
  marks: MarkItem[];
  /** 붙었으면 true 를 돌려준다 — 이 값으로 적용 수를 센다 */
  addMarkByText: (text: string, context?: string) => boolean;
  removeMarkByText: (text: string) => void;
}

/** 몇 번째 묶음까지 왔는가 (실행 중이 아니면 null) */
export interface ConceptPickProgress {
  done: number;
  total: number;
}

/**
 * 신호가 끊기면 곧바로 풀리는 약속.
 *
 * ⚠️ **못 끊는 기다림에 발이 묶이지 않기 위한 것**이다(코덱스 리뷰 4R). 킬스위치 확인은
 * `authFetch` 를 거치는데 그 안의 세션 조회·갱신(`getSession`/`refreshSession`)은 신호를
 * 받지 않는다 — 그쪽이 멎으면 `ocrStillEnabled` 가 영영 안 풀리고, 자리를 이미 맡아 둔
 * 훅은 `release()` 에 닿지 못해 **화면이 잠긴 채로 남는다.** 경주에서 이기면 실행 자리를
 * 먼저 놓아 주고, 뒤늦게 끝날 요청은 그냥 버린다(부작용이 없는 조회다).
 * @param signal - 취소 신호
 * @returns 끊겼을 때 `'aborted'` 로 풀리는 약속
 */
function whenAborted(signal: AbortSignal): { promise: Promise<'aborted'>; dispose: () => void } {
  let dispose = () => {};
  const promise = new Promise<'aborted'>((resolve) => {
    if (signal.aborted) {
      resolve('aborted');
      return;
    }
    const onAbort = () => resolve('aborted');
    signal.addEventListener('abort', onAbort, { once: true });
    // 경주에서 **게이트가 이겼을 때** 떼어 낸다(코덱스 리뷰 5R). 지금은 실행마다 새 신호라
    // 쌓일 데가 없지만, 신호를 돌려쓰게 되는 날 조용히 새는 자리가 된다
    dispose = () => signal.removeEventListener('abort', onAbort);
  });
  return { promise, dispose };
}

/** 버린 수를 더한다 — 묶음마다 따로 오므로 화면에 보일 때는 합계여야 한다 */
function addDropped(prev: ConceptPickDropped | null, next: ConceptPickDropped): ConceptPickDropped {
  return {
    notInText: (prev?.notInText ?? 0) + next.notInText,
    duplicate: (prev?.duplicate ?? 0) + next.duplicate,
    malformed: (prev?.malformed ?? 0) + next.malformed,
  };
}

export function useConceptPick({
  editorRef, marks, addMarkByText, removeMarkByText,
}: UseConceptPickInput) {
  const [running, setRunning] = useState(false);
  /** 이번 화면에서 AI 가 붙인 것들 — 되돌리기의 대상이자 근거 표시의 재료 */
  const [applied, setApplied] = useState<ConceptPick[]>([]);
  /** 골랐지만 본문에서 자리를 못 찾은 것 (서식으로 쪼개진 구절) */
  const [notFound, setNotFound] = useState<string[]>([]);
  /** 마지막 실행에서 검증에 걸려 버린 추천 수 — 왜 적게 왔는지 사람에게 설명할 재료 */
  const [dropped, setDropped] = useState<ConceptPickDropped | null>(null);
  /** 묶음 진행 — 몇 분 걸리므로 어디쯤인지 보여 준다 */
  const [progress, setProgress] = useState<ConceptPickProgress | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // 화면이 사라지면 진행 중인 생성을 끊는다(useProblemOcr 과 같은 이유로 layout effect)
  useLayoutEffect(() => () => abortRef.current?.abort(), []);

  const cancel = useCallback(() => abortRef.current?.abort(), []);

  const run = useCallback(async () => {
    if (abortRef.current) return;
    const editor = editorRef.current;
    if (!editor) return;

    // ⚠️ 자리를 **킬스위치 확인보다 먼저** 맡는다(코덱스 리뷰 2R). 그 확인이 `await` 라,
    //    기다리는 사이에 버튼을 한 번 더 누르면 위의 관문(`abortRef.current`)이 아직 비어 있어
    //    두 번째 호출도 통과한다 — 생성이 둘 돌고, 먼저 끝난 쪽이 다른 쪽의 취소 손잡이를 지우고
    //    되돌리기 잠금까지 풀어 버린다.
    const controller = new AbortController();
    abortRef.current = controller;
    setRunning(true);
    setProgress({ done: 0, total: 0 });
    // ⚠️ 지난 실행의 '버린 수'·'자리를 못 찾은 이름' 은 **누르자마자** 지운다(코덱스 리뷰).
    //    묶음마다 더하는 구조라 안 지우면 두 번째 실행에서 지난번 수까지 함께 보이고,
    //    첫 묶음이 오기 전까지 지난번 경고가 새 실행의 것인 양 떠 있다 —
    //    '붙인 것'(applied)은 되돌리기의 대상이라 반대로 **지우면 안 된다**
    setDropped(null);
    setNotFound([]);

    /** 맡아 둔 자리를 도로 놓는다 — 안 놓으면 다시 누를 수 없다 */
    const release = () => {
      abortRef.current = null;
      setRunning(false);
      setProgress(null);
    };

    // 킬스위치 재확인 — 탭을 열어 둔 사이에 기능을 껐을 수 있다(fail-closed).
    // ⚠️ **취소로 끊을 수 있어야 한다**(코덱스 리뷰 3~4R). 자리를 이 확인보다 먼저 맡으므로,
    //    확인이 멎으면 '취소' 가 아무것도 끊지 못해 화면이 잠긴 채 남는다. 신호를 넘기는 것만으로는
    //    모자라다 — `authFetch` 안의 세션 조회·갱신은 신호를 아예 안 받는다. 그래서 경주로 둔다
    const aborted = whenAborted(controller.signal);
    const allowed = await Promise.race([
      ocrStillEnabled('concept_pick', controller.signal),
      aborted.promise,
    ]).finally(aborted.dispose);
    if (allowed === 'aborted' || controller.signal.aborted) {
      // 사람이 끊은 것이다 — 기능이 꺼졌다고 말하면 거짓말이다
      release();
      return;
    }
    if (!allowed) {
      release();
      toast.error(aiErrorMessage('feature_disabled'));
      return;
    }
    // 이번 실행에서 붙인 수·못 붙인 이름은 묶음마다 쌓인다. 취소해도 그때까지의 값이 남아야
    // "몇 개까지 하고 멈췄는지" 를 말할 수 있어 지역 변수로 함께 센다
    let addedCount = 0;
    const missedAll: string[] = [];

    /** 묶음 하나가 오면 그 자리에서 마킹한다 */
    const applyChunk = (result: ConceptPickResult, index: number, total: number) => {
      const added: ConceptPick[] = [];
      for (const pick of result.picks) {
        // 자리 힌트를 함께 넘긴다 — 같은 시어가 원문과 풀이 표에 다 있으면 표 쪽에 뚫어야 한다
        if (addMarkByText(pick.text, pick.context)) added.push(pick);
        else missedAll.push(pick.text);
      }
      addedCount += added.length;
      setApplied((prev) => [...prev, ...added]);
      setNotFound([...missedAll]);
      setDropped((prev) => addDropped(prev, result.dropped));
      setProgress({ done: index, total });
    };

    try {
      const result = await runConceptPick({
        html: editor.getHTML(),
        existing: marks.map((m) => m.text),
        port: getCodexPort(),
        pref: getCodexModelPref(),
        signal: controller.signal,
        onChunk: applyChunk,
      });

      if (addedCount === 0) {
        // AI 가 일부러 안 고른 것과 골랐는데 다 걸러진 것을 가른다 — 앞은 오류가 아니다
        const notice = conceptPickEmptyNotice(result, marks.length > 0);
        toast[notice.level](notice.text);
      } else {
        // 못 붙인 것도 함께 알린다 — 안 그러면 "10개 골랐다" 고 하고 7개만 붙는다
        const tail = missedAll.length > 0 ? ` · 본문에서 못 찾은 ${missedAll.length}개는 빼고요` : '';
        toast.success(`${addedCount}개를 마킹했어요${tail}.`);
      }
    } catch (e) {
      if (isAiError(e)) {
        // 취소는 사람이 한 일이라 오류로 알리지 않는다 — 다만 어디까지 했는지는 밝힌다
        if (e.code === 'cancelled') {
          if (addedCount > 0) toast.info(`${addedCount}개까지 마킹하고 멈췄어요.`);
        } else {
          toast.error(aiErrorMessage(e.code));
        }
      } else {
        toast.error(e instanceof Error ? e.message : '추천을 받지 못했어요.');
      }
    } finally {
      abortRef.current = null;
      setRunning(false);
      setProgress(null);
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
    setDropped(null);
    toast.success('추천 마킹을 되돌렸어요.');
  }, [applied, removeMarkByText]);

  return { running, applied, notFound, dropped, progress, run, cancel, removeOne, undoAll };
}
