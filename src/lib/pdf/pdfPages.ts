'use client'

// 시험지/정답지 PDF의 **고른 페이지**를 data URL 이미지로 (브라우저 전용).
//
// attachments.ts 의 형제 파일. 그쪽을 고치지 않는 이유: 시험 분석·성적표 초안이 이미 쓰고 있고,
// "앞에서부터 N장"이라는 그쪽 규약을 여기서 바꾸면 그 기능들이 같이 흔들린다.
//
// ── 페이로드에 대해 아는 것 / 모르는 것 ────────────────────────────
//  · **실측** — 이미지 5장 · data URL 프레임 3.2MB **통과**. vision 인식 확인.
//  · **미측정** — 진짜 상한과 실패점. 3.2MB 는 통과한 값이지 천장이 아니다.
//    상한을 거는 주체가 있다면 선생님 PC의 codex app-server 뿐이다 —
//    브릿지(public/ara-ai/bridge.cjs)는 101 이후 raw TCP splice라 프레임을 파싱조차 안 한다.
//
// 예전 주석은 이걸 "브릿지 프로토콜 한계"로 단정하고 5쪽 상한을 정당화했는데 **근거가 없었다.**
// 그래서 전체 쪽 읽기는 상한을 키워서 푸는 게 아니라 **몇 쪽씩 묶어 여러 turn**으로 푼다.
// 대신 묶음 하나 = 선생님 ChatGPT 1회이므로, 호출부가 묶음 수를 사람에게 먼저 알린다.
//
// ⚠️ **묶음 크기는 이 파일이 정하지 않는다** — 기능마다 다르다(국어 지문 OCR 은 출력이 길어
//    더 잘게 나눈다). 정책값은 `src/lib/problem-ocr/constants.ts` 에 있다.
//
// 원본: ara-system `app/lib/ai/pdfPages.ts`.

import { getPdfDocument, renderPdfPage } from '@/lib/pdf/pdfRenderer'
import { encodePageImages } from '@/lib/pdf/pdfColumns'
import {
  COLUMN_SCALE, encodeAt, encodeWithinBudget,
  MAX_BATCH_BYTES, MAX_PAGE_BYTES, PAGE_SCALE,
} from '@/lib/pdf/pdfBudget'

// 예산·인코딩은 `pdfBudget` 이 단일 출처다. ⚠️ 여기서 다시 선언하면 `pdfColumns` 와
// **순환 import** 가 되어 단 이미지 예산이 NaN 이 되고, 2단 쪽이 전부 건너뛰어진다
export { encodeWithinBudget, MAX_PAGE_BYTES }

type PdfDocumentProxy = Awaited<ReturnType<typeof getPdfDocument>>['pdf']

/** 썸네일은 페이지 고르기용이라 작고 거칠어도 된다 */
const THUMB_SCALE = 0.35
const THUMB_QUALITY = 0.55
/**
 * 한 번에 그리는 썸네일 수. 상한이 아니라 **창 크기**다 —
 * 모의고사는 정답지가 뒤쪽(25쪽 이후)에 붙는 경우가 흔해서, 앞 24장만 보여주면
 * 정작 필요한 쪽을 고를 수가 없다. 호출부가 from 을 옮겨 뒤쪽도 볼 수 있게 한다.
 */
export const THUMB_WINDOW = 24

export type PdfSource =
  | { kind: 'file'; file: File }
  | { kind: 'url'; url: string }

/** 열어 둔 PDF — 묶음마다 다시 열지 않으려고 호출부가 들고 다닌다 */
export type OpenPdf = { pdf: PdfDocumentProxy; numPages: number }

/**
 * PDF 열기. 이미 업로드된 공개 URL 도 그대로 받는다(pdf.js 가 url 로딩을 지원).
 * URL 로딩이 CORS/네트워크로 실패하면 fetch → arrayBuffer 로 한 번 더 시도한다.
 *
 * ⚠️ 호출부는 반드시 `finally { doc.pdf.destroy() }` 로 닫을 것.
 *    묶음마다 열면 URL 소스는 묶음 수만큼 다시 다운로드되고, 파일 소스도 매번 전체 복사된다.
 */
export async function openPdfSource(src: PdfSource): Promise<OpenPdf> {
  if (src.kind === 'file') return getPdfDocument(await src.file.arrayBuffer())
  try {
    return await getPdfDocument(src.url)
  } catch {
    try {
      const res = await fetch(src.url)
      if (!res.ok) throw new Error(String(res.status))
      return await getPdfDocument(await res.arrayBuffer())
    } catch {
      throw new Error('저장된 PDF를 불러오지 못했어요. 파일을 다시 선택해 주세요.')
    }
  }
}

/** 페이지 수만 확인 (문서를 열고 바로 닫는다) */
export async function pdfPageCount(src: PdfSource): Promise<number> {
  const { pdf, numPages } = await openPdfSource(src)
  pdf.destroy()
  return numPages
}

/** 이미지 한 장이 쪽의 어느 부분인가 */
export type RenderedPart = 'full' | 'left' | 'right'

/** 보낸 이미지 한 장의 정체 */
export type RenderedImage = {
  page: number
  part: RenderedPart
}

export type RenderedPages = {
  images: string[]
  /**
   * 실제로 그려 낸 이미지의 정체. **images 와 순서·길이가 정확히 같다.**
   *
   * ⚠️ 호출부는 요청한 pages 가 아니라 **이 값**을 프롬프트에 실어야 한다.
   *    한 쪽이라도 건너뛰면 "이미지 순서 = 이 쪽" 이라는 약속이 깨져
   *    2쪽 내용이 1쪽으로 기록되고, 그 잘못된 쪽 번호가 중복 판정·지문 병합·
   *    이미지 크롭까지 줄줄이 어긋나게 만든다.
   *
   * 2단 쪽을 갈라 보내면 **한 쪽이 두 장**이 된다 — 그래서 쪽 번호 배열이 아니라
   * 이 모양이다. 쪽 번호만 필요하면 `pagesOf` 를 쓸 것.
   */
  rendered: RenderedImage[]
  /** 예산 안에 못 넣어 건너뛴 쪽 번호 — 호출부가 경고로 알린다(조용히 빠뜨리지 않기) */
  skipped: number[]
}

/**
 * 보낸 이미지들이 덮는 쪽 번호 (중복 없이, 순서 유지).
 * @param rendered - 보낸 이미지 목록
 * @returns 쪽 번호 배열
 */
export function pagesOf(rendered: readonly RenderedImage[]): number[] {
  return [...new Set(rendered.map((r) => r.page))]
}

/**
 * 열어 둔 문서에서 지정한 쪽들만 data URL 로. pages 는 1-based.
 *
 * 쪽마다 메인스레드를 양보한다 — 30쪽을 연속으로 그리면 렌더 도중 화면이 통째로 얼어붙는다
 * (useOmrScan 의 배치 인식과 같은 규약).
 */
export async function renderPagesToImages(
  doc: OpenPdf,
  pages: number[],
  opts?: { signal?: AbortSignal; splitColumns?: boolean },
): Promise<RenderedPages> {
  const wanted = [...new Set(pages)]
    .filter(p => Number.isInteger(p) && p >= 1 && p <= doc.numPages)
    .sort((a, b) => a - b)

  const split = opts?.splitColumns ?? false
  const images: string[] = []
  const rendered: RenderedImage[] = []
  const skipped: number[] = []
  let bytes = 0

  for (const page of wanted) {
    if (opts?.signal?.aborted) break

    const canvas = await renderPdfPage(doc.pdf, page, split ? COLUMN_SCALE : PAGE_SCALE)
    const parts = encodePageImages(canvas, split, encodeWithinBudget)

    // ⚠️ 한 조각이라도 예산을 못 맞추면 **그 쪽을 통째로** 건너뛴다. 반쪽만 보내면
    //    그 쪽 내용의 절반이 조용히 사라지는데, 경고에는 아무것도 안 남는다
    if (parts.length === 0) { skipped.push(page); continue }

    const size = parts.reduce((n, p) => n + p.url.length, 0)
    // 2차 안전판 — 쪽당 예산이 보장되므로 실제로는 거의 안 걸린다
    if (bytes + size > MAX_BATCH_BYTES) { skipped.push(page); continue }

    bytes += size
    for (const { url, part } of parts) {
      images.push(url)
      rendered.push({ page, part })
    }
    await new Promise(resolve => setTimeout(resolve, 0))
  }

  return { images, rendered, skipped }
}

/**
 * 페이지 선택 UI 용 썸네일. `from`(1-based)부터 THUMB_WINDOW 장.
 * 반환값의 index 0 은 `from` 쪽이다 — 호출부가 실제 쪽 번호를 계산해야 한다.
 */
export async function pdfThumbnails(src: PdfSource, from = 1): Promise<string[]> {
  const { pdf, numPages } = await openPdfSource(src)
  try {
    const start = Math.min(Math.max(1, Math.floor(from)), numPages)
    const end = Math.min(numPages, start + THUMB_WINDOW - 1)
    const out: string[] = []
    for (let page = start; page <= end; page++) {
      out.push(encodeAt(await renderPdfPage(pdf, page, THUMB_SCALE), 1800, THUMB_QUALITY))
    }
    return out
  } finally {
    pdf.destroy()
  }
}
