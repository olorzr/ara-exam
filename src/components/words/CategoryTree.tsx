'use client';

import { useState } from 'react';
import type { Category } from '@/types';
import type { CategoryTreeNode } from '@/lib/category-tree';
import { EMPTY_IDS, TreeRow, toggled, treePathKey } from '@/components/tree';
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
  /** 노드가 없을 때 안내 — 찾기 결과가 없을 때 등. 트리는 언마운트하지 않는다(펼침 기억이 지워진다) */
  emptyText?: string;
}

/** 가지의 펼침을 묻고 바꾸는 손잡이 — 트리 전체에 하나(노드마다 상태를 들지 않는다). 열쇠는 조상 경로(`treePathKey`) */
interface Fold {
  isOpen: (id: string, depth: number) => boolean;
  toggle: (id: string) => void;
}

/**
 * 카테고리를 계층 트리 구조로 표시하는 컴포넌트.
 * 단일 선택 또는 체크박스 다중 선택 모드를 지원한다.
 *
 * 펼침은 **트리 전체에서 기본값(깊이)에서 손으로 바꾼 노드 집합**(`flipped`)이다 — `FacetTree` 와 같은 수법.
 * 예전처럼 노드마다 `collapsed` 를 들면 찾기로 걸러지거나 찾는 중 접은 가지 아래 노드가 사라질 때(언마운트) 손으로 편
 * 상태가 지워졌다(코덱스 3R 정지 게이트). 기억의 열쇠는 노드 id 가 아니라 **조상 경로**다(`treePathKey`, 코덱스 4R) —
 * `buildCategoryTree` 의 id 는 이름을 `-` 로 이어 만들어, 출판사 `비상` 의 `1학기` 폴더와 출판사 `비상-1학기` 폴더가
 * 같은 id 가 된다. 한 집합을 쓰면 한쪽을 펼칠 때 다른 쪽도 펼쳐졌다.
 */
export default function CategoryTree({
  nodes, selectedId, onSelect, selectedIds, onToggle, multiSelect, forceExpanded, emptyText = '카테고리가 없습니다.',
}: CategoryTreeProps) {
  const [flipped, setFlipped] = useState<ReadonlySet<string>>(EMPTY_IDS);
  /**
   * 찾는 동안(`forceExpanded`) 접은 가지 — `flipped` 와 따로 둔다(코덱스 2R). 찾는 동안 가지를 누르면 화면은 그대로인데
   * 저장된 펼침이 뒤집혀, 찾기를 지우는 순간 펼쳐 두었던 가지가 접혔다.
   * 걸러진 트리(`nodes`)가 바뀌면 — 찾는 말이 바뀌면 — 비운다(렌더 중 파생 상태).
   */
  const [searchClosed, setSearchClosed] = useState<ReadonlySet<string>>(EMPTY_IDS);
  const searchKey = forceExpanded ? nodes : null;
  const [seenSearchKey, setSeenSearchKey] = useState(searchKey);
  if (seenSearchKey !== searchKey) {
    setSeenSearchKey(searchKey);
    setSearchClosed(EMPTY_IDS);
  }
  const fold: Fold = {
    isOpen: (id, depth) => (forceExpanded
      ? !searchClosed.has(id)
      : (depth < DEFAULT_EXPANDED_DEPTH) !== flipped.has(id)),
    toggle: (id) => {
      if (forceExpanded) setSearchClosed((prev) => toggled(prev, id));
      else setFlipped((prev) => toggled(prev, id));
    },
  };

  if (nodes.length === 0) {
    return <p className="text-sm text-gray-400 text-center py-4">{emptyText}</p>;
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
          fold={fold}
          pathKey={treePathKey('', node.id)}
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
  fold: Fold;
  /** 조상 경로 열쇠 — 펼침 기억에 쓴다 */
  pathKey: string;
  depth: number;
}

function TreeNodeItem({
  node, selectedId, onSelect, selectedIds, onToggle, multiSelect, fold, pathKey, depth,
}: TreeNodeItemProps) {
  // 검색 중에는 손으로 접어 둔 것을 무시하고 전부 펼친다 — 그동안 누른 접기는 찾기용 집합에만 남는다(`fold`)
  const expanded = fold.isOpen(pathKey, depth);
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
    } else {
      fold.toggle(pathKey);
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
              fold={fold}
              pathKey={treePathKey(pathKey, child.id)}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}
