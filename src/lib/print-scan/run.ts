'use client';

import { AiError } from '@/lib/ai/types';
import { registerBundleWords } from '@/lib/print-words/register';
import { probePageOrientation } from '@/lib/page-orientation';
import type { OpenPdf } from '@/lib/pdf/pdfPages';
import type { PrintBundle } from '@/types/print-scan';
import { bundleWordsCategory } from './bundle-plan';
import { readBundle } from './read-bundle';
import type { PrintRunEnv } from './run-env';
import { createSheetForBundle, ensureSchoolMaterial, updateBundle } from './save';

/**
 * 묶음(= 프린트 한 장) 하나를 읽어 시험지로 만든다 (브라우저 전용).
 *
 * 기출 OCR(`problem-ocr/run.ts`)의 축소판이다 — 같은 묶음 실행기(`runOcrBatches`)를 쓰고
 * 실패를 다루는 규칙도 같다. 다른 점 셋:
 *   ① 결과가 지문·문항이 아니라 **평문 HTML** 이라 병합이 없다(그래서 겹쳐 읽지 않는다).
 *   ② 정답표·크롭이 없다.
 *   ③ 저장 대상이 새 표가 아니라 **개념지** 다.
 *
 * 읽기 자체는 [read-bundle.ts](./read-bundle.ts) 가 맡는다 — 이 파일은 **상태 전이**다.
 */

// 환경 타입은 `run-env.ts` 가 단일 출처다. ⚠️ 여기서 다시 선언하면 `read-bundle` 이
// 이 파일을 값으로 import 하게 되어 순환이 된다(import-cycles 테스트가 잡는다)
export type { PrintRunEnv, PrintRunProgress } from './run-env';

/** 묶음 하나를 끝까지 처리한 결과 */
export interface PrintBundleRunResult {
  /** 만들어진(또는 이미 있던) 시험지 id */
  sheetId: string;
  /** 이 묶음에서 등록된 단어 수 (안 켰거나 못 했으면 0) */
  wordsRegistered: number;
  /**
   * 단어 단계가 **다음 묶음도 같은 이유로 죽을** 오류로 끝났는가(취소·한도·권한).
   * 호출자가 이어 읽기를 멈추는 데 쓴다. 이 값이 있어도 이 묶음의 시험지는 멀쩡하다.
   */
  wordsFatal: AiError | null;
}

/**
 * 묶음 하나를 읽어 **시험지까지 만든다**. 상태 전이를 책임진다.
 *
 * ⚠️ 어떤 길로 빠져나가도 **'읽는중' 으로 남기지 않는다.** 업로드가 그 상태로 만들어 두고
 *    성공 경로만 상태를 바꾸면, 실패·취소한 묶음이 **영영 돌고 있는 것처럼** 보인다
 *    (기출에서 실제로 겪은 결함이다). 다만 탭이 닫히면 이 `catch` 가 아예 못 돌아서
 *    행이 '읽는중' 으로 남는다 — 그쪽 복구는 [reading-state.ts](./reading-state.ts) 가 맡는다.
 * ⚠️ **일부만 읽힌 것을 성공으로 알리지 않는다.** 배치가 몇 개 실패하거나 본문이 잘려도
 *    살아남은 쪽으로 시험지가 만들어지므로, `onWarnings` 로 그 사실을 함께 올린다.
 *
 * @param bundle - 묶음
 * @param doc - 열어 둔 PDF
 * @param env - 읽기 환경
 * @returns 시험지 id 와 단어 등록 결과
 * @throws AiError - 멈춰야 하는 오류(취소·한도·권한)일 때만 다시 던진다
 */
export async function runBundle(
  bundle: PrintBundle,
  doc: OpenPdf,
  env: PrintRunEnv,
): Promise<PrintBundleRunResult> {
  await updateBundle(bundle.id, { status: '읽는중' });
  let sheetId: string;
  let html: string;
  try {
    // 읽기 전에 종이를 바로 세운다. 스캔 전체를 한 번에 확인한 값이 있으면 그것을 쓴다.
    // ⚠️ 방향 판정은 `pref` 로 부른다(`ocrPref` 아님) — 작은 이미지로 각도만 묻는 싼 단계다
    const orientation = env.orientation ?? await probePageOrientation(doc, bundle.pages, {
      port: env.port,
      pref: env.pref,
      signal: env.signal,
      onProgress: (done, total) => env.onProgress?.({ phase: 'orient', done, total }),
    });
    const read = await readBundle(bundle, doc, env, orientation);
    html = read.html;
    const meta = read.meta;

    // 저장보다 **먼저** 알린다 — 뒤에서 저장이 실패해도 무엇이 모자랐는지는 남아야 한다
    if (meta.warnings && meta.warnings.length > 0) env.onWarnings?.(meta.warnings);

    env.onProgress?.({ phase: 'save', done: 0, total: 1 });
    sheetId = await createSheetForBundle(bundle, html);
    // 카테고리 트리에도 올려 둔다(실패해도 시험지는 멀쩡하다).
    // 못 올렸으면 **말한다** — 시험지는 멀쩡한데 트리에서만 안 보이는 것이 가장 찾기 어렵다
    await ensureSchoolMaterial(bundle, (warning) => env.onWarnings?.([warning]));

    await updateBundle(bundle.id, {
      status: '읽기완료',
      ocr_html: html,
      ocr_meta: meta,
      page_paths: bundle.page_paths,
    });
    env.onProgress?.({ phase: 'save', done: 1, total: 1 });
  } catch (e) {
    await updateBundle(bundle.id, {
      status: '실패',
      ocr_meta: {
        pages: [...bundle.pages],
        ranAt: new Date().toISOString(),
        warnings: [
          e instanceof Error && e.message
            ? `읽기가 끝나지 못했어요: ${e.message}`
            : '읽기가 끝나지 못했어요.',
          '목록에서 다시 읽기를 누르면 올려 둔 원본으로 다시 시도합니다.',
        ],
      },
    }).catch(() => {
      // 상태 정리까지 실패하면 어쩔 수 없다 — 원래 오류를 가리지 않는다
    });
    throw e;
  }

  // ⚠️ 단어 등록은 **위 try/catch 바깥**이다. 시험지는 이미 저장됐고 상태도 '읽기완료' 라,
  //    여기서 무슨 일이 나도 묶음을 '실패' 로 되돌리면 안 된다 — 멀쩡한 시험지가 실패로 보인다.
  //    (`registerBundleWords` 는 던지지 않고 영수증·경고로만 말한다.)
  const words = bundle.register_words
    ? await registerWordsForBundle(bundle, html, env)
    : null;

  return {
    sheetId,
    wordsRegistered: words?.meta.registered ?? 0,
    wordsFatal: words?.fatal ?? null,
  };
}

/**
 * 이 묶음의 단어를 등록한다.
 *
 * 카테고리와 저장 함수를 **여기서 주입한다** — `print-words` 는 묶음 표를 모르고,
 * 알게 하면 `print-scan` ↔ `print-words` 순환 import 가 된다(import-cycles 테스트가 잡는다).
 *
 * ⚠️ 모델·노력은 `pref` 다(`ocrPref` 아님) — 단어 뽑기는 이미 읽어 낸 **글자만** 다루므로
 *    본문 전사만큼 꼼꼼할 이유가 없다.
 * @param bundle - 묶음
 * @param html - 읽어 낸 본문
 * @param env - 읽기 환경
 * @returns 영수증과 치명 오류
 */
async function registerWordsForBundle(
  bundle: PrintBundle,
  html: string,
  env: PrintRunEnv,
) {
  env.onProgress?.({ phase: 'words', done: 0, total: 1 });
  const result = await registerBundleWords({
    bundle,
    html,
    category: bundleWordsCategory(bundle),
    previous: bundle.words_meta,
    persist: (meta) => updateBundle(bundle.id, { words_meta: meta }),
    port: env.port,
    pref: env.pref,
    signal: env.signal,
    onWarnings: (w) => env.onWarnings?.(w),
  });
  env.onProgress?.({ phase: 'words', done: 1, total: 1 });
  return result;
}
