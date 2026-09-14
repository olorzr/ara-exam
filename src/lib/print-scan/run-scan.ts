'use client';

import { getCodexModelPref } from '@/lib/ai/localModelPref';
import { getCodexPort } from '@/lib/ai/localPort';
import { isAiError } from '@/lib/ai/types';
import { openPdfSource, type OpenPdf, type PdfSource } from '@/lib/pdf/pdfPages';
import { FATAL_CODES } from '@/lib/problem-ocr/batch-run';
import { uploadProblemFile } from '@/lib/problem-bank/storage';
import type { PrintBundle } from '@/types/print-scan';
import type { PrintBundleDraftRow } from './bundle-plan';
import { uploadPrintPageImages } from './page-images';
import { runBundle, type PrintRunProgress } from './run';
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
): Promise<{ ok: number; failed: number; pending: number; warned: number }> {
  const port = getCodexPort();
  const pref = getCodexModelPref();

  // 쪽 이미지는 한 번에 올린다 — 묶음마다 열면 같은 캔버스를 여러 번 그린다
  const pages = [...new Set(rows.flatMap((r) => r.pages))].sort((a, b) => a - b);
  const pagePaths = await uploadPrintPageImages(doc, scanId, pages, env.signal, (done, total) => {
    env.onProgress?.({ phase: 'page', done, total });
  });

  let ok = 0;
  let failed = 0;
  let warned = 0;

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
      await runBundle(bundle, doc, {
        port, pref, signal: env.signal, onProgress,
        onWarnings: (w) => {
          sawWarnings = true;
          env.onWarnings?.(w, row.name);
        },
      });
      ok += 1;
      if (sawWarnings) warned += 1;
    } catch (e) {
      failed += 1;
      // 한도·권한·취소는 다음 묶음도 같은 이유로 죽는다 — 남은 것은 **손대지 않고** 멈춘다
      // ('대기' 로 남아야 정직하다: 시작도 안 했으니 실패가 아니다)
      if (isAiError(e) && FATAL_CODES.has(e.code)) break;
    }
  }

  return { ok, failed, pending: rows.length - ok - failed, warned };
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
 * @returns 만들어진 시험지 id
 */
export async function rerunBundle(
  bundle: PrintBundle,
  source: PdfSource,
  scanId: string,
  env: RunEnv = {},
): Promise<string> {
  const doc = await openPdfSource(source);
  try {
    // 처음 읽을 때 실패한 쪽이 있으면 이때 다시 올린다(경로가 비어 있는 자리)
    let pagePaths = bundle.page_paths;
    if (pagePaths.length !== bundle.pages.length || pagePaths.some((p) => !p)) {
      const uploaded = await uploadPrintPageImages(doc, scanId, bundle.pages, env.signal,
        (done, total) => env.onProgress?.({ phase: 'page', done, total }));
      pagePaths = bundle.pages.map((p) => uploaded.get(p) ?? '');
    }

    return await runBundle({ ...bundle, page_paths: pagePaths }, doc, {
      port: getCodexPort(),
      pref: getCodexModelPref(),
      signal: env.signal,
      onProgress: env.onProgress,
      onWarnings: (w) => env.onWarnings?.(w, bundle.name),
    });
  } finally {
    doc.pdf.destroy();
  }
}
