// PDF 렌더링 (브라우저 전용).
//
// 기출 PDF 를 OCR 로 읽기 전에 쪽마다 캔버스로 그린다. 문서는 **한 번만 열고**
// 쪽별로 렌더링한다 — 묶음마다 다시 열면 파일 전체를 매번 복사하게 된다.
//
// 원본: ara-system `app/lib/omr/pdfRenderer.ts`.

import type { PDFDocumentProxy } from 'pdfjs-dist'

let pdfjsPromise: Promise<typeof import('pdfjs-dist')> | null = null

async function getPdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = import('pdfjs-dist').then((mod) => {
      // worker는 클라이언트 사이드 워커 스크립트 경로 지정
      mod.GlobalWorkerOptions.workerSrc = new URL(
        'pdfjs-dist/build/pdf.worker.mjs',
        import.meta.url,
      ).toString()
      return mod
    })
  }
  return pdfjsPromise
}

export type PdfRenderOptions = {
  page?: number // 1-based, 기본 1
  scale?: number // 기본 2 (고해상도)
}

// PDF 문서를 열어 프록시와 페이지 수를 반환. 페이지별 렌더링은 renderPdfPage로.
export async function getPdfDocument(
  source: string | ArrayBuffer | Uint8Array,
): Promise<{ pdf: PDFDocumentProxy; numPages: number }> {
  const pdfjs = await getPdfjs()
  // wasmUrl: JBIG2(흑백 스캐너 PDF)·JPX 이미지 디코딩용. 미지정 시 스캔본이 백지로 렌더링됨.
  // 자산은 predev/prebuild 훅(scripts/copy-pdfjs-wasm.js)이 public/pdfjs-wasm/에 복사. 끝 슬래시 필수.
  const loadingTask = pdfjs.getDocument({
    ...(typeof source === 'string' ? { url: source } : { data: source }),
    wasmUrl: '/pdfjs-wasm/',
  })
  const pdf = await loadingTask.promise
  return { pdf, numPages: pdf.numPages }
}

// 이미 연 PDF 문서의 특정 페이지를 캔버스에 렌더링.
export async function renderPdfPage(
  pdf: PDFDocumentProxy,
  page: number,
  scale = 2,
): Promise<HTMLCanvasElement> {
  const pdfPage = await pdf.getPage(page)
  const viewport = pdfPage.getViewport({ scale })

  const canvas = document.createElement('canvas')
  canvas.width = viewport.width
  canvas.height = viewport.height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('캔버스 컨텍스트를 가져올 수 없습니다')

  await pdfPage.render({ canvasContext: ctx, viewport, canvas }).promise
  return canvas
}

// PDF URL 또는 ArrayBuffer를 받아서 단일 페이지 캔버스 렌더링 (캘리브레이션용).
export async function renderPdfToCanvas(
  source: string | ArrayBuffer | Uint8Array,
  options: PdfRenderOptions = {},
): Promise<HTMLCanvasElement> {
  const { page = 1, scale = 2 } = options
  const { pdf } = await getPdfDocument(source)
  return renderPdfPage(pdf, page, scale)
}
