'use client';

import type { OpenPdf } from '@/lib/pdf/pdfPages';
import { PageCropper } from '@/lib/problem-ocr/crop-dom';
import { uploadProblemFile } from '@/lib/problem-bank/storage';
import { printScanPagePath } from './storage-paths';

/**
 * 원본 쪽 이미지를 Storage 에 올린다 (브라우저 전용).
 *
 * 시험지를 고칠 때 **원본과 대조**하는 데 쓴다. 이게 없으면 편집기 옆 칸이 늘 비어 있어
 * 잘못 읽은 글자를 알아챌 방법이 사라진다(기출 검수 화면과 같은 근거).
 *
 * ⚠️ 한 장이 실패해도 **멈추지 않는다.** 대조가 부분적으로라도 되는 편이 낫고,
 *    무엇보다 이 실패가 본문 읽기를 막으면 안 된다.
 * ⚠️ data URL → fetch → Blob 수법을 쓰지 말 것 — CSP `connect-src` 가 `data:` 를 막아
 *    **전부 실패**한다. 반드시 `canvas.toBlob`(PageCropper.pageBlob)이다.
 *
 * @param doc - 열어 둔 PDF
 * @param scanId - 스캔 id
 * @param pages - 올릴 쪽 번호들
 * @param signal - 취소 신호
 * @param onProgress - 진행률 (done, total)
 * @returns 쪽 → Storage 경로 (성공한 것만)
 */
export async function uploadPrintPageImages(
  doc: OpenPdf,
  scanId: string,
  pages: readonly number[],
  signal?: AbortSignal,
  onProgress?: (done: number, total: number) => void,
): Promise<Map<number, string>> {
  const out = new Map<number, string>();
  const sorted = [...new Set(pages)]
    .filter((p) => Number.isInteger(p) && p >= 1)
    .sort((a, b) => a - b);
  if (sorted.length === 0) return out;

  const cropper = new PageCropper(doc);
  let done = 0;
  try {
    for (const page of sorted) {
      if (signal?.aborted) return out;
      const blob = await cropper.pageBlob(page);
      if (blob) {
        const path = printScanPagePath(scanId, page);
        try {
          await uploadProblemFile(path, blob, 'image/jpeg');
          out.set(page, path);
        } catch {
          // 이미 있는 경로면 upsert:false 라 여기로 온다(다시 읽기).
          // 파일은 이미 있으니 경로는 유효하다 — 그대로 쓴다
          out.set(page, path);
        }
      }
      done += 1;
      onProgress?.(done, sorted.length);
    }
  } finally {
    cropper.dispose();
  }
  return out;
}
