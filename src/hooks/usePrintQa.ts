'use client';

import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { aiErrorMessage } from '@/lib/ai/errors';
import { getCodexModelPref } from '@/lib/ai/localModelPref';
import { getCodexPort } from '@/lib/ai/localPort';
import { resolveOcrPrefFromBridge } from '@/lib/ai/ocrPref';
import type { QuizReferenceText } from '@/lib/passage-quiz/reference';
import {
  PRINT_QA_ANSWER_MAX_TARGETS, PRINT_QA_MAX_WARNINGS,
  answersLeftInQuestions, answersNotice, answersWarnings,
  applyGeneratedAnswers, editAnswer, isQaStale, planAnswerTargets,
  printQaSourceHash, readPlainWithHandwriting, removeQaItem,
  runPrintQaAnswers, runPrintQaSplit, splitNotice, splitWarnings,
} from '@/lib/print-qa';
import { PRINT_OCR_EFFORT_PREFERENCE, PRINT_OCR_MODEL_PREFERENCE } from '@/lib/print-scan/constants';
import { updateBundle } from '@/lib/print-scan/save';
import type { PrintBundle, PrintQaItem, PrintQaMeta } from '@/types/print-scan';
import { featureAllowed, reportQaError } from './usePrintQa.guards';
import { usePrintQaSelection } from './usePrintQaSelection';

/**
 * 학교 프린트 **문답 시험지**의 상태.
 *
 * `useConceptPick`·`usePassageQuiz` 와 같은 규약: 취소 가능, 언마운트 때 끊기,
 * 킬스위치 재확인(fail-closed), 잠금은 **첫 `await` 앞**에서 건다.
 *
 * ⚠️ O,X·단답형과 달리 **저장한다.** 선생님이 손으로 고친 답과 AI 모범답안이 들어 있어
 *    새로고침 한 번에 날아가면 안 된다 — AI 를 다시 부르는 값이 그대로 다시 든다.
 * ⚠️ 묶음이 확정된 뒤에만 부른다(화면이 그렇게 나눠 있다) — 그래야 첫 상태를 `qa_items` 로
 *    채울 수 있고 효과 안에서 setState 를 하지 않는다.
 */

/** 지금 무엇이 도는 중인가 */
export type PrintQaPhase = 'split' | 'answers' | null;

/**
 * 문답 시험지의 상태를 들고 있는 훅.
 * @param bundle - 읽기가 끝난 묶음 (첫 상태를 `qa_items`·`qa_meta` 로 채운다)
 * @returns 문항·영수증·진행 상태와 나누기·모범답안·편집·저장 함수들
 */
export function usePrintQa(bundle: PrintBundle) {
  const [items, setItems] = useState<PrintQaItem[]>(() => bundle.qa_items ?? []);
  const [meta, setMeta] = useState<PrintQaMeta>(() => bundle.qa_meta ?? {});
  const [phase, setPhase] = useState<PrintQaPhase>(null);
  const selection = usePrintQaSelection(bundle.qa_items ?? []);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  /**
   * 저장이 도는 중인가.
   *
   * ⚠️ **state 가 아니라 ref 다.** 같은 실행 흐름에서 두 번 부르면 state 는 아직 안 바뀌어 있어
   *    두 번째가 통과한다(`usePrintSheetList` 의 `busyRef` 와 같은 판단).
   * ⚠️ 저장과 AI 는 **한 잠금**이다(코덱스 리뷰). 따로 두면 모범답안이 도는 동안 누른 저장이
   *    **옛 문항을 나중에 덮어써**, 화면에는 새 답이 보이는데 DB 에는 옛 답이 남고
   *    `dirty` 는 false 라 아무도 눈치채지 못한다.
   */
  const savingRef = useRef(false);

  // 느슨한 정리는 늦게 실행돼 이미 끝난 생성이 슬쩍 통과할 수 있다(useProblemOcr 과 같은 이유)
  useLayoutEffect(() => () => abortRef.current?.abort(), []);

  // 나누기가 보는 평문과 **같은 함수**로 만든다 — 따로 만들면 모범답안의 근거 대조가
  // 미묘하게 다른 글을 본다(`handwriting.ts` 의 표시 글자 처리)
  const source = useMemo(
    () => readPlainWithHandwriting(bundle.ocr_html, bundle.include_handwriting),
    [bundle.ocr_html, bundle.include_handwriting],
  );
  const plain = source.plain;
  const hash = useMemo(() => printQaSourceHash(bundle.ocr_html), [bundle.ocr_html]);
  /** 나눠 둔 문답이 지금 원문과 어긋나는가 — **지우지 않고 알리기만 한다** */
  const stale = isQaStale({ qa_items: items, qa_meta: meta }, hash);

  const cancel = useCallback(() => abortRef.current?.abort(), []);

  /** 문답과 영수증을 함께 저장한다 — 둘이 갈라지면 해시가 거짓말을 한다 */
  const persist = useCallback(async (nextItems: PrintQaItem[], nextMeta: PrintQaMeta) => {
    await updateBundle(bundle.id, { qa_items: nextItems, qa_meta: nextMeta });
  }, [bundle.id]);

  /**
   * 본문을 물음과 답으로 나눈다 (AI 한 턴).
   * @returns 나눈 문항 수. 못 했으면 0
   */
  const split = useCallback(async (): Promise<number> => {
    if (abortRef.current || savingRef.current) return 0;
    // 손본 것을 말없이 덮지 않는다 — 고쳐 둔 답과 만들어 둔 모범답안이 사라지는 자리다
    if (items.length > 0 && !window.confirm(
      `이미 문항 ${items.length}개로 나눠 두었어요.\n`
      + '다시 나누면 손으로 고친 답과 만들어 둔 모범답안이 모두 사라집니다. 계속할까요?',
    )) return 0;

    const controller = new AbortController();
    abortRef.current = controller;
    setPhase('split');
    try {
      // 킬스위치 재확인 — 탭을 열어 둔 사이에 기능을 껐을 수 있다(fail-closed)
      const allowed = await featureAllowed(controller.signal);
      if (controller.signal.aborted) return 0;
      if (!allowed) {
        toast.error(aiErrorMessage('feature_disabled'));
        return 0;
      }

      // 나누기는 **옮겨 적는 일**이라 프린트 읽기와 같은 모델·노력을 쓴다 — 낮은 노력으로
      // 돌리면 물음을 다듬어 적어 원문 대조가 줄줄이 실패한다
      const port = getCodexPort();
      const pref = await resolveOcrPrefFromBridge(port, getCodexModelPref(), {
        models: PRINT_OCR_MODEL_PREFERENCE,
        efforts: PRINT_OCR_EFFORT_PREFERENCE,
      });
      if (controller.signal.aborted) return 0;

      const result = await runPrintQaSplit({
        html: bundle.ocr_html,
        bundle: { name: bundle.name, school_name: bundle.school_name, grade: bundle.grade },
        includeHandwriting: bundle.include_handwriting,
        seed: Date.now().toString(36),
        port,
        pref,
        signal: controller.signal,
      });
      if (controller.signal.aborted) return 0;

      const warnings = splitWarnings(result).slice(0, PRINT_QA_MAX_WARNINGS);
      const nextMeta: PrintQaMeta = {
        status: 'done',
        sourceHash: hash,
        work: result.work,
        model: pref.model,
        effort: pref.effort,
        warnings,
        // 다시 나누면 앞서 쓴 참고자료 이름은 **버린다** — 그 답들이 함께 사라지므로
        // 남겨 두면 인쇄물이 쓰지도 않은 자료 이름을 찍는다
        ranAt: new Date().toISOString(),
      };
      await persist(result.items, nextMeta);
      setItems(result.items);
      setMeta(nextMeta);
      selection.reset(result.items);
      setDirty(false);

      const notice = splitNotice(result);
      toast[notice.level](notice.text);
      warnings.forEach((w) => toast.warning(w));
      return result.items.length;
    } catch (e) {
      if (controller.signal.aborted) return 0;
      reportQaError(e, '문답으로 나누지 못했어요.');
      return 0;
    } finally {
      abortRef.current = null;
      setPhase(null);
    }
  }, [bundle, hash, items.length, persist, selection]);

  /**
   * 골라 둔 문항에 모범답안을 만든다 (AI 한 턴).
   * @param references - 함께 읽을 참고자료 (이름·본문)
   * @returns 만든 답의 수. 못 했으면 0
   */
  const generateAnswers = useCallback(async (
    references: readonly QuizReferenceText[],
  ): Promise<number> => {
    if (abortRef.current || savingRef.current) return 0;
    const { targets, byNo } = planAnswerTargets(items, selection.picked);
    if (targets.length === 0) {
      toast.warning('모범답안을 만들 문항을 골라 주세요.');
      return 0;
    }
    if (targets.length > PRINT_QA_ANSWER_MAX_TARGETS) {
      toast.warning(`한 번에 ${PRINT_QA_ANSWER_MAX_TARGETS}개까지 만들 수 있어요.`);
      return 0;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    setPhase('answers');
    try {
      const allowed = await featureAllowed(controller.signal);
      if (controller.signal.aborted) return 0;
      if (!allowed) {
        toast.error(aiErrorMessage('feature_disabled'));
        return 0;
      }

      // 모범답안은 **글을 짓는 일**이라 선생님이 고른 모델을 그대로 쓴다(옮겨 적기가 아니다).
      // 프린트 읽기 정책을 여기까지 밀면 싼 단계가 비싸진다 — `run-env.ts` 와 같은 판단이다
      const result = await runPrintQaAnswers({
        plain,
        targets,
        work: meta.work,
        references,
        // 학생이 연필로 적은 답이 'AI 가 프린트에서 찾은 근거' 로 둔갑하지 않게 한다
        handwritten: source.ranges,
        port: getCodexPort(),
        pref: getCodexModelPref(),
        signal: controller.signal,
      });
      if (controller.signal.aborted) return 0;

      const nextItems = applyGeneratedAnswers(items, byNo, result.answers);
      const nextMeta: PrintQaMeta = {
        ...meta,
        // ⚠️ 그때 쓴 자료 이름을 **굳혀 둔다** — 뒤에 자료를 빼고 더할 수 있어서, 인쇄가 지금
        //    목록을 보면 "쓰지도 않은 자료 이름 + 옛 자료로 만든 답" 이 한 장에 찍힌다.
        // ⚠️ 갈아 끼우지 않고 **더한다**(코덱스 리뷰). 몇 문항만 다시 만들면 앞서 만든 답은
        //    그대로 남는데 목록만 새것으로 바뀌어, 답지 머리글이 그 답들의 출처를 빠뜨린다
        references: [...new Set([
          ...(meta.references ?? []),
          ...references.map((ref) => ref.label),
        ])],
        answeredAt: new Date().toISOString(),
      };
      await persist(nextItems, nextMeta);
      setItems(nextItems);
      setMeta(nextMeta);
      setDirty(false);

      const notice = answersNotice(result, targets.length);
      toast[notice.level](notice.text);
      // ⚠️ 답이 생기고 나서야 '물음 안에 답이 보인다' 는 것을 알 수 있다(코덱스 23R)
      answersWarnings(answersLeftInQuestions(nextItems)).forEach((w) => toast.warning(w));
      return result.answers.length;
    } catch (e) {
      if (controller.signal.aborted) return 0;
      reportQaError(e, '모범답안을 만들지 못했어요.');
      return 0;
    } finally {
      abortRef.current = null;
      setPhase(null);
    }
  }, [items, meta, persist, plain, selection.picked, source.ranges]);

  /** 물음을 손으로 고친다 */
  const updateQuestion = useCallback((id: string, question: string) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, question } : item)));
    setDirty(true);
  }, []);

  /**
   * 앞글을 **학생 문제지에도 실을지** 정한다.
   *
   * ⚠️ 기계가 정하지 않는다(코덱스 10R) — 문항 앞의 글이 지문인지 아직 안 옮긴 답인지는
   *    글자로 가릴 수 없다. 교사용에는 늘 보이니, 보고 누르면 된다.
   */
  const approveLead = useCallback((id: string, approved: boolean) => {
    setItems((prev) => prev.map(
      (item) => (item.id === id ? { ...item, leadApproved: approved } : item),
    ));
    setDirty(true);
  }, []);

  /** 답을 손으로 고친다 — 고친 답은 `teacher` 가 된다(`editAnswer`) */
  const updateAnswer = useCallback((id: string, answer: string) => {
    setItems((prev) => prev.map((item) => (item.id === id ? editAnswer(item, answer) : item)));
    setDirty(true);
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems((prev) => removeQaItem(prev, id));
    selection.drop(id);
    setDirty(true);
  }, [selection]);

  /** 기본 대상(답 없음·학생 손글씨)으로 되돌린다 */
  const pickDefault = useCallback(() => selection.reset(items), [items, selection]);

  /** 손으로 고친 것을 저장한다 */
  const save = useCallback(async () => {
    // AI 가 도는 중에는 저장하지 않는다 — 끝나면 그쪽이 저장하고, 여기서 끼어들면 서로 덮는다
    if (savingRef.current || abortRef.current) return;
    savingRef.current = true;
    setSaving(true);
    try {
      await persist(items, meta);
      setDirty(false);
      toast.success('저장했어요.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '저장하지 못했어요.');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }, [items, meta, persist]);

  return {
    items, meta, phase, dirty, saving, plain, stale,
    picked: selection.picked,
    running: phase !== null,
    split, generateAnswers, pick: selection.pick, pickDefault, pickNone: selection.clear,
    approveLead, updateQuestion, updateAnswer, removeItem, save, cancel,
  };
}
