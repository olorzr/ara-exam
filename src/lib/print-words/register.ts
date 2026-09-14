'use client';

import { aiErrorMessage } from '@/lib/ai/errors';
import { AiError, isAiError } from '@/lib/ai/types';
import { FATAL_CODES } from '@/lib/problem-ocr/batch-run';
import { ensureCategoryId, insertWordsToCategory, type CategoryMatchInput } from '@/lib/words-save';
import type { PrintWordsMeta } from '@/types/print-scan';
import { PRINT_WORDS_MAX_WARNINGS } from './constants';
import type { PrintWordsDropped } from './parse';
import type { PrintWordsBundleMeta } from './prompt';
import { runPrintWords } from './run';
import { nextWordCount, sampleNames } from './summary';

/**
 * 프린트에서 뽑은 단어를 그 프린트의 카테고리에 등록한다 (브라우저 전용).
 *
 * ⚠️ **이 모듈은 `print-scan/` 의 어떤 파일도 값으로 import 하지 않는다.** 카테고리와
 *    저장 함수를 호출자가 주입하는 까닭이 그것이다 — `print-scan/index.ts` 가 `run.ts` 를
 *    다시 내보내므로, 여기서 `print-scan/save` 를 부르면 순환 import 가 되고
 *    (`__checks/import-cycles.test.ts` 가 잡는다) 번들러가 CommonJS 로 풀 때
 *    상수 하나가 조용히 `undefined` 가 된다(2026-09-11 프로덕션 장애와 같은 모양).
 *
 * ⚠️ **절대 던지지 않는다.** 시험지는 이미 만들어져 있고 단어는 덤이다 — 여기서 던지면
 *    `runBundle` 의 catch 가 묶음을 '실패' 로 되돌려, 멀쩡한 시험지가 실패로 보인다.
 *    대신 무슨 일이 있었는지 **반드시 영수증과 경고로 남긴다**.
 */

export interface RegisterBundleWordsInput {
  bundle: PrintWordsBundleMeta;
  /** 읽어 둔 프린트 본문 HTML */
  html: string;
  /** 단어가 들어갈 카테고리 — 시험지와 **같은 자연키**여야 한다(`bundleWordsCategory`) */
  category: CategoryMatchInput;
  /** 지금까지의 영수증 — 다시 등록할 때 **이미 올려 둔 단어 수·카테고리를 잃지 않으려고** 받는다 */
  previous?: PrintWordsMeta | null;
  /** 영수증 저장. 호출자가 넘긴다(이 모듈은 묶음 표를 모른다) */
  persist: (meta: PrintWordsMeta) => Promise<void>;
  port: number;
  pref: { model: string | null; effort: string | null };
  signal?: AbortSignal;
  /** 사람에게 보일 경고 */
  onWarnings?: (warnings: string[]) => void;
}

export interface RegisterBundleWordsResult {
  meta: PrintWordsMeta;
  /**
   * 다음 묶음도 같은 이유로 죽을 오류(취소·한도·권한). 호출자가 이어 읽기를 멈춘다.
   * 그 밖의 실패는 이 프린트만의 일이라 null 이다.
   */
  fatal: AiError | null;
}

/** 뺀 것들을 사람 말로 — 숫자만 남기면 무엇을 확인해야 할지 알 수 없다 */
function droppedWarnings(dropped: PrintWordsDropped): string[] {
  const out: string[] = [];
  if (dropped.noMeaning.length > 0) {
    out.push(
      `뜻이 적혀 있지 않아 등록하지 않은 단어 ${dropped.noMeaning.length}개: `
      + `${sampleNames(dropped.noMeaning)} (뜻은 지어내지 않아요)`,
    );
  }
  if (dropped.unverified.length > 0) {
    out.push(
      `프린트에 없는 뜻이 붙어 있어 등록하지 않은 단어 ${dropped.unverified.length}개: `
      + `${sampleNames(dropped.unverified)} (프린트에 적힌 뜻만 옮겨요)`,
    );
  }
  if (dropped.notInText > 0) {
    out.push(`프린트 본문에 없는 말 ${dropped.notInText}개는 뺐어요.`);
  }
  if (dropped.malformed > 0) {
    out.push(`모양이 이상한 항목 ${dropped.malformed}개는 뺐어요.`);
  }
  return out;
}

/**
 * 영수증을 저장하고 경고를 올린다 — 저장 실패도 삼키지 않는다.
 *
 * ⚠️ **이미 올려 둔 단어 수와 카테고리는 이번 시도의 결과로 덮지 않는다.** 다시 등록하다
 *    실패하거나 아무것도 못 찾아도 단어는 DB 에 그대로 있는데, 통째로 덮으면 칩·단어 관리
 *    링크·삭제 안내가 한 번의 실패로 사라진다(코덱스 리뷰 P2). `wordCount` 는 줄지 않는다.
 */
async function finish(
  input: RegisterBundleWordsInput,
  meta: PrintWordsMeta,
  fatal: AiError | null,
): Promise<RegisterBundleWordsResult> {
  const warnings = (meta.warnings ?? []).slice(0, PRINT_WORDS_MAX_WARNINGS);
  const previous = input.previous;
  const saved: PrintWordsMeta = {
    ...meta,
    wordCount: nextWordCount(
      previous?.wordCount ?? 0, meta.registered ?? 0, meta.skipped ?? 0,
    ),
    categoryId: meta.categoryId ?? previous?.categoryId ?? null,
    warnings,
    ranAt: new Date().toISOString(),
  };
  try {
    await input.persist(saved);
  } catch (e) {
    warnings.push(
      `단어 등록 결과를 저장하지 못했어요: ${e instanceof Error ? e.message : '알 수 없는 오류'}`,
    );
  }
  if (warnings.length > 0) input.onWarnings?.(warnings);
  return { meta: saved, fatal };
}

/**
 * 프린트 단어를 등록한다.
 * @param input - 프린트·본문·카테고리·저장 함수·연결 정보
 * @returns 영수증과, 이어 읽기를 멈춰야 하는 오류
 */
export async function registerBundleWords(
  input: RegisterBundleWordsInput,
): Promise<RegisterBundleWordsResult> {
  let result;
  try {
    result = await runPrintWords({
      html: input.html,
      bundle: input.bundle,
      port: input.port,
      pref: input.pref,
      signal: input.signal,
    });
  } catch (e) {
    const message = isAiError(e)
      ? aiErrorMessage(e.code)
      : (e instanceof Error ? e.message : '단어를 읽지 못했어요.');
    const fatal = isAiError(e) && FATAL_CODES.has(e.code) ? e : null;
    return finish(input, {
      status: 'failed',
      warnings: [`단어를 읽지 못했어요: ${message}`],
    }, fatal);
  }

  const { entries, dropped } = result;
  const warnings = droppedWarnings(dropped);

  // ⚠️ 생성이 끝난 **뒤에도** 취소를 본다. `signal` 은 생성에만 전달되므로, 사람이 취소한
  //    (또는 화면을 떠난) 뒤에도 아래 쓰기가 그대로 돌아 공유 카테고리에 단어가 들어간다
  //    (코덱스 리뷰 P2).
  if (input.signal?.aborted) {
    return finish(input, {
      status: 'failed',
      noMeaning: dropped.noMeaning.length,
      unverified: dropped.unverified.length,
      notInText: dropped.notInText,
      warnings: [...warnings, aiErrorMessage('cancelled')],
    }, new AiError('cancelled'));
  }

  // 뜻이 적힌 단어가 하나도 없으면 **카테고리를 만들지 않는다** —
  // 빈 카테고리가 단어 트리에 남아 선생님이 눌러 보고 아무것도 없는 화면을 본다
  if (entries.length === 0) {
    return finish(input, {
      status: 'empty',
      registered: 0,
      noMeaning: dropped.noMeaning.length,
      unverified: dropped.unverified.length,
      notInText: dropped.notInText,
      warnings: warnings.length > 0
        ? warnings
        : ['프린트에서 뜻이 적힌 단어를 찾지 못했어요.'],
    }, null);
  }

  // ⚠️ `ensureCategoryId` 는 어떤 오류든 null 로 돌려준다 — 조용히 넘기면
  //    "단어를 등록했다" 고 해 놓고 아무 데도 없는 상태가 된다
  const categoryId = await ensureCategoryId(input.category);
  if (!categoryId) {
    return finish(input, {
      status: 'failed',
      noMeaning: dropped.noMeaning.length,
      unverified: dropped.unverified.length,
      notInText: dropped.notInText,
      warnings: [...warnings, '단어를 넣을 카테고리를 만들지 못했어요. 잠시 뒤 다시 시도해 주세요.'],
    }, null);
  }

  // 카테고리를 만드는 왕복 동안에도 취소될 수 있다 — 쓰기 직전에 한 번 더 본다
  if (input.signal?.aborted) {
    return finish(input, {
      status: 'failed',
      categoryId,
      noMeaning: dropped.noMeaning.length,
      unverified: dropped.unverified.length,
      notInText: dropped.notInText,
      warnings: [...warnings, aiErrorMessage('cancelled')],
    }, new AiError('cancelled'));
  }

  const saved = await insertWordsToCategory(categoryId, entries);
  if (!saved.ok) {
    return finish(input, {
      status: 'failed',
      categoryId,
      noMeaning: dropped.noMeaning.length,
      unverified: dropped.unverified.length,
      notInText: dropped.notInText,
      warnings: [...warnings, `단어를 저장하지 못했어요 (${saved.errorCode ?? '알 수 없는 오류'}).`],
    }, null);
  }

  if (saved.skippedDuplicates.length > 0) {
    warnings.push(
      `이미 있던 단어 ${saved.skippedDuplicates.length}개는 건너뛰었어요: `
      + sampleNames(saved.skippedDuplicates),
    );
  }

  return finish(input, {
    status: 'done',
    registered: saved.insertedCount,
    skipped: saved.skippedDuplicates.length,
    noMeaning: dropped.noMeaning.length,
    unverified: dropped.unverified.length,
    notInText: dropped.notInText,
    categoryId,
    warnings,
  }, null);
}
