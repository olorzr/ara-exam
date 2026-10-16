'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { aiErrorMessage } from '@/lib/ai/errors';
import { isAiError } from '@/lib/ai/types';
import { getCodexModelPref } from '@/lib/ai/localModelPref';
import { getCodexPort } from '@/lib/ai/localPort';
import { signProblemFile } from '@/lib/problem-bank/storage';
import { readPassageContinuation } from '@/lib/problem-ocr/continue-passage';
import type { OcrSourceMeta } from '@/lib/problem-ocr/prompt';
import type { ProblemSource } from '@/types/problem-bank';
import { ocrStillEnabled } from '@/lib/ai/still-enabled';

/**
 * 검수 화면에서 지문의 **뒷부분만** 다음 쪽에서 다시 읽어 오는 훅.
 *
 * 이미 아카이브에 들어간 지문이 잘려 있을 때, 시험지를 통째로 다시 읽지 않고
 * 그 쪽 한 장만 보낸다(ChatGPT 1회).
 *
 * ⚠️ 읽어 온 글을 **저장하지 않는다.** 편집기에 이어 붙여 보여 주고 저장은 사람이 누른다.
 *
 * `usePassageQuiz`·`usePrintQa` 와 같은 규약(2026-10-15 리뷰 8번):
 * - 잠금은 **첫 await 앞**에서 건다. 예전에는 킬스위치 확인과 PDF 서명을 기다린 **뒤에야** 잠가서
 *   그 두 왕복 동안 다시 누르면 둘 다 통과해 AI 가 두 번 돌고, 같은 글이 본문 뒤에 두 번 붙었다.
 * - 준비·실행·정리를 **한 try/finally** 안에서 하고, 정리는 **제 실행일 때만** 손잡이를 지운다
 *   (늦게 끝난 옛 실행의 `finally` 가 새 실행의 잠금·취소 손잡이를 지우면 안 된다).
 * - 화면을 떠나거나 출처가 바뀌면 끊는다. 끊긴 실행은 성공 알림도 결과도 내지 않는다.
 */

/** 출처 행에서 프롬프트에 실을 메타만 추린다 */
function toOcrMeta(source: ProblemSource): OcrSourceMeta {
  return {
    source_type: source.source_type,
    title: source.title,
    school_name: source.school_name,
    year: source.year,
    grade: source.grade,
    semester: source.semester,
    exam_type: source.exam_type,
    publisher: source.publisher,
    textbook: source.textbook,
  };
}

export interface ContinuationRead {
  html: string;
  continues: boolean;
  hasFigure: boolean;
  warnings: string[];
}

export function usePassageContinuation(source: ProblemSource | null) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  /**
   * 도는 읽기를 끊고 **잠금까지 그 자리에서 푼다.**
   *
   * ⚠️ 끊기만 하고 잠금을 `finally` 에 맡기면, 기다리던 왕복(킬스위치·서명)이 멎었을 때 잠금이 영영
   *    안 풀린다(`usePaperBulkAdd` 의 holdRef 와 같은 판단). 끊긴 실행은 각 await 뒤에 신호를 보고
   *    아무것도 내지 않으며, 그 `finally` 는 제 손잡이가 아니므로 새 실행을 건드리지 않는다.
   */
  const cancel = useCallback(() => {
    const running = abortRef.current;
    if (!running) return;
    running.abort();
    abortRef.current = null;
    setBusyId(null);
  }, []);

  // 화면이 사라지면 진행 중인 읽기를 끊는다 — 느슨한 정리는 늦게 돌아 이미 끝난 결과가 슬쩍
  // 통과할 수 있어 layout effect 다(usePassageQuiz·usePrintScanOcr 과 같은 이유)
  useLayoutEffect(() => () => {
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);
  // 다른 출처로 바뀌면 옛 출처의 PDF 로 읽던 것을 끊는다 — 그 결과는 지금 화면의 지문 것이 아니다
  const sourceId = source?.id ?? null;
  useEffect(() => () => cancel(), [sourceId, cancel]);

  /**
   * 한 쪽을 다시 읽어 이어지는 본문을 가져온다.
   * @param passageId - 어느 지문의 뒤를 잇는가 (진행 표시에만 쓴다)
   * @param page - 읽을 쪽
   * @param soFarHtml - 지금까지의 본문 — 끝부분을 단서로 보낸다
   * @returns 읽어 온 본문. 실패하면 null
   */
  const read = useCallback(async (
    passageId: string,
    page: number,
    soFarHtml: string,
  ): Promise<ContinuationRead | null> => {
    if (!source || abortRef.current) return null;
    if (!source.file_path) {
      toast.error('원본 PDF 가 없어요. 업로드가 실패한 출처예요.');
      return null;
    }

    // ⚠️ 잠금은 **첫 await 앞**에서 건다 — 위 머리 주석
    const controller = new AbortController();
    const { signal } = controller;
    abortRef.current = controller;
    setBusyId(passageId);
    try {
      // 킬스위치는 시작 직전에 다시 본다 — 탭을 열어 둔 사이 껐을 수 있다(fail-closed).
      // 이 왕복에도 취소 신호를 싣는다 — 멈추면 잠금이 풀리지 않는다
      const allowed = await ocrStillEnabled('problem_ocr', signal);
      if (signal.aborted) return null;
      if (!allowed) {
        toast.error(aiErrorMessage('feature_disabled'));
        return null;
      }

      const url = await signProblemFile(source.file_path);
      if (signal.aborted) return null;
      if (!url) {
        toast.error('원본 PDF 를 열지 못했어요.');
        return null;
      }

      const result = await readPassageContinuation({
        file: { kind: 'url', url },
        meta: toOcrMeta(source),
        page,
        soFarHtml,
        port: getCodexPort(),
        pref: getCodexModelPref(),
        signal,
      });
      // 끊은 뒤에 결과가 도착할 수 있다 — 끊었다고 해 놓고 글이 본문에 붙으면 안 된다
      if (signal.aborted) return null;
      // ⚠️ 이 길은 그림을 잘라 내지 못한다 — 있으면 사람이 직접 넣어야 한다.
      //    **글이 없어도** 알린다: 이어지는 부분이 도표 하나뿐인 지문이 실제로 있는데,
      //    그때 "이어지는 글이 안 보여요" 로만 끝내면 그림이 있는 줄도 모른다
      if (result.hasFigure) {
        toast.warning(`${page}쪽 이어지는 부분에 그림이 있어요. '그림 추가' 로 직접 잘라 넣어 주세요.`);
      }
      if (!result.html) {
        // 못 찾은 것도 결과다 — 모델이 남긴 까닭까지 그대로 보여 준다
        if (!result.hasFigure) {
          toast.info(result.warnings[0] ?? `${page}쪽 머리에 이어지는 글이 안 보여요.`);
        }
        return result;
      }
      toast.success(`${page}쪽에서 이어지는 글을 읽었어요. 확인하고 저장해 주세요.`);
      // ⚠️ 글을 읽었어도 **남긴 말은 반드시 보여 준다.** 잘렸다거나 흐려서 못 읽었다는
      //    말이 여기 담기는데, 성공 문구만 띄우면 그대로 저장하고 넘어간다
      for (const warning of result.warnings) toast.warning(warning);
      return result;
    } catch (e) {
      // 끊은 것은 사람이 한 일이다 — 코드가 'cancelled' 가 아닐 때도 있다(브릿지 연결 중에 끊으면 연결 실패로 온다)
      if (signal.aborted) return null;
      if (isAiError(e)) {
        if (e.code !== 'cancelled') toast.error(aiErrorMessage(e.code));
      } else {
        toast.error(e instanceof Error ? e.message : '읽지 못했어요.');
      }
      return null;
    } finally {
      // ⚠️ **제 실행일 때만** 손잡이를 지운다 — 끊긴 옛 실행이 늦게 끝나며 새 실행의 잠금을 풀면
      //    두 번째 클릭이 또 통과한다
      if (abortRef.current === controller) {
        abortRef.current = null;
        setBusyId(null);
      }
    }
  }, [source]);

  return { busyId, read, cancel };
}
