'use client';

import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { aiErrorMessage } from '@/lib/ai/errors';
import { getCodexModelPref } from '@/lib/ai/localModelPref';
import { getCodexPort } from '@/lib/ai/localPort';
import { isAiError } from '@/lib/ai/types';
import { bundleWordsCategory } from '@/lib/print-scan/bundle-plan';
import { updateBundle } from '@/lib/print-scan/save';
import { registerBundleWords, registeredWordCount } from '@/lib/print-words';
import type { PrintBundle } from '@/types/print-scan';
import { ocrStillEnabled } from './useProblemOcr';

/**
 * 목록의 '단어 등록' — 읽어 둔 원문(`ocr_html`)으로 단어만 따로 등록한다.
 *
 * 업로드 때 체크를 안 켠 프린트와 이 기능이 생기기 전에 올린 프린트를 되살리는 **유일한 길**이다.
 * `useConceptPick` 과 같은 규약: 취소 가능, 언마운트 때 끊기, 킬스위치 재확인(fail-closed).
 *
 * 기능 플래그는 `print_ocr` 을 **그대로 쓴다** — 새 `AiFeature` 를 더하면 다섯 곳을 함께
 * 고쳐야 하는데(types·flags·status 라우트·useAiEnabled·ocrStillEnabled), 이것은 프린트 읽기의
 * 일부이지 다른 기능이 아니다.
 */
export function usePrintWordsRegister() {
  const [running, setRunning] = useState(false);
  /** 지금 등록 중인 프린트 이름 — 화면이 '무엇을' 하고 있는지 말할 수 있어야 한다 */
  const [runningName, setRunningName] = useState('');
  const abortRef = useRef<AbortController | null>(null);

  // 느슨한 정리는 늦게 실행돼 이미 끝난 생성이 슬쩍 통과할 수 있다(useProblemOcr 과 같은 이유)
  useLayoutEffect(() => () => abortRef.current?.abort(), []);

  const cancel = useCallback(() => abortRef.current?.abort(), []);

  const run = useCallback(async (bundle: PrintBundle): Promise<boolean> => {
    if (abortRef.current) return false;
    if (!bundle.ocr_html) {
      toast.error('읽어 둔 내용이 없어요. 먼저 읽기를 해 주세요.');
      return false;
    }
    // 이미 한 번 등록한 프린트는 **묻고 시작한다** — 누를 때마다 ChatGPT 를 한 번 더 쓴다
    if (bundle.words_meta?.status === 'done' && !window.confirm(
      `"${bundle.name}" 은(는) 이미 단어를 등록했어요.\n`
      + 'ChatGPT 를 한 번 더 써서 다시 등록할까요? (이미 있는 단어는 그대로 둡니다)',
    )) return false;

    // ⚠️ 잠금은 **첫 await 앞**에서 건다. 킬스위치를 먼저 물으면 그 왕복 동안
    //    `abortRef` 도 `running` 도 비어 있어, 두 번 누르면 생성이 둘 돌고
    //    그 사이에 시작한 프린트 읽기도 화면의 busy 잠금을 그냥 지나간다(코덱스 리뷰 P2).
    const controller = new AbortController();
    abortRef.current = controller;
    setRunning(true);
    setRunningName(bundle.name);
    try {
      // 킬스위치 재확인 — 탭을 열어 둔 사이에 기능을 껐을 수 있다(fail-closed)
      if (!(await ocrStillEnabled('print_ocr'))) {
        toast.error(aiErrorMessage('feature_disabled'));
        return false;
      }

      const { meta } = await registerBundleWords({
        bundle,
        html: bundle.ocr_html,
        category: bundleWordsCategory(bundle),
        previous: bundle.words_meta,
        persist: (next) => updateBundle(bundle.id, { words_meta: next }),
        port: getCodexPort(),
        pref: getCodexModelPref(),
        signal: controller.signal,
        onWarnings: (list) => list.forEach((w) => toast.warning(w)),
      });

      // 넷을 뭉뚱그리지 않는다 — '못 했다'·'찾은 게 없다'·'이미 다 있다' 는 다음에 할 일이 다르다
      if (meta.status === 'failed') {
        // 취소는 사람이 한 일이라 오류로 알리지 않는다(영수증에는 그대로 남는다)
        if (!controller.signal.aborted) toast.error('단어를 등록하지 못했어요.');
      } else if (meta.status === 'empty') {
        toast.warning('프린트에서 뜻이 적힌 단어를 찾지 못했어요.');
      } else if (!meta.registered) {
        // 다시 등록한 경우다. "0개 등록" 이라고 하면 실패처럼 들린다
        toast.success(`이미 등록돼 있어요 — 단어 ${registeredWordCount(meta)}개 그대로예요.`);
      } else {
        const skipped = meta.skipped ? ` (이미 있던 ${meta.skipped}개는 건너뜀)` : '';
        toast.success(`단어 ${meta.registered}개를 등록했어요${skipped}.`);
      }
      return meta.status === 'done';
    } catch (e) {
      // registerBundleWords 는 던지지 않지만, 카테고리 조립처럼 그 앞에서 날 수 있다
      if (isAiError(e)) {
        if (e.code !== 'cancelled') toast.error(aiErrorMessage(e.code));
      } else {
        toast.error(e instanceof Error ? e.message : '단어를 등록하지 못했어요.');
      }
      return false;
    } finally {
      abortRef.current = null;
      setRunning(false);
      setRunningName('');
    }
  }, []);

  return { running, runningName, run, cancel };
}
