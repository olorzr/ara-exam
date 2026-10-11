'use client';

import { useEffect, useState } from 'react';
import { fetchAreaSets, fetchAreaTree, pickAreaSetForGrade } from '@/lib/problem-bank/area-master';
import type { AreaTreeNode } from '@/lib/problem-bank/area-tree';
import { levelFromGrade } from '@/lib/problem-bank/source-form';
import { fetchUnitTree } from '@/lib/problem-bank/unit-master';
import type { ProblemSource } from '@/types/problem-bank';

/**
 * 트리를 고르는 데 필요한 출처 정보만.
 * 출처의 학기(시험 학기)는 넣지 않는다 — 교과서 단원은 학기로 거르지 않는다(`UnitTreeQuery` 참조).
 */
export type TreeSource = Pick<ProblemSource, 'grade' | 'textbook'>;

/**
 * 저장된 출처로 영역·단원 트리를 읽는다 (검수·편집 화면 공용).
 *
 * 출처에는 학교급 컬럼이 없다 — 학년에서 파생한다(`levelFromGrade`). 학년이 미지정이면
 * 영역 세트는 첫 번째를 쓰고, 단원은 두 학교급에서 같은 이름의 교과서를 모두 본다
 * (`fetchUnitTree` 가 처리한다).
 *
 * ⚠️ 둘 다 fail-soft — 못 읽으면 그 칸이 안 뜰 뿐 검수를 막지 않는다.
 * @param source - 출처. 아직 못 읽었으면 null
 * @returns 영역·단원 트리
 */
export function useSourceTrees(source: TreeSource | null): {
  areaTree: AreaTreeNode[];
  unitTree: AreaTreeNode[];
} {
  const [areaTree, setAreaTree] = useState<AreaTreeNode[]>([]);
  const [unitTree, setUnitTree] = useState<AreaTreeNode[]>([]);

  const grade = source?.grade ?? '';
  const textbook = source?.textbook ?? '';
  const ready = source !== null;

  useEffect(() => {
    if (!ready) return undefined;
    let alive = true;
    fetchAreaSets().then(async (sets) => {
      // 학년이 미지정이면 학교급으로라도 세트를 고른다
      const setId = pickAreaSetForGrade(sets, grade || levelFromGrade(grade) || '');
      const tree = setId ? await fetchAreaTree(setId) : [];
      if (alive) setAreaTree(tree);
    });
    return () => { alive = false; };
  }, [ready, grade]);

  useEffect(() => {
    if (!ready) return undefined;
    let alive = true;
    fetchUnitTree({ grade, textbook })
      .then((tree) => { if (alive) setUnitTree(tree); })
      .catch(() => { if (alive) setUnitTree([]); });
    return () => { alive = false; };
  }, [ready, grade, textbook]);

  return { areaTree, unitTree };
}
