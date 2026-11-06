/**
 * 문항·문제집 툴바가 함께 쓰는 단추 모양.
 * @param active - 켜진 단추인가
 * @returns 단추 class
 */
export function toolbarButtonClass(active: boolean): string {
  return `rounded px-2 py-1 text-xs ${active ? 'bg-primary text-white' : 'bg-gray-100 text-gray-700'}`;
}

/** 툴바 고르기 칸 모양 */
export const TOOLBAR_SELECT_CLASS = 'rounded border border-gray-200 bg-white px-1.5 py-1 text-xs text-gray-700';
