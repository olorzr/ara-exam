import type { Passage, Problem, ProblemSource } from '@/types/problem-bank';
import { sourcePagePath } from './storage-paths';

/**
 * 읽기 전용 시험 보기가 서명할 저장소 경로 (순수 함수).
 *
 * 문항·지문 탭과 원본 탭이 **따로** 서명한다 — 원본 탭은 쪽 이미지가 수십 장이라 그 탭을 열 때만 받는다.
 */

/** 그림에 필요한 칸 */
type WithImages = Pick<Passage | Problem, 'figure_paths' | 'image_path' | 'render_mode'>;

/**
 * 문항·지문 탭의 그림 경로 — 본문 그림 전부와, 이미지로 출제한 항목의 원본 그림.
 *
 * 이미지 출제가 아닌 항목의 `image_path`(잘라 둔 원본)는 넣지 않는다 — 그 탭은 글로 그리고, 원본은 원본 탭에서 본다.
 * @param items - 지문과 문항
 * @returns 중복 없는 경로들
 */
export function examImagePaths(items: readonly WithImages[]): string[] {
  const out = new Set<string>();
  for (const item of items) {
    for (const path of item.figure_paths ?? []) if (path) out.add(path);
    if (item.render_mode === 'image' && item.image_path) out.add(item.image_path);
  }
  return [...out];
}

/**
 * 원본 쪽 이미지 경로 — 1쪽부터 `page_count` 쪽까지.
 * @param source - 출처
 * @returns 경로들 (쪽 수가 없으면 빈 배열)
 */
export function sourcePagePaths(source: Pick<ProblemSource, 'id' | 'page_count'>): string[] {
  const count = Number.isInteger(source.page_count) && source.page_count > 0 ? source.page_count : 0;
  return Array.from({ length: count }, (_, i) => sourcePagePath(source.id, i + 1));
}

/**
 * 답지 파일이 PDF 인가 — 적재 도구는 PDF·JPEG 둘 다 올린다(2026-11-13 운영은 전부 PDF).
 * @param path - 저장소 경로
 * @returns PDF 면 true
 */
export function isPdfPath(path: string): boolean {
  return path.toLowerCase().endsWith('.pdf');
}
