'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight, FileText, FolderOpen } from 'lucide-react';
import type { FacetTreeNode } from '@/lib/problem-bank/school-exam-tree';

/** 이 깊이 미만의 노드는 기본으로 펼쳐 둔다 (CategoryTree 와 같은 값) */
const DEFAULT_EXPANDED_DEPTH = 2;

interface FacetTreeProps<T> {
  nodes: FacetTreeNode<T>[];
  /** 강조할 잎의 id */
  selectedId?: string;
  onSelect: (value: T) => void;
  emptyText?: string;
}

/**
 * 아무 값이나 잎에 달 수 있는 폴더 트리.
 *
 * 카테고리 트리(`components/words/CategoryTree`)와 **보이는 모양이 같다** — 선생님이
 * 이미 아는 조작이라서다. 다만 그쪽은 잎 값이 `Category` 로 못 박혀 있고 단어·시험·개념지
 * 네 화면이 함께 쓰므로, 제네릭으로 고치는 대신 이 작은 형제를 둔다.
 */
export default function FacetTree<T>({
  nodes, selectedId, onSelect, emptyText,
}: FacetTreeProps<T>) {
  if (nodes.length === 0) {
    return <p className="py-4 text-center text-sm text-gray-400">{emptyText ?? '항목이 없습니다.'}</p>;
  }

  return (
    <div className="space-y-0.5">
      {nodes.map((node) => (
        <FacetTreeItem
          key={node.id}
          node={node}
          selectedId={selectedId}
          onSelect={onSelect}
          depth={0}
        />
      ))}
    </div>
  );
}

interface FacetTreeItemProps<T> {
  node: FacetTreeNode<T>;
  selectedId?: string;
  onSelect: (value: T) => void;
  depth: number;
}

function FacetTreeItem<T>({ node, selectedId, onSelect, depth }: FacetTreeItemProps<T>) {
  const [collapsed, setCollapsed] = useState(depth >= DEFAULT_EXPANDED_DEPTH);
  const expanded = !collapsed;
  const isLeaf = node.children.length === 0 && node.value !== undefined;
  const isSelected = isLeaf && selectedId === node.id;

  const handleClick = () => {
    if (isLeaf) onSelect(node.value as T);
    else setCollapsed(expanded);
  };

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        className={`flex w-full cursor-pointer items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-sm transition-colors ${
          isSelected ? 'bg-primary/10 font-medium text-primary' : 'hover:bg-gray-50'
        }`}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={handleClick}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleClick();
          }
        }}
      >
        {node.children.length > 0 ? (
          expanded
            ? <ChevronDown className="h-4 w-4 shrink-0 text-gray-400" />
            : <ChevronRight className="h-4 w-4 shrink-0 text-gray-400" />
        ) : (
          <span className="w-4 shrink-0" />
        )}

        {isLeaf
          ? <FileText className="h-3.5 w-3.5 shrink-0 text-gray-400" />
          : <FolderOpen className="h-3.5 w-3.5 shrink-0 text-amber-400" />}

        <span className="truncate">{node.label}</span>
      </div>

      {expanded && node.children.length > 0 && (
        <div>
          {node.children.map((child) => (
            <FacetTreeItem
              key={child.id}
              node={child}
              selectedId={selectedId}
              onSelect={onSelect}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}
