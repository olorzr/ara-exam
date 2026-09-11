'use client'

// PDF 의 **글자 레이어**를 읽어 쪽마다 평문으로 (브라우저 전용).
//
// 왜 쓰는가: 시각 모델은 구조(문항 경계·밑줄·상자·그림 자리)는 잘 보지만 **글자 하나하나**
// 에서는 틀린다 — 한자·㉠·①·비슷한 한글이 특히 그렇다. PDF 에 글자가 이미 박혀 있으면
// 그건 틀릴 수가 없으므로, 이미지와 **함께** 넘겨 "글자는 이쪽을 믿으라" 고 알린다.
//
// ⚠️ **기출은 대부분 스캔본이라 글자 레이어가 없다.** 이 길은 있으면 공짜로 좋아지는
//    보너스이지 주된 대책이 아니다(주된 대책은 단 가르기 — columnDetect.ts).

import { getPdfDocument } from '@/lib/pdf/pdfRenderer'

type PdfDocumentProxy = Awaited<ReturnType<typeof getPdfDocument>>['pdf']

/** 글자 조각 하나 — pdf.js 의 TextItem 에서 필요한 것만 추린 모양 */
export interface TextPiece {
  str: string
  /** 왼쪽 끝 (PDF 좌표, 오른쪽으로 증가) */
  x: number
  /** 글자 기준선 (PDF 좌표, **위로** 증가) */
  y: number
  width: number
}

/** 같은 줄로 볼 세로 차이 (pt). 위첨자·한자 병기가 조금씩 어긋난다 */
const LINE_TOLERANCE = 3

/** 2단으로 보려면 각 단에 이만큼은 글자가 있어야 한다 (조각 수 비율) */
const MIN_COLUMN_SHARE = 0.2

/** 가운데를 가로지르는 조각이 이보다 많으면 1단이다 (머리글·표는 가로지른다) */
const MAX_STRADDLE_SHARE = 0.15

/** 이만큼은 읽혀야 '쓸 만한 글자 레이어' 로 본다 (쪽당 글자 수) */
const MIN_USABLE_CHARS = 200

/** 깨진 글자가 이 비율을 넘으면 못 믿는다 */
const MAX_BROKEN_SHARE = 0.02

/**
 * 글자 조각들을 **읽는 순서대로** 이어 붙인다 (순수 함수).
 *
 * pdf.js 는 조각을 문서에 박힌 순서로 주는데, 2단 조판에서는 그 순서가 읽는 순서와
 * 다를 수 있다. 단을 갈라 왼쪽을 위에서 아래로, 그다음 오른쪽을 훑는다 —
 * 이미지 쪽(columnDetect.ts)과 같은 판단을 글자 좌표로 하는 셈이다.
 * @param pieces - 글자 조각들
 * @param pageWidth - 쪽 폭 (PDF 단위)
 * @returns 줄바꿈이 들어간 평문
 */
export function groupTextItems(pieces: readonly TextPiece[], pageWidth: number): string {
  const used = pieces.filter((p) => p.str.trim() !== '')
  if (used.length === 0) return ''

  const middle = pageWidth / 2
  const left = used.filter((p) => p.x + p.width <= middle)
  const right = used.filter((p) => p.x >= middle)
  const straddle = used.length - left.length - right.length

  const twoColumn = straddle <= used.length * MAX_STRADDLE_SHARE
    && left.length >= used.length * MIN_COLUMN_SHARE
    && right.length >= used.length * MIN_COLUMN_SHARE

  // 1단이면 통째로, 2단이면 왼쪽 단을 다 읽고 오른쪽 단으로 넘어간다.
  // ⚠️ 가운데를 **가로지르는** 조각(머리글·전면 표)도 반드시 담는다. 두 단 어디에도 안
  //    들어가는데 빼 버리면 그 글이 참고 텍스트에서 통째로 사라진다 — 모델에게 덜 주는
  //    것은 물론이고, 대조(verify-text)가 멀쩡한 문항을 '다르다' 고 짚는다.
  //    자리는 맨 앞이다(머리글이 대부분이고, 참고 텍스트는 글자만 쓰지 순서는 안 쓴다)
  const crossing = used.filter((p) => !left.includes(p) && !right.includes(p))
  const groups = twoColumn ? [crossing, left, right] : [used]
  return groups.map(linesOf).filter(Boolean).join('\n')
}

/** 한 단의 조각들을 줄 단위로 묶어 평문으로 */
function linesOf(pieces: readonly TextPiece[]): string {
  // y 는 위로 증가하므로 **내림차순**이 위에서 아래다
  const sorted = [...pieces].sort((a, b) => (b.y - a.y) || (a.x - b.x))

  const lines: TextPiece[][] = []
  for (const piece of sorted) {
    const last = lines[lines.length - 1]
    if (last && Math.abs(last[0].y - piece.y) <= LINE_TOLERANCE) last.push(piece)
    else lines.push([piece])
  }

  return lines
    .map((line) => [...line].sort((a, b) => a.x - b.x).map((p) => p.str).join('').trim())
    .filter(Boolean)
    .join('\n')
}

/**
 * 이 글자 레이어를 믿어도 되는가.
 *
 * ⚠️ **복합기가 붙인 자동 OCR 레이어를 걸러야 한다.** 스캔본에도 글자 레이어가 있을 때가
 *    있는데 그건 우리가 쓰려는 것보다 못한 인식 결과다. 그걸 "정확한 글자" 라고 모델에게
 *    주면 오히려 더 틀린다 — 없느니만 못하다.
 * @param text - 뽑아낸 평문
 * @returns 쓸 만하면 true
 */
export function hasUsableText(text: string): boolean {
  const trimmed = text.replace(/\s/g, '')
  if (trimmed.length < MIN_USABLE_CHARS) return false

  // U+FFFD(깨진 글자)와 사용자 정의 영역(글꼴에 매핑이 없을 때 나온다)
  const broken = (trimmed.match(/[�-]/g) ?? []).length
  return broken <= trimmed.length * MAX_BROKEN_SHARE
}

/**
 * 한 쪽의 글자 레이어를 읽는다.
 * @param pdf - 열어 둔 문서
 * @param page - 1-based 쪽 번호
 * @returns 평문. 글자 레이어가 없거나 못 믿을 값이면 null
 */
export async function extractPageText(
  pdf: PdfDocumentProxy,
  page: number,
): Promise<string | null> {
  try {
    const pdfPage = await pdf.getPage(page)
    const content = await pdfPage.getTextContent()
    const viewport = pdfPage.getViewport({ scale: 1 })

    const pieces: TextPiece[] = []
    for (const item of content.items) {
      // TextMarkedContent 에는 str 이 없다
      if (!('str' in item)) continue
      const transform = item.transform as number[]
      pieces.push({
        str: item.str,
        x: transform[4],
        y: transform[5],
        width: item.width ?? 0,
      })
    }

    // 한글 정규화 — 자모가 갈린 글자가 섞이면 모델이 이상한 글자로 읽는다
    const text = groupTextItems(pieces, viewport.width).normalize('NFC')
    return hasUsableText(text) ? text : null
  } catch {
    // 글자 레이어를 못 읽어도 이미지로는 읽을 수 있다 — 여기서 멈추지 않는다
    return null
  }
}
