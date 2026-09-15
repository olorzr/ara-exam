'use client';

import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { aiErrorMessage } from '@/lib/ai/errors';
import { getCodexModelPref } from '@/lib/ai/localModelPref';
import { getCodexPort } from '@/lib/ai/localPort';
import { isAiError } from '@/lib/ai/types';
import {
  passageQuizEmptyNotice, runPassageQuiz, toQuizItems,
  type PassageQuizCounts, type PassageQuizDropped, type QuizItem, type QuizReferenceText,
} from '@/lib/passage-quiz';
import { ocrStillEnabled } from './useProblemOcr';

/**
 * 지문으로 O,X·단답형을 만드는 화면의 상태.
 *
 * 만든 문항은 **저장하지 않는다** — 이 화면에서 고치고 인쇄하면 끝이고 새로고침하면 사라진다.
 * 그래서 화면을 떠날 때 경고하는 일은 페이지가 맡는다.
 *
 * `useConceptPick` 과 같은 규약: 취소 가능, 언마운트 때 끊기, 킬스위치 재확인(fail-closed).
 */

/** 만들기에 필요한 입력 */
export interface PassageQuizRunInput {
  text: string;
  title: string;
  author: string;
  counts: PassageQuizCounts;
  /** 지문과 함께 읽힐 참고자료 */
  references?: readonly QuizReferenceText[];
}

/** 이 문항들을 만들 때 쓴 지문 — 인쇄는 **이것**을 싣는다 */
export interface PassageQuizSource {
  text: string;
  title: string;
  author: string;
  /**
   * 그때 함께 읽은 자료 이름들.
   *
   * ⚠️ 지문과 같은 이유로 **굳혀 둔다** — 만든 뒤에도 참고자료를 빼고 더할 수 있어서,
   *    인쇄가 지금 목록을 보면 "쓰지도 않은 자료 이름 + 옛 자료로 낸 문항" 이 한 장에 찍힌다.
   */
  references: string[];
}

/**
 * 지문으로 O,X·단답형을 만드는 화면의 상태를 들고 있는 훅.
 * @returns 진행 상태·문항 목록·만들 때 쓴 지문과 조작 함수들
 */
export function usePassageQuiz() {
  const [running, setRunning] = useState(false);
  const [items, setItems] = useState<QuizItem[]>([]);
  /**
   * ⚠️ 만들 때 쓴 지문을 **함께 굳혀 둔다.** 입력칸은 그 뒤에도 고칠 수 있어서,
   *    인쇄가 입력칸을 보면 "바꿔 놓은 지문 + 옛 지문으로 낸 문항" 이 한 장에 찍힌다.
   */
  const [source, setSource] = useState<PassageQuizSource | null>(null);
  /** 마지막 실행에서 검증에 걸려 버린 문항 수 — 왜 적게 왔는지 사람에게 설명할 재료 */
  const [dropped, setDropped] = useState<PassageQuizDropped | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // 화면이 사라지면 진행 중인 생성을 끊는다(useProblemOcr 과 같은 이유로 layout effect)
  useLayoutEffect(() => () => abortRef.current?.abort(), []);

  const cancel = useCallback(() => abortRef.current?.abort(), []);

  const run = useCallback(async (input: PassageQuizRunInput) => {
    if (abortRef.current) return;
    // 만든 것을 말없이 덮지 않는다 — 고쳐 둔 문항이 사라지는 자리다
    if (items.length > 0 && !window.confirm('지금 만든 문항을 지우고 새로 만들까요?')) return;

    // ⚠️ 잠금은 **첫 await 앞**에서 건다. 킬스위치를 먼저 물으면 그 왕복 동안 `abortRef` 도
    //    `running` 도 비어 있어, 두 번 누르면 생성이 둘 돈다(usePrintWordsRegister 와 같은 판단).
    const controller = new AbortController();
    abortRef.current = controller;
    setRunning(true);
    try {
      // 킬스위치 재확인 — 탭을 열어 둔 사이에 기능을 껐을 수 있다(fail-closed)
      const allowed = await ocrStillEnabled('passage_quiz');
      // 이 왕복 동안에도 취소할 수 있다 — 끊었는데 오류를 띄우거나 생성으로 넘어가면 안 된다
      if (controller.signal.aborted) return;
      if (!allowed) {
        toast.error(aiErrorMessage('feature_disabled'));
        return;
      }

      const result = await runPassageQuiz({
        text: input.text,
        title: input.title,
        author: input.author,
        counts: input.counts,
        references: input.references,
        port: getCodexPort(),
        pref: getCodexModelPref(),
        signal: controller.signal,
      });
      // 취소한 뒤에 결과가 도착할 수 있다 — 끊었다고 해 놓고 문항이 튀어나오면 안 된다
      if (controller.signal.aborted) return;

      setItems(toQuizItems(result, Date.now().toString(36)));
      setSource({
        text: input.text,
        title: input.title,
        author: input.author,
        references: (input.references ?? []).map((ref) => ref.label),
      });
      setDropped(result.dropped);

      if (result.ox.length + result.short.length === 0) {
        const notice = passageQuizEmptyNotice(result);
        toast[notice.level](notice.text);
      } else {
        toast.success(`O,X ${result.ox.length}개 · 단답형 ${result.short.length}개를 만들었어요.`);
      }
    } catch (e) {
      // 취소는 사람이 한 일이라 오류로 알리지 않는다. 코드가 'cancelled' 가 아닐 때도 있다 —
      // 브릿지에 붙는 중에 끊으면 연결 실패로 올라온다
      if (controller.signal.aborted) return;
      if (isAiError(e)) {
        if (e.code !== 'cancelled') toast.error(aiErrorMessage(e.code));
      } else {
        toast.error(e instanceof Error ? e.message : '문항을 만들지 못했어요.');
      }
    } finally {
      abortRef.current = null;
      setRunning(false);
    }
  }, [items.length]);

  /** 문장·답을 손으로 고친다 (근거는 지문에서 옮겨 온 것이라 고치지 않는다) */
  const updateItem = useCallback((id: string, patch: Partial<Pick<QuizItem, 'text' | 'answer'>>) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const clear = useCallback(() => {
    if (items.length === 0) return;
    if (!window.confirm('만든 문항을 전부 지울까요?')) return;
    setItems([]);
    setSource(null);
    setDropped(null);
  }, [items.length]);

  return { running, items, source, dropped, run, cancel, updateItem, removeItem, clear };
}
