import type { ProblemFilters } from './filters';
import { MOCK_EXAM_SOURCE_TYPE } from './school-exam-tree';
import { WORKBOOK_SOURCE_TYPE } from './source-form';

/**
 * 아카이브 왼쪽 패널의 첫 탭 (순수 함수).
 * school-exam-tree.ts 가 300줄에 닿아 2026-10-28 에 갈라 냈다 — 규칙은 그대로다.
 */

/** 아카이브 왼쪽 패널의 탭 */
export type ArchiveSideTab = 'units' | 'schools' | 'works' | 'grammar';

/**
 * 주소로 들어왔을 때 왼쪽 패널의 첫 탭.
 *
 * 링크를 받아 열었는데 엉뚱한 트리가 켜져 있으면 왜 이 목록인지 알 수 없다 —
 * 걸린 조건을 만든 트리를 보여 준다.
 * @param filters - 주소에서 복원한 필터
 * @returns 켤 탭
 */
export function initialSideTab(
  filters: Pick<ProblemFilters, 'source_type' | 'school_name' | 'unit_path' | 'work_title' | 'grammar_path'>,
): ArchiveSideTab {
  // 문법을 가장 먼저 본다 — 다른 세 축은 위쪽 필터 줄에도 드러나지만, 문법 개념은
  // 트리에서 봐야 어느 가지인지 알 수 있다
  if (filters.grammar_path.length > 0 && filters.unit_path.length === 0) return 'grammar';
  if (filters.work_title && filters.unit_path.length === 0) return 'works';
  // 모의고사·평가문제집은 학교가 없다 — 유형만으로 기출 탭을 켠다(그 트리에 두 가지가 있다)
  const examPicked = Boolean(filters.school_name)
    || filters.source_type === MOCK_EXAM_SOURCE_TYPE || filters.source_type === WORKBOOK_SOURCE_TYPE;
  return examPicked && filters.unit_path.length === 0 ? 'schools' : 'units';
}
