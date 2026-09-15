'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { truncateReferencePlain, uniqueReferenceLabels } from '@/lib/passage-quiz/reference';
import type { QuizReferenceText } from '@/lib/passage-quiz/reference';
import { loadReferencePlain } from '@/lib/quiz-references/bodies';
import { fetchReferenceCandidates } from '@/lib/quiz-references/candidates';
import {
  QUIZ_REFERENCE_MAX_AUTO, QUIZ_REFERENCE_MAX_TOTAL,
} from '@/lib/quiz-references/constants';
import { rankReferenceCandidates } from '@/lib/quiz-references/match';
import { hasMatchSignals, signalsKey } from '@/lib/quiz-references/signals';
import type {
  AttachedReference, QuizMatchSignals, ReferenceCandidate,
} from '@/lib/quiz-references/types';

/**
 * 문제 만들기에 붙는 **참고자료**의 상태.
 *
 * 규칙 셋이 이 훅의 전부다:
 *  ① 자동으로 붙이되 **왜 붙었는지 함께 보여 준다**(`reason`).
 *  ② 사람이 뺀 것은 **다시 안 붙는다**(`dismissedRef`) — 뺐는데 다시 찾기로 되살아나면
 *     선생님은 같은 자료를 몇 번이고 다시 뺀다.
 *  ③ 직접 고른 것은 자동보다 **세다** — 다시 찾기가 자동만 갈아 끼우고 손댄 것은 놔둔다.
 *
 * ⚠️ setState 는 핸들러와 `.then` 안에서만 한다(`set-state-in-effect` 가 막는다).
 */

/** 직접 고른 자료의 까닭 — 자동인지 사람인지 화면이 이것으로도 가린다 */
const MANUAL_REASON = '직접 고름';

export function useQuizReferences() {
  const [attached, setAttached] = useState<AttachedReference[]>([]);
  const [suggesting, setSuggesting] = useState(false);
  /**
   * 지금 붙어 있는 것의 거울.
   *
   * ⚠️ state 만으로는 모자라다 — `suggest` 는 조회를 기다리는 동안 붙은 목록이 바뀔 수 있고
   *    (사람이 그 사이 하나를 뺀다), 닫아 둔 옛 값으로 덮으면 뺀 자료가 되살아난다.
   *    `setAttached` 안에서 딴 일(토스트·본문 읽기)을 하지 않으려고 두는 것이기도 하다 —
   *    갱신 함수는 StrictMode 에서 두 번 돈다.
   */
  const attachedRef = useRef<AttachedReference[]>([]);
  /** 사람이 뺀 자료 — 이 화면에 있는 동안 다시 붙이지 않는다 */
  const dismissedRef = useRef<Set<string>>(new Set());
  /** 마지막으로 찾아본 신호 — 같은 신호로 두 번 찾지 않는다(제목 칸을 나갔다 들어와도) */
  const lastKeyRef = useRef('');
  /** 화면이 아직 떠 있는가. ⚠️ 효과 **본문에서 true 로 되돌린다**(StrictMode) */
  const aliveRef = useRef(true);
  /** 몇 번째 찾기인가 — 늦게 온 옛 응답이 새 결과를 덮으면 안 된다 */
  const queryIdRef = useRef(0);
  /**
   * 자료마다 **지금 도는 본문 요청 번호**.
   *
   * ⚠️ 찾기의 세대 번호(`queryIdRef`)로는 모자라다(코덱스 리뷰). 본문 읽기는 자료를 더할
   *    때마다 따로 도는데, 키만 보고 처리하면 이런 일이 난다: A 를 붙여 요청이 돌던 중
   *    A 를 뺐다가 다시 붙이면(새 요청) **옛 요청의 실패가 멀쩡히 붙어 있는 A 를 지운다.**
   *    번호가 아직 내 것일 때만 반영한다.
   *
   * ⚠️ **이 표에 있다 = 지금 붙어 있는 자료의 요청이 돌고 있다** — 이 뜻이 깨지면 안 된다.
   *    끝난 자료를 지우는 것만으로는 모자라고(코덱스 정지 리뷰), **목록에서 빠진 자료도
   *    같이 지워야 한다**: 안 지우면 뺐다가 다시 붙인 자료가 "이미 요청이 돈다" 로 걸려
   *    **새 요청이 아예 안 나가고**, 그 자리에 옛 요청의 실패가 도착해 멀쩡한 자료를 지운다
   *    (본문이 영영 안 채워져 만들기가 잠기는 길이기도 하다). 그래서 `apply` 가 함께 추린다.
   */
  const bodyReqRef = useRef<Map<string, number>>(new Map());
  const bodySeqRef = useRef(0);

  useEffect(() => {
    aliveRef.current = true;
    return () => { aliveRef.current = false; };
  }, []);

  /**
   * 붙은 목록을 바꾸는 **유일한 길** — 거울과 state 를 함께 옮기고,
   * 목록에서 빠진 자료의 **도는 요청 표시도 함께 지운다**(위 `bodyReqRef` 주석 참고).
   * @param next - 새 목록
   */
  const apply = useCallback((next: AttachedReference[]) => {
    const keys = new Set(next.map((ref) => ref.key));
    for (const key of [...bodyReqRef.current.keys()]) {
      if (!keys.has(key)) bodyReqRef.current.delete(key);
    }
    attachedRef.current = next;
    setAttached(next);
  }, []);

  /**
   * 붙인 자료의 본문을 읽어 채운다.
   *
   * 못 읽은 자료는 **목록에서 뺀다** — 본문 없이 남겨 두면 '불러오는 중' 이 영영 끝나지 않아
   * 만들기 버튼이 잠긴 채로 남는다.
   */
  const loadBodies = useCallback((refs: AttachedReference[]) => {
    // 이미 요청이 돌고 있는 자료는 다시 묻지 않는다 — 한 자료를 두 번 읽을 이유가 없다
    const pending = refs.filter((ref) => !bodyReqRef.current.has(ref.key));
    if (pending.length === 0) return;

    bodySeqRef.current += 1;
    const seq = bodySeqRef.current;
    for (const ref of pending) bodyReqRef.current.set(ref.key, seq);
    const keys = pending.map((ref) => ref.key);
    /** 이 응답이 아직 내 것인 자료만 — 그 사이 빼고 다시 붙인 자료는 남의 것이다 */
    const stillMine = () => {
      const mine = new Set(keys.filter((key) => bodyReqRef.current.get(key) === seq));
      for (const key of mine) bodyReqRef.current.delete(key);
      return mine;
    };

    loadReferencePlain(pending)
      .then((bodies) => {
        if (!aliveRef.current) return;
        const mine = stillMine();
        if (mine.size === 0) return;
        apply(attachedRef.current.flatMap((ref) => {
          if (!mine.has(ref.key)) return [ref];
          const plain = bodies.get(ref.key);
          // 본문을 못 찾은 자료는 **뺀다** — 남겨 두면 '불러오는 중' 이 영영 끝나지 않아
          // 만들기 버튼이 잠긴 채로 남는다
          if (plain === undefined) return [];
          return [{ ...ref, ...truncateReferencePlain(plain) }];
        }));
        if ([...mine].some((key) => !bodies.has(key))) {
          toast.warning('참고자료 일부를 불러오지 못했어요.');
        }
      })
      .catch(() => {
        if (!aliveRef.current) return;
        const mine = stillMine();
        if (mine.size === 0) return;
        apply(attachedRef.current.filter((ref) => !mine.has(ref.key)));
        toast.error('참고자료 본문을 불러오지 못했어요.');
      });
  }, [apply]);

  /**
   * 자동으로 붙은 자료를 걷어내고, 돌고 있던 찾기를 무효로 만든다(직접 고른 것은 남긴다).
   *
   * 앞 지문을 보고 붙인 자료가 **다른 지문**의 문항 근거로 실리는 것을 막는 자리다.
   * 늦게 도착할 찾기 결과까지 함께 끊어야 한다 — 안 그러면 걷어낸 자리에 그 결과가 다시 붙는다.
   */
  const dropAuto = useCallback(() => {
    queryIdRef.current += 1;
    lastKeyRef.current = '';
    setSuggesting(false);
    const manual = attachedRef.current.filter((ref) => !ref.auto);
    if (manual.length !== attachedRef.current.length) apply(manual);
  }, [apply]);

  /**
   * 신호에 맞는 자료를 찾아 **자동 자리만** 갈아 끼운다.
   * @param signals - 찾기 신호
   * @param options - `force` 면 같은 신호여도 다시 찾는다(지문을 새로 골랐을 때)
   */
  const suggest = useCallback(async (
    signals: QuizMatchSignals,
    options: { force?: boolean } = {},
  ) => {
    // ⚠️ **찾을 신호가 사라지면 자동 자료를 걷어낸다**(코덱스 리뷰 2R). 그냥 돌아가면 앞 지문에
    //    붙여 둔 자료가 **제목 없는 다른 지문**에 그대로 남아 그 문항의 근거로 실린다.
    //    돌고 있던 찾기도 함께 무효로 만든다 — 늦게 온 결과가 새 지문에 옛 자료를 붙인다.
    //    직접 고른 것은 남긴다(사람이 그 지문을 보고 고른 것일 수 있다).
    if (!hasMatchSignals(signals)) {
      dropAuto();
      return;
    }
    const key = signalsKey(signals);
    if (!options.force && key === lastKeyRef.current) return;
    lastKeyRef.current = key;

    queryIdRef.current += 1;
    const queryId = queryIdRef.current;
    setSuggesting(true);
    try {
      const { hits, failures } = await fetchReferenceCandidates(signals);
      if (!aliveRef.current || queryId !== queryIdRef.current) return;

      const current = attachedRef.current;
      // 직접 고른 것은 **그대로 둔다** — 다시 찾기는 자동 자리만 갈아 끼운다
      const manual = current.filter((ref) => !ref.auto);
      const ranked = rankReferenceCandidates(hits, {
        dismissed: dismissedRef.current,
        attached: new Set(manual.map((ref) => ref.key)),
        limit: Math.min(QUIZ_REFERENCE_MAX_AUTO, QUIZ_REFERENCE_MAX_TOTAL - manual.length),
      });
      // 이미 붙어 있던 자동 자료는 **본문만** 물려받는다 — 다시 읽으면 왕복만 는다.
      // ⚠️ 까닭·이름은 **새것으로 간다**(코덱스 리뷰). 객체를 통째로 재사용하면 작품명을
      //    바꿔 다시 찾아도 화면에 옛 까닭("제목에 '봄봄'")이 그대로 남아 거짓말을 한다
      const kept = new Map(current.map((ref) => [ref.key, ref]));
      const next = uniqueReferenceLabels([
        ...manual,
        ...ranked.map((row): AttachedReference => {
          const before = kept.get(row.key);
          return {
            key: row.key,
            kind: row.kind,
            id: row.id,
            label: row.label,
            subtitle: row.subtitle,
            updatedAt: row.updatedAt,
            reason: row.reason,
            auto: true,
            plain: before?.plain ?? null,
            truncated: before?.truncated ?? false,
          };
        }),
      ]);
      apply(next);
      loadBodies(next.filter((ref) => ref.plain === null));
      if (failures > 0) toast.warning('참고자료를 찾는 중 일부 조회가 실패했어요.');
    } catch {
      if (aliveRef.current) toast.error('참고자료를 찾지 못했어요.');
    } finally {
      if (aliveRef.current && queryId === queryIdRef.current) setSuggesting(false);
    }
  }, [apply, dropAuto, loadBodies]);

  /** 직접 고른 자료를 붙인다 */
  const add = useCallback((candidate: ReferenceCandidate) => {
    const current = attachedRef.current;
    if (current.some((ref) => ref.key === candidate.key)) return;
    if (current.length >= QUIZ_REFERENCE_MAX_TOTAL) {
      toast.warning(`참고자료는 ${QUIZ_REFERENCE_MAX_TOTAL}개까지 붙일 수 있어요.`);
      return;
    }
    dismissedRef.current.delete(candidate.key);
    const next = uniqueReferenceLabels([
      ...current,
      { ...candidate, reason: MANUAL_REASON, auto: false, plain: null, truncated: false },
    ]);
    apply(next);
    loadBodies(next.filter((ref) => ref.plain === null));
  }, [apply, loadBodies]);

  /** 자료를 뺀다 — 뺀 것은 다시 찾기로 되살아나지 않는다 */
  const remove = useCallback((key: string) => {
    dismissedRef.current.add(key);
    apply(attachedRef.current.filter((ref) => ref.key !== key));
  }, [apply]);

  /** 전부 비우고 뺀 기록도 지운다 — '처음부터 다시' */
  const clear = useCallback(() => {
    dismissedRef.current.clear();
    lastKeyRef.current = '';
    apply([]);
  }, [apply]);

  /** 프롬프트·파서에 넘길 목록 — 본문을 받은 것만 */
  const promptReferences = useMemo<QuizReferenceText[]>(
    () => attached
      .filter((ref): ref is AttachedReference & { plain: string } => ref.plain !== null)
      .map((ref) => ({ label: ref.label, plain: ref.plain })),
    [attached],
  );

  const referenceChars = promptReferences.reduce((sum, ref) => sum + ref.plain.length, 0);

  return {
    attached,
    suggesting,
    /** 아직 본문을 못 받은 자료가 있는가 */
    loading: attached.some((ref) => ref.plain === null),
    referenceChars,
    hasRoom: attached.length < QUIZ_REFERENCE_MAX_TOTAL,
    attachedKeys: useMemo(() => new Set(attached.map((ref) => ref.key)), [attached]),
    promptReferences,
    suggest,
    dropAuto,
    add,
    remove,
    clear,
  };
}
