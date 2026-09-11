'use client';

import { useMemo } from 'react';
import FacetTree from '@/components/problem-bank/FacetTree';
import { GRAMMAR_AXIS_CLEARED, type ProblemFilters } from '@/lib/problem-bank/filters';
import {
  buildGrammarBrowseTree, grammarFilterPatch, grammarNodeKey,
} from '@/lib/problem-bank/grammar-browse-tree';

/** 대분류만 펼쳐 둔다 — 2 면 중분류까지 열려 첫 화면에 100줄이 넘게 쏟아진다 */
const GRAMMAR_EXPANDED_DEPTH = 1;

interface GrammarTreePanelProps {
  filters: ProblemFilters;
  /** 경로별 문항 수 — 트리는 마스터로 그리고 여기서 건수만 얹는다 */
  counts: ReadonlyMap<string, number>;
  onChange: (patch: Partial<ProblemFilters>) => void;
}

/**
 * 문법 개념으로 훑어보는 왼쪽 트리.
 *
 * **대분류 › 중분류 › 개념** 순이고 교재 목차 순서를 따른다. 다른 세 트리와 달리
 * **마스터 전체**를 그려서 아직 문항이 없는 개념도 흐리게 보인다 — 그 까닭은
 * [grammar-browse-tree.ts](../../lib/problem-bank/grammar-browse-tree.ts) 에 있다.
 *
 * ⚠️ 다른 패널들과 달리 **방금 누른 잎을 state 로 들고 있지 않다.** 그쪽은 노드 키가
 *    조건으로 온전히 복원되지 않아(같은 이름의 단원, `''`↔`'__none__'` 변환) 따로 기억해야
 *    하지만, 문법은 고른 경로가 곧 `filters.grammar_path` 라 렌더에서 파생하면 된다.
 *    위쪽 필터 줄에서 축을 바꿔도 강조가 저절로 따라온다.
 */
export default function GrammarTreePanel({ filters, counts, onChange }: GrammarTreePanelProps) {
  const nodes = useMemo(() => buildGrammarBrowseTree(counts), [counts]);
  const selectedId = filters.grammar_path.length > 0
    ? grammarNodeKey(filters.grammar_path)
    : undefined;

  return (
    <div className="rounded-lg border border-gray-200 p-2">
      <div className="flex items-center justify-between px-2 py-1">
        <p className="text-xs font-medium text-gray-500">문법 개념</p>
        {filters.grammar_path.length > 0 && (
          <button
            type="button"
            className="text-xs text-primary underline underline-offset-2"
            onClick={() => onChange({ ...GRAMMAR_AXIS_CLEARED, page: 0 })}
          >
            해제
          </button>
        )}
      </div>
      <p className="px-2 pb-1 text-[11px] leading-snug text-gray-400">
        아직 문항이 없는 개념도 흐리게 보여 줍니다. 골라 둔 뒤 아카이브에서 문항을 고르면
        문법 분류를 한 번에 붙일 수 있어요.
      </p>
      <div className="max-h-[70vh] overflow-y-auto">
        <FacetTree
          nodes={nodes}
          onSelect={(path) => onChange(grammarFilterPatch(path))}
          selectedId={selectedId}
          defaultExpandedDepth={GRAMMAR_EXPANDED_DEPTH}
        />
      </div>
    </div>
  );
}
