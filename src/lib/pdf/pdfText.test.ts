import { describe, it, expect } from 'vitest'
import { groupTextItems, hasUsableText, type TextPiece } from './pdfText'

/** 조각 하나 — y 는 위로 증가한다(PDF 좌표) */
const at = (str: string, x: number, y: number, width = 40): TextPiece => ({ str, x, y, width })

describe('groupTextItems', () => {
  it('한 단은 위에서 아래로 읽는다', () => {
    const text = groupTextItems([at('둘째 줄', 50, 700), at('첫째 줄', 50, 720)], 600)
    expect(text).toBe('첫째 줄\n둘째 줄')
  })

  it('같은 줄의 조각은 왼쪽부터 이어 붙인다', () => {
    const text = groupTextItems([at('나', 90, 700, 20), at('가', 50, 700, 20)], 600)
    expect(text).toBe('가나')
  })

  it('조금 어긋난 높이는 같은 줄로 본다 — 한자 병기·위첨자가 그렇다', () => {
    const text = groupTextItems([at('가', 50, 700, 20), at('(家)', 90, 702, 20)], 600)
    expect(text).toBe('가(家)')
  })

  it('2단 조판은 왼쪽 단을 다 읽고 오른쪽으로 넘어간다 — 문서에 박힌 순서는 다를 수 있다', () => {
    const text = groupTextItems([
      at('왼쪽 위', 50, 700, 100), at('오른쪽 위', 350, 700, 100),
      at('왼쪽 아래', 50, 600, 100), at('오른쪽 아래', 350, 600, 100),
    ], 600)
    expect(text).toBe('왼쪽 위\n왼쪽 아래\n오른쪽 위\n오른쪽 아래')
  })

  it('가운데를 가로지르는 줄이 많으면 1단으로 본다 — 표·머리글이 그렇다', () => {
    const pieces = Array.from({ length: 10 }, (_, i) => at(`줄${i}`, 50, 700 - i * 20, 500))
    const text = groupTextItems(pieces, 600)
    expect(text.split('\n')).toHaveLength(10)
    expect(text.startsWith('줄0')).toBe(true)
  })

  it('가운데를 가로지르는 머리글도 담는다 — 빼면 참고 텍스트에서 통째로 사라진다', () => {
    const text = groupTextItems([
      at('시험지 머리글', 50, 800, 500),
      at('왼쪽 위', 50, 700, 100), at('오른쪽 위', 350, 700, 100),
      at('왼쪽 아래', 50, 600, 100), at('오른쪽 아래', 350, 600, 100),
      at('왼쪽 더', 50, 500, 100), at('오른쪽 더', 350, 500, 100),
      at('왼쪽 또', 50, 400, 100), at('오른쪽 또', 350, 400, 100),
    ], 600)
    expect(text).toContain('시험지 머리글')
    // 단 순서는 그대로다
    expect(text.indexOf('왼쪽 아래')).toBeLessThan(text.indexOf('오른쪽 위'))
  })

  it('한쪽에만 글이 있으면 1단이다', () => {
    const text = groupTextItems([at('가', 50, 700, 20), at('나', 60, 680, 20)], 600)
    expect(text).toBe('가\n나')
  })

  it('빈 조각은 버린다', () => {
    expect(groupTextItems([at('  ', 50, 700), at('글', 50, 680)], 600)).toBe('글')
  })

  it('조각이 없으면 빈 문자열', () => {
    expect(groupTextItems([], 600)).toBe('')
  })
})

describe('hasUsableText', () => {
  const long = (n: number) => '가'.repeat(n)

  it('충분히 길면 쓴다', () => {
    expect(hasUsableText(long(400))).toBe(true)
  })

  it('너무 짧으면 안 쓴다 — 쪽 번호만 박힌 스캔본이 그렇다', () => {
    expect(hasUsableText('3')).toBe(false)
    expect(hasUsableText('')).toBe(false)
  })

  it('깨진 글자가 많으면 안 쓴다 — 복합기 자동 OCR 레이어는 없느니만 못하다', () => {
    expect(hasUsableText(long(300) + '�'.repeat(30))).toBe(false)
  })

  it('깨진 글자가 조금이면 쓴다', () => {
    expect(hasUsableText(long(400) + '�')).toBe(true)
  })
})
