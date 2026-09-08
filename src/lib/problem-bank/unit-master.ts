import { getMajorChapters, getPublishers, getSubChaptersByMajorIds } from '@/lib/category-master';
import { normalizeCategoryName } from '@/lib/category-name';
import type { AreaTreeNode } from './area-tree';
import { buildUnitTree } from './unit-tree';

/**
 * 교과서 단원 마스터 읽기 (카테고리 관리 → 트리).
 *
 * ⚠️ **조회 실패는 fail-soft 다**(영역 마스터와 같은 규약). 못 읽으면 빈 트리가 오고
 *    화면은 단원 칸을 그리지 않을 뿐, 업로드·검수 자체를 막지 않는다.
 */

/** 공백을 전부 없앤 비교 키 — '천재 (정호웅)' ↔ '천재(정호웅)' */
const compareKey = (name: string): string => normalizeCategoryName(name).replace(/\s+/g, '');

/**
 * 이름으로 출판사(=교과서)를 찾는다. 표기 변형(괄호 앞 공백 등)을 흡수한다.
 * @param names - 후보 이름 목록
 * @param target - 찾는 이름
 * @returns 맞는 이름. 없으면 null
 */
export function matchTextbookName(
  names: readonly string[],
  target: string | null | undefined,
): string | null {
  const key = compareKey(target ?? '');
  if (!key) return null;
  return names.find((n) => compareKey(n) === key) ?? null;
}

/** 어느 교과서의 단원을 읽을지 */
export interface UnitTreeQuery {
  /** '중1'~'고3'. '' 면 두 학교급의 같은 이름 교과서를 모두 본다 */
  grade: string;
  /** '1학기' | '2학기' | '' (''=두 학기 모두) */
  semester: string;
  /** 교과서 이름(= exam.publishers.name). '' 면 트리를 만들지 않는다 */
  textbook: string;
}

/**
 * 교과서 단원 트리를 읽는다.
 * @param query - 학년·학기·교과서
 * @returns 대단원 › 소단원 트리. 교과서를 안 골랐거나 못 읽으면 빈 배열
 */
export async function fetchUnitTree(query: UnitTreeQuery): Promise<AreaTreeNode[]> {
  const { grade, semester, textbook } = query;
  if (!textbook.trim()) return [];

  try {
    // 학교급을 모를 때(학년 미지정)는 두 급에서 같은 이름을 모두 찾는다 —
    // 출판사 이름은 급 안에서만 유일하다(UNIQUE (name, level)).
    const publishers = await getPublishers();
    const key = compareKey(textbook);
    const matched = publishers.filter((p) => compareKey(p.name) === key);
    if (matched.length === 0) return [];

    const majors = (await Promise.all(
      matched.map((p) => getMajorChapters(p.id, grade || undefined, semester || undefined)),
    )).flat();
    if (majors.length === 0) return [];

    const subs = await getSubChaptersByMajorIds(majors.map((m) => m.id));
    return buildUnitTree(majors, subs);
  } catch {
    // 단원 칸이 안 뜰 뿐 업로드·검수는 계속돼야 한다
    return [];
  }
}
