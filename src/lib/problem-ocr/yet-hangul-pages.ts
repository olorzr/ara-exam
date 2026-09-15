import {
  hasUnconvertedNotation, hasYetHangul, UNCONVERTED_NOTATION_WARNING, yetHangulPageWarning,
} from '@/lib/yet-hangul';
import type { OcrItem } from './schema';
import type { DraftWarning } from './warnings';

/**
 * 옛한글이 든 쪽을 모은다 (순수 함수).
 *
 * 왜 **쪽 단위**인가: 중세국어 시험지는 거의 모든 항목에 옛 글자가 있다. 항목마다 경고를
 * 붙이면 상한(`OCR_MAX_WARNINGS` 20)을 그것만으로 채워 빠진 쪽·못 읽은 선지 같은
 * 진짜 경고가 밀려난다. 쪽 하나에 한 줄이면 "이 쪽을 눈으로 보라" 는 뜻이 그대로 전해진다.
 */

/** 이 항목의 글자가 담긴 자리 모두 — 발문·지문·선지 */
function textsOf(item: OcrItem): string[] {
  return [item.html, item.stem_html, ...item.choices];
}

/**
 * 옛한글이 보이는 쪽 번호를 오름차순으로 모은다.
 * @param items - 검증을 마친 항목들
 * @returns 쪽 번호 (중복 없음)
 */
export function yetHangulPages(items: readonly OcrItem[]): number[] {
  const pages = new Set<number>();
  for (const item of items) {
    if (textsOf(item).some(hasYetHangul)) pages.add(item.page);
  }
  return [...pages].sort((a, b) => a - b);
}

/**
 * 대체 표기를 자모로 못 바꾼 항목의 경고 — 없으면 null.
 *
 * ⚠️ **그 항목을 보는 자리에서 바로 넣어야 한다**(코덱스 리뷰 6R). 끝에 몰아 넣으면 경고
 *    상한(`OCR_MAX_WARNINGS`)을 뒤 항목들이 먼저 채워, 정작 고쳐야 할 이 경고가 잘린다.
 * @param item - 검증을 마친 항목
 * @returns 파서 경고 또는 null
 */
export function notationWarning(item: OcrItem): DraftWarning | null {
  if (!textsOf(item).some(hasUnconvertedNotation)) return null;
  const { ref, kind, page, number } = item;
  // ⚠️ `critical` — 상한이 차도 버리지 않는다(코덱스 리뷰). 못 바꾼 표기는 **틀린 글자가
  //    그대로 인쇄되는** 자리라, 경고가 잘리면 검수 카드에 아무 표시 없이 남는다
  return { ref, kind, page, number, critical: true, message: UNCONVERTED_NOTATION_WARNING };
}

/**
 * 옛한글이 있는 쪽마다의 알림 — 항목을 다 추린 **뒤**에 한 번 모은다.
 * @param items - 살아남은 항목들
 * @returns 쪽 단위 경고 목록
 */
export function yetHangulPageWarnings(items: readonly OcrItem[]): DraftWarning[] {
  // 대조 검증을 건너뛴 쪽이라 사람 눈이 유일한 안전망이다 — 상한에 밀리면 안 된다
  return yetHangulPages(items).map((page) => ({
    page, critical: true, message: yetHangulPageWarning(page),
  }));
}
