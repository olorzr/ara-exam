'use client';

import type { OpenPdf } from '@/lib/pdf/pdfPages';
import type { PageRotation } from '@/lib/pdf/pdfRenderer';
import { PageCropper } from '@/lib/problem-ocr/crop-dom';
import { uploadProblemFile } from '@/lib/problem-bank/storage';
import { isDuplicateUploadError } from '@/lib/problem-bank/storage-errors';
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
 * ⚠️ 실패한 쪽은 **결과에 넣지 않는다.** 호출부가 옛 경로를 그대로 쓰게 하기 위해서다.
 * ⚠️ **옛 파일을 지우고 다시 올리지 않는다.** 지운 뒤 업로드가 실패하면 멀쩡하던 원본이
 *    사라지고 되돌릴 길이 없다 — 다시 만들 때는 `version` 을 줘서 **새 경로**에 올리고,
 *    성공한 것만 갈아 끼운다. 쓰지 않게 된 옛 파일은 남겨 둔다(선택 삭제와 같은 규약).
 *
 * @param doc - 열어 둔 PDF
 * @param scanId - 스캔 id
 * @param pages - 올릴 쪽 번호들
 * @param signal - 취소 신호
 * @param onProgress - 진행률 (done, total)
 * @param rotations - 바로 세우려고 돌릴 각도. **AI 로 보내는 이미지와 같은 값**을 넘겨야
 *   편집 화면의 원본 대조가 본문과 맞는다(한쪽만 돌리면 글은 바로 섰는데 원본만 거꾸로다)
 * @param version - 다시 만드는 판의 꼬리표. 주면 **새 경로**에 올린다(옛 파일은 건드리지 않는다)
 * @returns 쪽 → Storage 경로 (성공한 것만)
 */
export async function uploadPrintPageImages(
  doc: OpenPdf,
  scanId: string,
  pages: readonly number[],
  signal?: AbortSignal,
  onProgress?: (done: number, total: number) => void,
  rotations?: ReadonlyMap<number, PageRotation>,
  version = '',
): Promise<Map<number, string>> {
  const out = new Map<number, string>();
  const sorted = [...new Set(pages)]
    .filter((p) => Number.isInteger(p) && p >= 1)
    .sort((a, b) => a - b);
  if (sorted.length === 0) return out;

  const cropper = new PageCropper(doc, undefined, rotations);
  let done = 0;
  try {
    for (const page of sorted) {
      if (signal?.aborted) return out;
      const blob = await cropper.pageBlob(page);
      if (blob) {
        const path = printScanPagePath(scanId, page, version);
        try {
          await uploadProblemFile(path, blob, 'image/jpeg');
          out.set(page, path);
        } catch (e) {
          // 이미 있는 경로면 upsert:false 라 여기로 온다 — 그 파일은 우리가 올린 것이라 유효하다.
          // 네트워크·권한·용량 실패까지 '있다' 로 치면 **없는 파일의 경로**를 저장하게 된다
          if (isDuplicateUploadError(e)) out.set(page, path);
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
