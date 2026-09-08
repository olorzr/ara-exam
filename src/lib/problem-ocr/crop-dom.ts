'use client';

import { renderPdfPage } from '@/lib/pdf/pdfRenderer';
import type { OpenPdf } from '@/lib/pdf/pdfPages';
import type { Bbox } from '@/types/problem-bank';
import { bboxToPixelRect } from './crop';

/**
 * 페이지 캔버스에서 영역을 잘라 JPEG 로 만든다 (브라우저 전용).
 *
 * pdf.js 재렌더는 비싸다(한 쪽에 수백 ms). 한 쪽에서 여러 문항을 잘라내므로
 * **캔버스를 캐시**하고, 메모리를 위해 몇 장만 들고 있는다.
 */

/** 동시에 들고 있을 페이지 캔버스 수. A4 scale 2 한 장이 대략 8MB 다 */
const CANVAS_CACHE_SIZE = 6;

/** 잘라 낸 이미지의 화질. 원본 대조용이라 아주 높을 필요는 없다 */
const CROP_QUALITY = 0.85;

/** 페이지 캔버스를 재사용하는 잘라내기 도구 */
export class PageCropper {
  private cache = new Map<number, HTMLCanvasElement>();

  constructor(private readonly doc: OpenPdf, private readonly scale = 2) {}

  /**
   * 페이지 캔버스를 얻는다(캐시 사용).
   * @param page - 1-based 쪽 번호
   * @returns 렌더된 캔버스
   */
  async canvasFor(page: number): Promise<HTMLCanvasElement> {
    const hit = this.cache.get(page);
    if (hit) return hit;

    const canvas = await renderPdfPage(this.doc.pdf, page, this.scale);
    // 오래된 것부터 버린다(Map 은 삽입 순서를 지킨다)
    if (this.cache.size >= CANVAS_CACHE_SIZE) {
      const oldest = this.cache.keys().next().value;
      if (oldest !== undefined) this.cache.delete(oldest);
    }
    this.cache.set(page, canvas);
    return canvas;
  }

  /**
   * 영역을 잘라 JPEG Blob 으로 만든다.
   * @param page - 1-based 쪽 번호
   * @param bbox - 정규화(0~1) 영역
   * @returns Blob. 만들지 못하면 null (크롭 실패가 저장을 막으면 안 된다)
   */
  async crop(page: number, bbox: Bbox): Promise<Blob | null> {
    try {
      const source = await this.canvasFor(page);
      const rect = bboxToPixelRect(bbox, source.width, source.height);

      const out = document.createElement('canvas');
      out.width = rect.w;
      out.height = rect.h;
      const ctx = out.getContext('2d');
      if (!ctx) return null;

      // 흰 바탕을 먼저 칠한다 — JPEG 는 투명을 모르고, 안 칠하면 검게 나온다
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, rect.w, rect.h);
      ctx.drawImage(source, rect.x, rect.y, rect.w, rect.h, 0, 0, rect.w, rect.h);

      return await new Promise<Blob | null>((resolve) => {
        out.toBlob((blob) => resolve(blob), 'image/jpeg', CROP_QUALITY);
      });
    } catch {
      return null;
    }
  }

  /** 캐시를 비운다. 다 쓰면 반드시 부를 것(캔버스가 수십 MB 다) */
  dispose(): void {
    this.cache.clear();
  }
}
