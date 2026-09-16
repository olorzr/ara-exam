'use client';

import { getCodexModelPref } from '@/lib/ai/localModelPref';
import { resolveOcrPrefFromBridge } from '@/lib/ai/ocrPref';
import { getCodexPort } from '@/lib/ai/localPort';
import { isAiError } from '@/lib/ai/types';
import { probePageOrientation } from '@/lib/page-orientation';
import { openPdfSource, type OpenPdf, type PdfSource } from '@/lib/pdf/pdfPages';
import { FATAL_CODES } from '@/lib/problem-ocr/batch-run';
import { uploadProblemFile } from '@/lib/problem-bank/storage';
import type { PrintBundle } from '@/types/print-scan';
import type { PrintBundleDraftRow } from './bundle-plan';
import { PRINT_OCR_EFFORT_PREFERENCE, PRINT_OCR_MODEL_PREFERENCE } from './constants';
import { uploadPrintPageImages } from './page-images';
import { runBundle, type PrintBundleRunResult, type PrintRunProgress } from './run';
import { insertBundles, insertScan } from './save';
import { printScanPdfPath } from './storage-paths';

/**
 * 스캔 한 건을 통째로 처리한다 — 올리기 → 쪽 이미지 → 묶음마다 읽기 (브라우저 전용).
 *
 * 순서가 계약이다: **AI 를 부르기 전에 행을 먼저 만든다.** 읽다가 실패해도 목록에 남아
 * '다시 읽기' 로 이어갈 수 있어야 한다 — 안 그러면 올린 PDF 가 흔적 없이 사라진다.
 */

export interface PrintScanRunInput {
  file: File;
  title: string;
  pageCount: number;
  /** 저장할 묶음들 (id 는 이미 정해져 있고, scan_id 는 여기서 붙인다) */
  bundles: PrintBundleDraftRow[];
}

export interface PrintScanRunResult {
  scanId: string;
  /** 시험지까지 만든 묶음 수 */
  ok: number;
  /** 읽다가 실패한 묶음 수 */
  failed: number;
  /** 시작조차 못 한 묶음 수 (취소·한도로 멈췄을 때) — '대기' 로 남아 있다 */
  pending: number;
  /** 시험지는 만들었지만 **확인이 필요한** 묶음 수 (ok 의 부분집합) */
  warned: number;
  /** 이 스캔에서 등록된 단어 수 합계 */
  words: number;
}

/** 저장까지 마친 묶음 행 */
type SavedRow = PrintBundleDraftRow & { scan_id: string };

/** 읽기 환경 (포트·모델은 여기서 한 번만 읽는다) */
interface RunEnv {
  signal?: AbortSignal;
  onProgress?: (p: PrintRunProgress) => void;
  /** 묶음이 남긴 경고 — 어느 프린트 얘기인지 이름을 함께 준다 */
  onWarnings?: (warnings: string[], bundleName: string) => void;
}

/**
 * 다시 만드는 쪽 이미지를 가를 꼬리표.
 *
 * 같은 경로에 두 번 올릴 수 없고(버킷에 UPDATE 정책이 없다) 지우고 올리면 실패했을 때
 * 원본을 잃으므로, 다시 만들 때마다 새 이름을 쓴다.
 * @returns 경로에 붙일 짧은 꼬리표
 */
function pageImageVersion(): string {
  return Date.now().toString(36);
}

/**
 * 본문 읽기 턴에 쓸 모델·노력.
 *
 * ⚠️ 방향 판정·단어 등록에는 넘기지 않는다 — 그 둘은 싼 단계라 계정 기본값으로 충분하다.
 * @returns 해석된 값 (못 정하면 선생님 선택 그대로)
 */
async function resolveOcrPref() {
  return resolveOcrPrefFromBridge(getCodexPort(), getCodexModelPref(), {
    models: PRINT_OCR_MODEL_PREFERENCE,
    efforts: PRINT_OCR_EFFORT_PREFERENCE,
  });
}

/** 저장 행을 읽기에 쓸 모양으로 (아직 DB 에서 다시 읽지 않는다 — 방금 넣은 값 그대로다) */
function toBundle(row: SavedRow, pagePaths: Map<number, string>): PrintBundle {
  const now = new Date().toISOString();
  return {
    ...row,
    school_id: row.school_id,
    // pages 와 **같은 순서**로. 못 올린 쪽은 빈 문자열로 자리를 남긴다 —
    // 압축하면 쪽 번호와 어긋나 엉뚱한 쪽 이미지가 옆에 붙는다
    page_paths: row.pages.map((p) => pagePaths.get(p) ?? ''),
    ocr_html: '',
    ocr_meta: {},
    words_meta: {},
    // 문답은 읽기가 끝난 뒤 목록·시험지 화면에서 따로 나눈다(읽기와 같은 턴에 묶지 않는다)
    qa_items: [],
    qa_meta: {},
    user_id: '',
    updated_by: null,
    created_at: now,
    updated_at: now,
  };
}

/**
 * 업로드부터 읽기까지 한 번에.
 * @param input - 파일·제목·묶음들
 * @param env - 취소·진행률
 * @returns 스캔 id 와 묶음별 결과 수
 * @throws 업로드·행 생성에 실패했을 때 (읽기 실패는 묶음 상태로 남고 던지지 않는다)
 */
export async function runPrintScan(
  input: PrintScanRunInput,
  env: RunEnv = {},
): Promise<PrintScanRunResult> {
  const scanId = crypto.randomUUID();
  const bundles = input.bundles.map((b) => ({ ...b, scan_id: scanId }));

  // 1) 원본 PDF — '다시 읽기' 가 이 파일에 달려 있다
  env.onProgress?.({ phase: 'upload', done: 0, total: 1 });
  const filePath = printScanPdfPath(scanId);
  await uploadProblemFile(filePath, input.file, 'application/pdf');
  env.onProgress?.({ phase: 'upload', done: 1, total: 1 });

  // 2) 행 먼저 (AI 호출 전에!)
  await insertScan(scanId, {
    title: input.title,
    file_path: filePath,
    page_count: input.pageCount,
  });
  await insertBundles(bundles);

  // 3) 읽기
  const doc = await openPdfSource({ kind: 'file', file: input.file });
  try {
    const result = await readBundlesInOrder(scanId, bundles, doc, env);
    return { scanId, ...result };
  } finally {
    doc.pdf.destroy();
  }
}

/** 묶음을 차례로 읽는다. 멈춰야 하는 오류면 남은 묶음은 '대기' 로 둔다 */
async function readBundlesInOrder(
  scanId: string,
  rows: SavedRow[],
  doc: OpenPdf,
  env: RunEnv,
): Promise<{ ok: number; failed: number; pending: number; warned: number; words: number }> {
  const port = getCodexPort();
  const pref = getCodexModelPref();
  // 본문 읽기에 쓸 모델·노력은 **여기서 한 번만** 정한다 — 묶음마다 물으면 프린트 수만큼
  // `model/list` 를 부르게 된다. 목록을 못 받으면 예전처럼 계정 기본값으로 읽는다
  const ocrPref = await resolveOcrPref();

  // 쪽 이미지는 한 번에 올린다 — 묶음마다 열면 같은 캔버스를 여러 번 그린다
  const pages = [...new Set(rows.flatMap((r) => r.pages))].sort((a, b) => a - b);

  // 방향은 **저장하기 전에** 확인한다 — 올려 둔 원본 이미지도 바로 선 채로 저장되어야
  // 편집 화면의 대조가 본문과 맞는다. 스캔 전체를 한 번에 물어 묶음마다 다시 묻지 않는다
  const orientation = await probePageOrientation(doc, pages, {
    port,
    pref,
    signal: env.signal,
    onProgress: (done, total) => env.onProgress?.({ phase: 'orient', done, total }),
  });

  const pagePaths = await uploadPrintPageImages(doc, scanId, pages, env.signal, (done, total) => {
    env.onProgress?.({ phase: 'page', done, total });
  }, orientation.rotations);

  let ok = 0;
  let failed = 0;
  let warned = 0;
  let words = 0;

  for (const [index, row] of rows.entries()) {
    if (env.signal?.aborted) break;
    const bundle = toBundle(row, pagePaths);
    const onProgress = (p: PrintRunProgress) => env.onProgress?.({
      ...p,
      bundle: { index, total: rows.length, name: row.name },
    });

    // 경고는 읽자마자 화면에 올리되(늦게 알릴 이유가 없다) **세는 것은 저장까지 끝난 뒤**다 —
    // 여기서 세면 시험지 만들기가 실패한 묶음이 '실패' 와 '확인 필요' 로 두 번 세어진다
    let sawWarnings = false;
    try {
      const result = await runBundle(bundle, doc, {
        port, pref, ocrPref, signal: env.signal, onProgress, orientation,
        onWarnings: (w) => {
          sawWarnings = true;
          env.onWarnings?.(w, row.name);
        },
      });
      ok += 1;
      words += result.wordsRegistered;
      if (sawWarnings) warned += 1;
      // 단어 등록이 한도·권한·취소로 끝났으면 **다음 묶음도 같은 이유로 죽는다.**
      // 시험지는 이미 만들어졌으니 실패로 세지 않고, 남은 묶음만 '대기' 로 남긴다
      if (result.wordsFatal) break;
    } catch (e) {
      failed += 1;
      // 한도·권한·취소는 다음 묶음도 같은 이유로 죽는다 — 남은 것은 **손대지 않고** 멈춘다
      // ('대기' 로 남아야 정직하다: 시작도 안 했으니 실패가 아니다)
      if (isAiError(e) && FATAL_CODES.has(e.code)) break;
    }
  }

  return { ok, failed, pending: rows.length - ok - failed, warned, words };
}

/**
 * 이미 올려 둔 스캔의 묶음 하나만 다시 읽는다 (목록의 '다시 읽기').
 *
 * 업로드 때와 **같은 `runBundle`** 을 쓴다 — 상태 전이와 시험지 만들기가 한 벌이라야
 * 두 길이 조용히 갈라지지 않는다.
 * @param bundle - 다시 읽을 묶음
 * @param source - 저장해 둔 원본 PDF (서명 URL)
 * @param scanId - 스캔 id (쪽 이미지 경로에 쓴다)
 * @param env - 취소·진행률
 * @returns 시험지 id 와 단어 등록 결과
 */
export async function rerunBundle(
  bundle: PrintBundle,
  source: PdfSource,
  scanId: string,
  env: RunEnv = {},
): Promise<PrintBundleRunResult> {
  const doc = await openPdfSource(source);
  try {
    const port = getCodexPort();
    const pref = getCodexModelPref();
    const ocrPref = await resolveOcrPref();

    // 방향은 저장하지 않는다 — 다시 읽을 때 다시 묻는 편이 싸고, 옛 묶음도 그대로 고쳐진다
    const orientation = await probePageOrientation(doc, bundle.pages, {
      port,
      pref,
      signal: env.signal,
      onProgress: (done, total) => env.onProgress?.({ phase: 'orient', done, total }),
    });

    // 쪽 이미지는 **늘 다시 만든다.** 방향이 이번에 달라졌을 수도, 지난번과 반대로
    // 돌아갔을 수도 있는데(그때 0도면 옛 이미지는 여전히 거꾸로다) 어느 쪽인지 알 길이 없다 —
    // 각도를 저장하지 않기로 했으므로 다시 만드는 편이 늘 맞는다(코덱스 리뷰 2R).
    // ⚠️ **새 판으로 올리고 성공한 것만 갈아 끼운다.** 옛 파일을 먼저 지우면 업로드가
    //    실패했을 때 멀쩡하던 원본이 사라져 되돌릴 길이 없다(코덱스 정지 리뷰).
    //    실패한 쪽은 옛 경로를 그대로 쓴다 — 방향이 어긋난 그림이라도 없는 것보다 낫다
    const uploaded = await uploadPrintPageImages(
      doc, scanId, bundle.pages, env.signal,
      (done, total) => env.onProgress?.({ phase: 'page', done, total }),
      orientation.rotations, pageImageVersion(),
    );
    const pagePaths = bundle.pages.map((p, i) => uploaded.get(p) ?? bundle.page_paths[i] ?? '');

    return await runBundle({ ...bundle, page_paths: pagePaths }, doc, {
      port,
      pref,
      ocrPref,
      signal: env.signal,
      onProgress: env.onProgress,
      onWarnings: (w) => env.onWarnings?.(w, bundle.name),
      orientation,
    });
  } finally {
    doc.pdf.destroy();
  }
}
