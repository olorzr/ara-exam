'use client';

import { useState } from 'react';
import type { Category } from '@/types';
import type { CategoryTreeNode } from '@/lib/category-tree';
import { ChevronRight, ChevronDown, FolderOpen, FileText } from 'lucide-react';
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
  if (nodes.length === 0) {
    return <p className="text-sm text-gray-400 text-center py-4">카테고리가 없습니다.</p>;
  }

  return (
    <div className="space-y-0.5">
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
  depth: number;
}

function TreeNodeItem({
  node, selectedId, onSelect, selectedIds, onToggle, multiSelect, forceExpanded, depth,
}: TreeNodeItemProps) {
  const [collapsed, setCollapsed] = useState(depth >= DEFAULT_EXPANDED_DEPTH);
  // 검색 중에는 사용자가 접어둔 상태를 무시하고 전부 펼친다.
  const expanded = forceExpanded || !collapsed;
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
      setCollapsed(expanded);
    }
  };

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        className={`flex items-center gap-1.5 w-full px-2 py-1.5 rounded-md text-sm transition-colors text-left cursor-pointer ${
          isSelected ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-gray-50'
        }`}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={handleClick}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleClick(); } }}
      >
        {!isLeaf ? (
          expanded
            ? <ChevronDown className="h-4 w-4 shrink-0 text-gray-400" />
            : <ChevronRight className="h-4 w-4 shrink-0 text-gray-400" />
        ) : (
          <span className="w-4 shrink-0" />
        )}

        {multiSelect && isLeaf && node.category && (
          <Checkbox
            checked={!!isChecked}
            onCheckedChange={() => onToggle?.(node.category!.id)}
            onClick={(e) => e.stopPropagation()}
            className="shrink-0"
          />
        )}

        {isLeaf
          ? <FileText className="h-3.5 w-3.5 shrink-0 text-gray-400" />
          : <FolderOpen className="h-3.5 w-3.5 shrink-0 text-amber-400" />
        }

        <span className="truncate">{node.label}</span>
      </div>

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
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}
