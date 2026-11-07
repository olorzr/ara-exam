import { bookletBlankCount } from '@/lib/print/booklet';
import type { PaperCover } from './cover';
import type { PaperPrintLayout } from './print-layout-pref';

/**
 * 중철에서 '뒷표지만 빼면 딱 맞는' 경우를 가른다 (순수 계산).
 *
 * 책자의 쪽 수 = 본문 + 앞표지 1 + 뒷표지 1. 본문이 3·7·11…쪽이면 앞표지만 있을 때 정확히 4의 배수인데,
 * 뒷표지가 붙어 빈 면 셋이 생기고 A3 도 한 장 더 든다. 그때 화면이 '뒷표지 없애기' 를 먼저 권한다
 * (2026-11-07 원장 요청 "뒷표지만 없으면 딱 들어갈 땐 선생님한테 알림 뜨게 하고, 우선적으로 뒷표지 없애는걸 추천").
 */

/**
 * 뒷표지 때문에만 빈 면이 생기는가 — 앞·뒷표지를 다 붙이면 빈 면이 있고, 앞표지만이면 빈 면이 없다.
 * @param bodyPages - 본문 쪽 수 (표지를 뺀 값, `A4Document` 의 `onLayout` 이 알린 `pageCount`)
 * @returns 뒷표지만 빼면 빈 면 없이 맞는가 (0 이상 정수가 아니면 false)
 */
export function backCoverOnlyBlanks(bodyPages: number): boolean {
  if (!Number.isInteger(bodyPages) || bodyPages < 0) return false;
  return bookletBlankCount(bodyPages + 2) > 0 && bookletBlankCount(bodyPages + 1) === 0;
}

/** 권하기를 판단할 재료 */
export interface BackCoverAdviceInput {
  /** 고른 인쇄 방식 — 번호 어긋남 확인 전이라 낱장으로 그리는 중이어도 고른 값으로 본다(인쇄 전에 고칠 수 있게) */
  printLayout: PaperPrintLayout;
  /** 지금 표지 (없으면 null) */
  cover: PaperCover | null;
  /** 표지를 읽지 못했는가 — 그때는 표지 자리에 안내 한 장만 그려 뒷표지가 없다 */
  coverUnknown: boolean;
  /** 지금 보는 판의 본문 쪽 수 (아직 못 쟀으면 null) */
  bodyPages: number | null;
}

/**
 * '뒷표지 없애기' 를 권할 때인가.
 * @param input - 인쇄 방식·표지·본문 쪽 수
 * @returns 중철이고 뒷표지가 있으며 뒷표지만 빼면 빈 면이 없을 때 true
 */
export function adviseDropBackCover({ printLayout, cover, coverUnknown, bodyPages }: BackCoverAdviceInput): boolean {
  if (printLayout !== 'booklet' || coverUnknown || bodyPages === null) return false;
  if (!cover || cover.backKind === 'none') return false;
  return backCoverOnlyBlanks(bodyPages);
}

/**
 * 뒷표지를 뺀 표지 — 앞표지는 그대로다(그림 앞표지도 경로를 그대로 써서 다시 올리지 않는다).
 * @param cover - 지금 표지
 * @returns 뒷표지가 없는 표지
 */
export function coverWithoutBack(cover: PaperCover): PaperCover {
  return { ...cover, backKind: 'none', backImagePath: '' };
}
