'use client';

import { extractPageText } from '@/lib/pdf/pdfText';
import type { OpenPdf } from '@/lib/pdf/pdfPages';

/**
 * 모델에게 **함께** 넘길 참고 텍스트를 모은다 (브라우저 전용).
 *
 * 이미지로는 구조(문항 경계·밑줄·상자·그림 자리)를 보고, 글자는 이쪽을 믿게 한다.
 *
 * 공급원을 여기 한 자리에 모아 둔 이유: 지금은 PDF 글자 레이어 하나뿐이지만
 * (기출은 대부분 스캔본이라 드물게만 있다), 한글 전용 OCR API 를 붙이면 같은 배관에
 * 꽂힌다. 프롬프트·검사 쪽은 **어디서 왔는지 몰라도 되게** 해 둔다.
 */

/** 쪽 하나의 참고 텍스트 */
export interface PageText {
  page: number;
  text: string;
  /** 어디서 왔는가 — 검수 화면이 "글자 데이터를 썼다" 고 알리는 데 쓴다 */
  source: 'layer';
}

/**
 * 이 묶음이 덮는 쪽들의 참고 텍스트를 모은다.
 *
 * 없는 쪽은 **그냥 빠진다** — 스캔본이 정상이고, 없다고 해서 읽기를 멈추지 않는다.
 * @param doc - 열어 둔 문서
 * @param pages - 읽을 쪽 번호들
 * @returns 참고 텍스트 목록 (없으면 빈 배열)
 */
export async function collectPageTexts(doc: OpenPdf, pages: number[]): Promise<PageText[]> {
  const out: PageText[] = [];
  for (const page of pages) {
    const text = await extractPageText(doc.pdf, page);
    if (text) out.push({ page, text, source: 'layer' });
  }
  return out;
}

/**
 * 읽기 전체에서 글자 데이터를 얼마나 썼는가 — `ocr_meta` 에 남긴다.
 * @param pages - 읽은 쪽 수
 * @param withText - 참고 텍스트가 있던 쪽 수
 * @returns 'layer'(전부) · 'partial'(일부) · 'none'
 */
export function textSourceOf(pages: number, withText: number): 'layer' | 'partial' | 'none' {
  if (withText === 0) return 'none';
  return withText >= pages ? 'layer' : 'partial';
}
