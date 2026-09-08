import { naturalCompare } from '@/lib/category-tree';
import { areaPathLabel, type AreaTreeNode } from './area-tree';
import type { MajorChapter, SubChapter } from '@/types';

/**
 * 교과서 단원 트리 (순수 함수).
 *
 * 마스터는 이 앱의 **카테고리 관리**(`exam.publishers › major_chapters › sub_chapters`)다.
 * 관리자시스템의 '교과서' 탭은 이걸 매일 밤 복사한 사본이라 정본이 아니다.
 *
 * ⚠️ 영역 분류(`area-tree.ts`)와 **같은 노드 모양**을 쓴다 — 그래야 `optionsAt`·
 *    `longestKnownPrefix` 와 `AreaPathPicker` 를 그대로 재사용할 수 있다.
 * ⚠️ 태깅은 노드 id 가 아니라 **이름 경로 스냅샷**(`unit_path`)으로 저장한다.
 */

/** 단원은 대단원·소단원 두 단계다 */
export const UNIT_DEPTH_MAX = 2;

/** 단계 라벨 — 화면의 열 제목이 공유하는 단일 출처 */
export const UNIT_DEPTH_LABELS = ['대단원', '소단원'] as const;

/**
 * 단원 경로를 한 줄로 보여 준다.
 * @param path - 이름 경로
 * @returns '2. 문학의 갈래 > (1) 시의 화자'
 */
export const unitPathLabel = areaPathLabel;

/**
 * 대단원·소단원 마스터 행을 트리로 만든다.
 *
 * 같은 교과서가 1·2학기로 나뉘어 있을 때 학기를 안 고르면 두 학기가 함께 온다 —
 * **이름이 같은 대단원은 하나로 합친다**(학기는 출처 행에 이미 있고, 단원 이름은
 * 교과서 안에서 유일하다).
 * @param majors - 대단원 행
 * @param subs - 그 대단원들의 소단원 행
 * @returns 이름순 트리 ('10. …' 이 '2. …' 뒤에 온다)
 */
export function buildUnitTree(majors: MajorChapter[], subs: SubChapter[]): AreaTreeNode[] {
  const byName = new Map<string, { node: AreaTreeNode; ids: Set<string> }>();

  for (const major of majors) {
    const name = major.name.trim();
    if (!name) continue;
    const hit = byName.get(name);
    if (hit) {
      hit.ids.add(major.id);
      continue;
    }
    byName.set(name, {
      node: { id: major.id, name, children: [] },
      ids: new Set([major.id]),
    });
  }

  for (const entry of byName.values()) {
    const seen = new Set<string>();
    for (const sub of subs) {
      if (!entry.ids.has(sub.major_chapter_id)) continue;
      const name = sub.name.trim();
      if (!name || seen.has(name)) continue;
      seen.add(name);
      entry.node.children.push({ id: sub.id, name, children: [] });
    }
    entry.node.children.sort((a, b) => naturalCompare(a.name, b.name));
  }

  return [...byName.values()]
    .map((e) => e.node)
    .sort((a, b) => naturalCompare(a.name, b.name));
}
