'use client';

import { useState, type ReactNode } from 'react';
import { Plus, Pencil, Trash2, Check, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface MasterItem {
  id: string;
  name: string;
}

interface MasterListPanelProps {
  title: string;
  items: MasterItem[];
  selectedId?: string;
  onSelect?: (id: string) => void;
  /** 없으면 추가 칸을 아예 그리지 않는다 (읽기 전용 패널) */
  onAdd?: (name: string) => Promise<void>;
  /** 없으면 수정 버튼을 그리지 않는다 */
  onEdit?: (id: string, name: string) => Promise<void>;
  /** 없으면 삭제 버튼을 그리지 않는다 */
  onDelete?: (id: string) => Promise<void>;
  placeholder?: string;
  disabled?: boolean;
  emptyMessage?: string;
  /** 제목 아래 한 줄 안내 (예: 이 목록은 다른 시스템이 관리한다) */
  note?: ReactNode;
}

/**
 * 마스터 데이터 목록을 표시하고 추가/수정/삭제를 제공하는 패널 컴포넌트.
 *
 * ⚠️ 세 핸들러는 **선택 사항**이다. 없으면 그 버튼·입력칸을 아예 그리지 않는다 —
 *    아무 일도 안 하는 no-op 핸들러를 넘기지 말 것. 버튼이 남아 있는데 눌러도 조용한 것이
 *    가장 나쁘다(학교 목록처럼 다른 시스템이 주인인 마스터가 이 모양이다).
 */
export default function MasterListPanel({
  title, items, selectedId, onSelect, onAdd, onEdit, onDelete,
  placeholder = '이름 입력', disabled, emptyMessage = '항목이 없습니다', note,
}: MasterListPanelProps) {
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const handleAdd = async () => {
    if (!onAdd || !newName.trim()) return;
    await onAdd(newName.trim());
    setNewName('');
  };

  const handleEditSave = async () => {
    if (!onEdit || !editingId || !editName.trim()) return;
    await onEdit(editingId, editName.trim());
    setEditingId(null);
  };

  const handleDelete = async (id: string) => {
    if (!onDelete) return;
    if (!confirm('삭제하시겠습니까? 하위 항목도 함께 삭제됩니다.')) return;
    await onDelete(id);
  };

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-gray-700">{title}</h3>
      {note && <p className="text-xs text-gray-400">{note}</p>}

      {onAdd && !disabled && (
        <div className="flex gap-2">
          <Input
            placeholder={placeholder}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            className="text-sm"
          />
          <Button size="sm" variant="outline" onClick={handleAdd} disabled={!newName.trim()}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      )}

      <div className="space-y-1 max-h-72 overflow-y-auto">
        {items.map((item) => (
          <div
            key={item.id}
            className={`group flex items-center justify-between p-2 rounded-md text-sm cursor-pointer transition-colors ${
              selectedId === item.id ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-gray-50'
            }`}
            onClick={() => onSelect?.(item.id)}
          >
            {editingId === item.id ? (
              <div className="flex items-center gap-1 flex-1">
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleEditSave()}
                  className="h-7 text-sm"
                  autoFocus
                  onClick={(e) => e.stopPropagation()}
                />
                <button
                  onClick={(e) => { e.stopPropagation(); handleEditSave(); }}
                  className="p-1 text-green-600 hover:text-green-700"
                  aria-label="저장"
                >
                  <Check className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setEditingId(null); }}
                  className="p-1 text-gray-400 hover:text-gray-600"
                  aria-label="취소"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <>
                <span className="truncate">{item.name}</span>
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  {onEdit && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setEditingId(item.id); setEditName(item.name); }}
                      className="p-1 hover:text-primary text-gray-400"
                      aria-label="수정"
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                  )}
                  {onDelete && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(item.id); }}
                      className="p-1 hover:text-red-500 text-gray-400"
                      aria-label="삭제"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        ))}
        {items.length === 0 && !disabled && (
          <p className="text-xs text-gray-400 text-center py-4">{emptyMessage}</p>
        )}
        {disabled && (
          <p className="text-xs text-gray-400 text-center py-4">상위 항목을 먼저 선택하세요</p>
        )}
      </div>
    </div>
  );
}
