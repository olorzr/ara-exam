'use client';

/**
 * 문제지 인쇄 선택 (브라우저 전용) — 인쇄 방식과 '묻는 작품만 인쇄'.
 *
 * 학원에서 한 번 정하면 계속 같은 방식으로 뽑으므로 매번 고르게 하지 않고 기억한다
 * (`work-tree-pref.ts` 와 같은 규약 — 보는 방법이라 공용 PC 에 남아도 위험하지 않다).
 * 문제지 **저장 설정이 아니다** — 같은 문제지를 낱장으로도, 지문 전체로도 뽑는다.
 */

/** 인쇄 방식 */
export type PaperPrintLayout = 'single' | 'booklet';

/** 처음에는 낱장 — 중철은 A3 프린터가 있어야 한다 */
export const DEFAULT_PAPER_PRINT_LAYOUT: PaperPrintLayout = 'single';

/**
 * '복합 지문은 묻는 작품만 인쇄' 의 처음 값 — **켜짐**(사용자 결정 2026-10-11).
 * 그 작품만 묻는 문항을 골라 담았다면 다른 작품까지 찍히는 것은 대개 원하지 않는다.
 */
export const DEFAULT_PAPER_TRIM_WORKS = true;

const LAYOUT_KEY = 'ara-paper-print-layout';
const TRIM_WORKS_KEY = 'ara-paper-trim-works';

/**
 * 저장값을 읽는다 — 없거나 저장소에 못 닿으면 null.
 * @param key - localStorage 키
 * @returns 저장된 글자 또는 null
 */
function readRaw(key: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    // 시크릿 모드 등에서 localStorage 접근이 막힐 수 있다.
    return null;
  }
}

/**
 * 값을 저장한다. 실패해도 이번 화면에서는 고른 대로 보이므로 조용히 넘어간다.
 * @param key - localStorage 키
 * @param value - 저장할 글자
 */
function writeRaw(key: string, value: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // 저장소가 막혔다 — 다음에 열면 처음 값으로 돌아갈 뿐이다
  }
}

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
  const raw = readRaw(LAYOUT_KEY) ?? '';
  return isPaperPrintLayout(raw) ? raw : DEFAULT_PAPER_PRINT_LAYOUT;
}

/**
 * 인쇄 방식을 저장한다. 모르는 값은 무시한다.
 * @param layout - 저장할 방식
 */
export function writePaperPrintLayout(layout: PaperPrintLayout): void {
  if (!isPaperPrintLayout(layout)) return;
  writeRaw(LAYOUT_KEY, layout);
}

/**
 * 저장된 '묻는 작품만 인쇄' 를 읽는다.
 * @returns 저장값 (없거나 모르는 값이면 켜짐)
 */
export function readPaperTrimWorks(): boolean {
  const raw = readRaw(TRIM_WORKS_KEY);
  if (raw === '1') return true;
  if (raw === '0') return false;
  return DEFAULT_PAPER_TRIM_WORKS;
}

/**
 * '묻는 작품만 인쇄' 를 저장한다.
 * @param on - 켤지
 */
export function writePaperTrimWorks(on: boolean): void {
  writeRaw(TRIM_WORKS_KEY, on ? '1' : '0');
}
