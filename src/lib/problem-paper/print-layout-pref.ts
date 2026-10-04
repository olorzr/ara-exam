'use client';

/**
 * 문제지 인쇄 방식 선택 (브라우저 전용).
 *
 * 낱장(A4) / 중철 제본(A3 가로 양면). 학원에서 한 번 정하면 계속 같은 방식으로 뽑으므로
 * 매번 고르게 하지 않고 기억한다(`work-tree-pref.ts` 와 같은 규약 — 보는 방법이라 공용 PC 에
 * 남아도 위험하지 않다). 문제지 **저장 설정이 아니다** — 같은 문제지를 낱장으로도 뽑는다.
 */

/** 인쇄 방식 */
export type PaperPrintLayout = 'single' | 'booklet';

/** 처음에는 낱장 — 중철은 A3 프린터가 있어야 한다 */
export const DEFAULT_PAPER_PRINT_LAYOUT: PaperPrintLayout = 'single';

const KEY = 'ara-paper-print-layout';

/**
 * 인쇄 방식 값인가.
 * @param value - 검사할 값
 * @returns 알려진 값이면 true
 */
export function isPaperPrintLayout(value: string): value is PaperPrintLayout {
  return value === 'single' || value === 'booklet';
}

/**
 * 저장된 인쇄 방식을 읽는다.
 * @returns 저장값 (없거나 모르는 값이면 낱장)
 */
export function readPaperPrintLayout(): PaperPrintLayout {
  if (typeof window === 'undefined') return DEFAULT_PAPER_PRINT_LAYOUT;
  try {
    const raw = window.localStorage.getItem(KEY) ?? '';
    return isPaperPrintLayout(raw) ? raw : DEFAULT_PAPER_PRINT_LAYOUT;
  } catch {
    // 시크릿 모드 등에서 localStorage 접근이 막힐 수 있다.
    return DEFAULT_PAPER_PRINT_LAYOUT;
  }
}

/**
 * 인쇄 방식을 저장한다. 모르는 값은 무시한다.
 * @param layout - 저장할 방식
 */
export function writePaperPrintLayout(layout: PaperPrintLayout): void {
  if (typeof window === 'undefined') return;
  if (!isPaperPrintLayout(layout)) return;
  try {
    window.localStorage.setItem(KEY, layout);
  } catch {
    // 저장에 실패해도 이번 화면에서는 고른 대로 보이므로 조용히 넘어간다.
  }
}
