'use client';

import { useEffect, useState } from 'react';
import { Image as ImageIcon, Trash2, Type } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import ProblemHtmlEditor from '@/components/problem-editor/ProblemHtmlEditor';
import AreaPathPicker from './AreaPathPicker';
import type { AreaTreeNode } from '@/lib/problem-bank/area-tree';
import { UNIT_DEPTH_LABELS } from '@/lib/problem-bank/unit-tree';
import type { PassagePatch } from '@/lib/problem-bank/mutations';
import type { Passage } from '@/types/problem-bank';

interface PassageEditorCardProps {
  passage: Passage;
  /** 이 지문에 딸린 문항 수 — 지우기 전에 알려 준다 */
  problemCount: number;
  areaTree: AreaTreeNode[];
  /** 교과서 단원 트리. 출처에 교과서가 없으면 빈 배열이라 칸이 안 뜬다 */
  unitTree: AreaTreeNode[];
  selected: boolean;
  onSelect: () => void;
  onSave: (patch: PassagePatch) => Promise<boolean>;
  onDelete: () => void;
  /** 저장하지 않은 수정이 생기거나 사라질 때 알린다 — '검수 마치기' 를 막는 데 쓴다 */
  onDirtyChange?: (dirty: boolean) => void;
}

/**
 * 지문 한 개의 검수 카드.
 *
 * ⚠️ 호출부는 `key={passage.id}` 를 준다(ProblemEditorCard 와 같은 이유).
 */
export default function PassageEditorCard({
  passage, problemCount, areaTree, unitTree, selected, onSelect, onSave, onDelete, onDirtyChange,
}: PassageEditorCardProps) {
  const [html, setHtml] = useState(passage.html);
  const [title, setTitle] = useState(passage.title);
  const [author, setAuthor] = useState(passage.author);
  const [area, setArea] = useState<string[]>(passage.area_path);
  const [unit, setUnit] = useState<string[]>(passage.unit_path);
  const [saving, setSaving] = useState(false);

  /** 저장하지 않은 수정이 있는가 — 문항 카드와 같은 이유로 화면에 알린다 */
  const dirty = html !== passage.html
    || title !== passage.title
    || author !== passage.author
    || area.join('>') !== passage.area_path.join('>')
    || unit.join('>') !== passage.unit_path.join('>');

  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  const handleSave = async () => {
    setSaving(true);
    await onSave({ html, title, author, area_path: area, unit_path: unit });
    setSaving(false);
  };

  const toggleRenderMode = () => {
    const next = passage.render_mode === 'image' ? 'text' : 'image';
    if (next === 'image' && !passage.image_path) return;
    onSave({ render_mode: next });
  };

  return (
    <div
      data-passage-id={passage.id}
      onFocusCapture={onSelect}
      className={`rounded-lg border-2 p-4 transition ${
        selected ? 'border-primary shadow-sm' : 'border-amber-200 bg-amber-50/40'
      }`}
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button type="button" onClick={onSelect} className="text-sm font-semibold text-gray-900">
          지문 {passage.label || ''}
        </button>
        <Badge variant="outline">{passage.page_no}쪽</Badge>
        <Badge variant="outline">문항 {problemCount}개</Badge>
        {passage.render_mode === 'image' && <Badge variant="outline">이미지 출제</Badge>}
        {dirty && <Badge className="bg-sky-500 text-white">저장 안 됨</Badge>}

        <div className="ml-auto flex items-center gap-1">
          {passage.image_path && (
            <Button type="button" variant="outline" size="sm" onClick={toggleRenderMode}>
              {passage.render_mode === 'image'
                ? <><Type className="h-3.5 w-3.5" /><span className="ml-1">글로 출제</span></>
                : <><ImageIcon className="h-3.5 w-3.5" /><span className="ml-1">이미지로 출제</span></>}
            </Button>
          )}
          <Button
            type="button" variant="outline" size="sm"
            onClick={() => {
              const message = problemCount > 0
                ? `이 지문을 지울까요? 딸린 문항 ${problemCount}개는 남고 지문만 떨어집니다.\n`
                  + '문항을 서버에서 다시 읽으므로, 저장하지 않은 입력은 사라집니다.'
                : '이 지문을 지울까요?';
              if (window.confirm(message)) onDelete();
            }}
            aria-label="지문 삭제"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs text-gray-500">작품명</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} className="h-8 text-sm" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-gray-500">지은이</Label>
            <Input value={author} onChange={(e) => setAuthor(e.target.value)} className="h-8 text-sm" />
          </div>
        </div>

        <div className="space-y-1">
          <Label className="text-xs text-gray-500">본문</Label>
          <ProblemHtmlEditor value={html} onChange={setHtml} minHeight={200} ariaLabel="지문 본문" />
        </div>

        <AreaPathPicker tree={areaTree} value={area} onChange={setArea} />
        <AreaPathPicker
          tree={unitTree} value={unit} labels={UNIT_DEPTH_LABELS} onChange={setUnit}
        />

        <div className="flex justify-end">
          <Button type="button" size="sm" onClick={handleSave} disabled={saving}>
            {saving ? '저장 중…' : '저장'}
          </Button>
        </div>
      </div>
    </div>
  );
}
