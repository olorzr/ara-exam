'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { buildReferenceGrammarTree } from '@/lib/reference-texts/browse-trees';
import { fetchReferenceTextFacets, type ReferenceFacetRow } from '@/lib/reference-texts/facets';
import { buildReferenceUnitTree } from '@/lib/reference-texts/unit-browse-tree';

/**
 * 작품 전문 왼쪽 패널의 재료 — 모든 전문의 분류 칸과 거기서 나온 트리.
 *
 * 목록 훅(`useReferenceTexts`)과 **따로** 둔다: 목록은 축·검색어로 걸러지고 상한에서 잘리지만
 * 트리는 언제나 전체를 그려야 고를 수 있다. 작품 트리는 정렬 선택이 패널 안에 있어서
 * 패널이 `rows` 로 직접 만든다.
 *
 * ⚠️ 다시 읽다 실패하면 **이전 트리를 남긴다** — 트리가 조금 낡는 편이 통째로 비는 것보다 낫다
 *    (목록은 그와 별개로 그대로 쓸 수 있다).
 */
export function useReferenceTextFacets() {
  const [rows, setRows] = useState<ReferenceFacetRow[]>([]);
  /** 다시 읽기 세대 — 올리면 효과가 다시 돈다 */
  const [generation, setGeneration] = useState(0);

  useEffect(() => {
    let alive = true;
    fetchReferenceTextFacets()
      .then((next) => { if (alive) setRows(next); })
      .catch(() => { /* 이전 트리를 남긴다 — 목록은 그대로 쓸 수 있다 */ });
    return () => { alive = false; };
  }, [generation]);

  const unitTree = useMemo(() => buildReferenceUnitTree(rows), [rows]);
  const grammarTree = useMemo(() => buildReferenceGrammarTree(rows), [rows]);
  const reload = useCallback(() => setGeneration((n) => n + 1), []);

  return { rows, unitTree, grammarTree, reload };
}
