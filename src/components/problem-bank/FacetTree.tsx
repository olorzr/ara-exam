'use client';

import { useMemo, useState } from 'react';
import { EMPTY_IDS, TreeRow, TreeSearch, toggled, treePathKey } from '@/components/tree';
import { filterFacetTree } from '@/lib/problem-bank/facet-tree';
import type { FacetTreeNode } from '@/lib/problem-bank/school-exam-tree';

/** 이 깊이 미만의 노드는 기본으로 펼쳐 둔다 (CategoryTree 와 같은 값) */
const DEFAULT_EXPANDED_DEPTH = 2;

interface FacetTreeProps<T> {
  nodes: FacetTreeNode<T>[];
  /** 강조할 잎의 id */
  selectedId?: string;
  onSelect: (value: T) => void;
  emptyText?: string;
  /**
   * 이 깊이 미만까지 펼쳐 둔다. 기본 2.
   * 마스터 전체를 그리는 문법 트리는 1 을 준다 — 2 면 첫 화면에 100줄이 넘게 쏟아진다.
   * 기출 트리도 1 이다(학교까지만 보이고 학년도부터는 접힌다 — 2026-10-10 사용자 요청).
   */
  defaultExpandedDepth?: number;
  /** 있으면 트리 위에 이름 찾기 칸(이 글이 자리표시·칸 이름). 찾는 동안은 남은 가지를 다 펼친다 */
  searchPlaceholder?: string;
}

/**
 * 아무 값이나 잎에 달 수 있는 폴더 트리 — 줄 모양은 `TreeRow`(기출 공유 사이트 트리와 같은 결, 2026-11-14).
 *
 * 카테고리 트리(`components/words/CategoryTree`)와 **보이는 모양이 같다**(같은 `TreeRow`). 다만 그쪽은 잎 값이
 * `Category` 로 못 박혀 있고 단어·시험·개념지 화면이 함께 쓰므로, 제네릭으로 고치는 대신 이 작은 형제를 둔다.
 *
 * 펼침은 **기본값(깊이)에서 손으로 바꾼 노드만** 기억한다(`flipped`). 노드마다 상태를 들면 찾기로 걸러졌다 돌아온
 * 가지가 처음 모양으로 되돌아가고, 열린 노드 목록을 들면 늦게 온 노드(패싯을 받은 뒤)가 다 접힌 채 나온다.
 */
export default function FacetTree<T>({
  nodes, selectedId, onSelect, emptyText, defaultExpandedDepth = DEFAULT_EXPANDED_DEPTH, searchPlaceholder,
}: FacetTreeProps<T>) {
  const [flipped, setFlipped] = useState<ReadonlySet<string>>(() => new Set());
  const [query, setQuery] = useState('');
  /**
   * 찾는 동안 접은 가지 — `flipped` 와 따로 둔다(코덱스 1R). 찾는 동안 가지를 눌러 `flipped` 를 뒤집으면 화면은
   * 그대로(찾는 중엔 다 펼친다)인데 찾기를 지우는 순간 처음엔 접혀 있던 가지가 펼쳐진 채 남았다.
   * ⚠️ 찾는 말이 **바뀔 때마다 실제로 비운다**(`changeQuery`, 코덱스 2R) — 찾는 말에 묶어 두고 무시만 하면 지웠다가
   * 같은 말을 다시 치는 순간 옛 접힘이 되살아나 결과가 숨었다.
   */
  const [searchClosed, setSearchClosed] = useState<ReadonlySet<string>>(EMPTY_IDS);
  const searching = query.trim() !== '';
  const shown = useMemo(() => filterFacetTree(nodes, query), [nodes, query]);

  const changeQuery = (next: string) => {
    setQuery(next);
    setSearchClosed(EMPTY_IDS);
  };

  const toggle = (id: string) => {
    if (searching) setSearchClosed((prev) => toggled(prev, id));
    else setFlipped((prev) => toggled(prev, id));
  };

  const isOpen = (id: string, depth: number) => (searching
    ? !searchClosed.has(id)
    : (depth < defaultExpandedDepth) !== flipped.has(id));

  // 펼침 기억의 열쇠는 조상 경로다 — 빌더가 id 를 이름 이어 붙이기로 만들면 다른 자리끼리 겹칠 수 있다(코덱스 4R, CategoryTree)
  const renderNodes = (list: readonly FacetTreeNode<T>[], depth: number, parentKey: string) => list.map((node) => {
    const pathKey = treePathKey(parentKey, node.id);
    const hasKids = node.children.length > 0;
    const expanded = hasKids && isOpen(pathKey, depth);
    const isLeaf = !hasKids && node.value !== undefined;
    const activate = () => {
      if (isLeaf) onSelect(node.value as T);
      else toggle(pathKey);
    };
    return (
      <div key={node.id}>
        <TreeRow
          depth={depth}
          label={node.label}
          count={node.count}
          expanded={hasKids ? expanded : undefined}
          selected={isLeaf && selectedId === node.id}
          dimmed={node.dimmed}
          onActivate={activate}
        />
        {expanded && <div>{renderNodes(node.children, depth + 1, pathKey)}</div>}
      </div>
    );
  });

  const empty = nodes.length === 0;
  return (
    <div>
      {searchPlaceholder && !empty && <TreeSearch value={query} onChange={changeQuery} placeholder={searchPlaceholder} />}
      {shown.length > 0
        ? <div>{renderNodes(shown, 0, '')}</div>
        : (
          <p className="px-2 py-4 text-center text-sm text-gray-400">
            {empty ? (emptyText ?? '항목이 없습니다.') : '찾는 이름이 없어요.'}
          </p>
        )}
    </div>
  );
}
