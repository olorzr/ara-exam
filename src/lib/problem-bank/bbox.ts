import { boxToBbox } from '@/lib/problem-ocr/crop';
import type { Bbox } from '@/types/problem-bank';

/**
 * DB 의 `bbox` jsonb 를 화면이 쓰는 정규화 사각형으로 바꾼다.
 *
 * 두 가지 모양이 올 수 있다 — 저장할 때 쓰는 `{column, top, bottom}`(단 번호 + 세로 구간)과
 * 이미 정규화된 `{x, y, w, h}`. 모양을 못 알아보면 null 이고, 그때는 검수 화면이
 * 상자를 안 그릴 뿐 본문은 멀쩡하다.
 * @param raw - DB 에서 읽은 jsonb 값
 * @returns 정규화 사각형. 알아볼 수 없으면 null
 */
export function toBbox(raw: unknown): Bbox | null {
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as Record<string, unknown>;
  if (typeof value.column === 'number' && typeof value.top === 'number' && typeof value.bottom === 'number') {
    return boxToBbox({ column: value.column as 0 | 1 | 2, top: value.top, bottom: value.bottom });
  }
  if (typeof value.x === 'number' && typeof value.y === 'number') {
    return { x: value.x, y: value.y, w: Number(value.w) || 0, h: Number(value.h) || 0 };
  }
  return null;
}
