'use client';

import { useState } from 'react';
import type { Category } from '@/types';
import type { CategoryTreeNode } from '@/lib/category-tree';
import { EMPTY_IDS, TreeRow, toggled } from '@/components/tree';
import { Checkbox } from '@/components/ui/checkbox';

/** 이 깊이 미만의 노드는 기본으로 펼쳐 둔다 */
const DEFAULT_EXPANDED_DEPTH = 2;

interface CategoryTreeProps {
  nodes: CategoryTreeNode[];
  selectedId?: string;
  onSelect?: (category: Category) => void;
  selectedIds?: string[];
  onToggle?: (categoryId: string) => void;
  multiSelect?: boolean;
  /** 모든 노드를 펼친 상태로 렌더한다(검색 결과 표시용) */
  forceExpanded?: boolean;
}

/**
 * 카테고리를 계층 트리 구조로 표시하는 컴포넌트.
 * 단일 선택 또는 체크박스 다중 선택 모드를 지원한다.
 */
export default function CategoryTree({
  nodes, selectedId, onSelect, selectedIds, onToggle, multiSelect, forceExpanded,
}: CategoryTreeProps) {
  /**
   * 찾는 동안(`forceExpanded`) 접은 가지 — 노드마다의 펼침과 따로 둔다(코덱스 2R). 찾는 동안 가지를 누르면 화면은
   * 그대로인데 노드의 `collapsed` 가 뒤집혀, 찾기를 지우는 순간 펼쳐 두었던 가지가 접혔다.
   * 걸러진 트리(`nodes`)가 바뀌면 — 찾는 말이 바뀌면 — 비운다(렌더 중 파생 상태).
   */
  const [searchClosed, setSearchClosed] = useState<ReadonlySet<string>>(EMPTY_IDS);
  const searchKey = forceExpanded ? nodes : null;
  const [seenSearchKey, setSeenSearchKey] = useState(searchKey);
  if (seenSearchKey !== searchKey) {
    setSeenSearchKey(searchKey);
    setSearchClosed(EMPTY_IDS);
  }
  const onSearchToggle = (id: string) => setSearchClosed((prev) => toggled(prev, id));

  if (nodes.length === 0) {
    return <p className="text-sm text-gray-400 text-center py-4">카테고리가 없습니다.</p>;
  }

  return (
    <div>
      {nodes.map((node) => (
        <TreeNodeItem
          key={node.id}
          node={node}
          selectedId={selectedId}
          onSelect={onSelect}
          selectedIds={selectedIds}
          onToggle={onToggle}
          multiSelect={multiSelect}
          forceExpanded={forceExpanded}
          searchClosed={searchClosed}
          onSearchToggle={onSearchToggle}
          depth={0}
        />
      ))}
    </div>
  );
}

interface TreeNodeItemProps {
  node: CategoryTreeNode;
  selectedId?: string;
  onSelect?: (cat: Category) => void;
  selectedIds?: string[];
  onToggle?: (catId: string) => void;
  multiSelect?: boolean;
  forceExpanded?: boolean;
  /** 찾는 동안 접은 가지(트리 전체에 하나) */
  searchClosed: ReadonlySet<string>;
  onSearchToggle: (id: string) => void;
  depth: number;
}

function TreeNodeItem({
  node, selectedId, onSelect, selectedIds, onToggle, multiSelect, forceExpanded, searchClosed, onSearchToggle, depth,
}: TreeNodeItemProps) {
  const [collapsed, setCollapsed] = useState(depth >= DEFAULT_EXPANDED_DEPTH);
  // 검색 중에는 사용자가 접어둔 상태를 무시하고 전부 펼친다 — 그동안 누른 접기는 찾기용 집합에만 남는다
  const expanded = forceExpanded ? !searchClosed.has(node.id) : !collapsed;
  const isLeaf = node.children.length === 0;
  const isSelected = node.category && selectedId === node.category.id;
  const isChecked = node.category && selectedIds?.includes(node.category.id);

  const handleClick = () => {
    if (isLeaf && node.category) {
      if (multiSelect && onToggle) {
        onToggle(node.category.id);
      } else if (onSelect) {
        onSelect(node.category);
      }
    } else if (forceExpanded) {
      onSearchToggle(node.id);
    } else {
      setCollapsed(expanded);
    }
  };

  return (
    <div>
      {/* 줄 모양은 FacetTree 와 같은 `TreeRow`(기출 공유 사이트 트리 결, 2026-11-14) — 폴더·문서 그림은 걷었다 */}
      <TreeRow
        depth={depth}
        label={node.label}
        expanded={!isLeaf ? expanded : undefined}
        selected={!!isSelected}
        onActivate={handleClick}
        leading={multiSelect && isLeaf && node.category ? (
          <Checkbox
            checked={!!isChecked}
            onCheckedChange={() => onToggle?.(node.category!.id)}
            onClick={(e) => e.stopPropagation()}
            className="mr-1 shrink-0"
          />
        ) : undefined}
      />

      {expanded && node.children.length > 0 && (
        <div>
          {node.children.map((child) => (
            <TreeNodeItem
              key={child.id}
              node={child}
              selectedId={selectedId}
              onSelect={onSelect}
              selectedIds={selectedIds}
              onToggle={onToggle}
              multiSelect={multiSelect}
              forceExpanded={forceExpanded}
              searchClosed={searchClosed}
              onSearchToggle={onSearchToggle}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}
