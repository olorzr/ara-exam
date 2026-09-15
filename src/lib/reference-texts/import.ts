'use client';

import { openPdfSource } from '@/lib/pdf/pdfPages';
import { readPageText } from '@/lib/pdf/pdfText';
import { joinPageTexts, normalizeImportedText } from './import-text';

/**
 * 파일에서 작품 전문 가져오기 (브라우저 전용).
 *
 * ⚠️ **`extractPageText` 가 아니라 `readPageText` 를 쓴다.** 그쪽은 쪽당 200자라는 문턱이
 *    있는데(복합기 자동 OCR 레이어를 거르려고 둔 것) 시집처럼 쪽이 짧은 글은 그 문턱에
 *    걸려 통째로 빈다. 여기는 사람이 고른 파일을 그대로 옮기는 자리다.
 *
 * ⚠️ 스캔한 PDF(글자 레이어 없음)는 이 길로 한 글자도 못 읽는다 — `pdfImportVerdict` 가
 *    그 사실과 갈 길(학교 프린트 시험지)을 알려 준다.
 */

/** PDF 에서 건진 결과 */
export interface PdfTextLayer {
  /** 이어 붙인 평문 */
  text: string;
  pageCount: number;
  /** 글자를 건진 쪽 수 */
  pagesWithText: number;
}

/**
 * `.txt` 파일을 읽는다.
 * @param file - 고른 파일
 * @returns 평문
 */
export async function readTextFile(file: File): Promise<string> {
  return normalizeImportedText(await file.text());
}

/**
 * PDF 의 글자 레이어를 쪽마다 읽어 한 편으로 잇는다.
 *
 * ⚠️ 문서는 **한 번만 열고 반드시 닫는다**(`finally`) — 쪽마다 열면 그때마다 파일 전체를
 *    복사하고, 안 닫으면 열어 둔 PDF 가 쌓인다.
 * @param file - 고른 PDF
 * @returns 평문과 쪽 수
 */
export async function readPdfTextLayer(file: File): Promise<PdfTextLayer> {
  const doc = await openPdfSource({ kind: 'file', file });
  try {
    const pages: string[] = [];
    for (let page = 1; page <= doc.numPages; page += 1) {
      // 쪽 하나가 실패해도 멈추지 않는다 — 나머지 쪽은 멀쩡하다(readPageText 는 던지지 않는다)
      pages.push(await readPageText(doc.pdf, page));
    }
    return {
      text: joinPageTexts(pages),
      pageCount: doc.numPages,
      pagesWithText: pages.filter((p) => p.trim() !== '').length,
    };
  } finally {
    doc.pdf.destroy();
  }
}
