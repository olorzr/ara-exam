'use client';

import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  GRAMMAR_DEPTH_LABELS, GRAMMAR_MAX_TAGS, GRAMMAR_TREE, formatGrammarPath,
} from '@/lib/problem-bank/grammar-tree';
import AreaPathPicker from './AreaPathPicker';

interface GrammarTagPickerProps {
  /** 이미 붙은 경로 문자열들 */
  value: string[];
  /** 이 문항이 문법 영역인가 — 칸을 처음부터 펼칠지 정한다 */
  suggested: boolean;
  onChange: (paths: string[]) => void;
}

/**
 * 문법 분류를 **여러 개** 고른다.
 *
 * `AreaPathPicker` 는 경로 하나짜리라(영역·교과서 단원) 그대로 못 쓴다 — 한 경로를 고르는
 * 일은 그대로 맡기고, 고른 것을 목록에 쌓는 껍데기를 씌운다.
 *
 * ⚠️ 문법 문항이 아니어도 **접어 둘 뿐 막지 않는다.** 영역을 아직 안 고른 문항까지 닫아
 *    걸면 그 문항은 영영 분류할 수 없다(교과서를 검수에서 고칠 수 있게 만든 것과 같은 근거).
 * ⚠️ 펼침 여부는 **렌더에서 파생**한다. 효과로 setState 하면 `set-state-in-effect` 에 걸리고,
 *    영역을 문법으로 바꾸는 순간 칸이 저절로 나타나야 한다.
 */
export default function GrammarTagPicker({
  value, suggested, onChange,
}: GrammarTagPickerProps) {
  const [draft, setDraft] = useState<string[]>([]);
  const [opened, setOpened] = useState(false);

  const open = opened || suggested || value.length > 0;
  const full = value.length >= GRAMMAR_MAX_TAGS;
  const candidate = formatGrammarPath(draft);
  const canAdd = Boolean(candidate) && !full && !value.includes(candidate);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpened(true)}
        className="text-xs text-primary underline underline-offset-2"
      >
        + 문법 분류 추가
      </button>
    );
  }

  const add = () => {
    if (!canAdd) return;
    onChange([...value, candidate]);
    // 다음 개념을 바로 고를 수 있게 비운다
    setDraft([]);
  };

  const remove = (path: string) => onChange(value.filter((p) => p !== path));

  return (
    <div className="space-y-2 rounded-lg border border-gray-200 p-2">
      <Label className="text-xs text-gray-500">문법 분류</Label>

      {value.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {value.map((path) => (
            <span
              key={path}
              className="inline-flex items-center gap-1 rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-700"
            >
              {path}
              <button
                type="button"
                onClick={() => remove(path)}
                aria-label={`${path} 빼기`}
                className="text-gray-400 hover:text-red-500"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {full ? (
        <p className="text-xs text-gray-400">
          한 문항에 {GRAMMAR_MAX_TAGS}개까지 붙일 수 있어요. 빼고 다시 고르세요.
        </p>
      ) : (
        <div className="space-y-1">
          <AreaPathPicker
            tree={GRAMMAR_TREE}
            value={draft}
            labels={GRAMMAR_DEPTH_LABELS}
            onChange={setDraft}
          />
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={add} disabled={!canAdd}>
              <Plus className="h-3.5 w-3.5" />
              <span className="ml-1">추가</span>
            </Button>
            {candidate && value.includes(candidate) && (
              <span className="text-xs text-gray-400">이미 붙어 있어요.</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
