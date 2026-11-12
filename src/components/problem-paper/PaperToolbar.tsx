'use client';

import { Eraser, RotateCcw, Save, Shuffle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { suggestsSingleColumn } from '@/lib/problem-paper/settings';
import type { OmrPlanNotice } from '@/lib/problem-paper/omr-payload';
import type { PaperSettings } from '@/types/problem-bank';

/** 고치기 화면에서 툴바가 다르게 하는 것 */
export interface PaperToolbarEditMode {
  /** 저장된 상태에서 고친 것이 있는가 — 없으면 저장 단추를 잠근다 */
  dirty: boolean;
  /** 고친 것을 모두 버리고 저장된 상태로 */
  onReset: () => void;
}

interface PaperToolbarProps {
  title: string;
  settings: PaperSettings;
  count: number;
  saving: boolean;
  longestPassageChars: number;
  /** OMR 채점을 켰을 때의 안내 — 막히면 `block`, 알아 둘 것은 `info` */
  omrNotice?: OmrPlanNotice | null;
  /** 고치기 화면이면 넘긴다 — OMR 칸 잠금, '처음 상태로', '수정 저장' */
  edit?: PaperToolbarEditMode;
  /** 문항을 담는 중(폴더·지문·비율 담기) — 끝나기 전에 저장하면 그 담기가 저장 뒤에 들어와 사라진다 */
  saveBlocked?: boolean;
  onTitle: (title: string) => void;
  onSettings: (patch: Partial<PaperSettings>) => void;
  onShuffle: () => void;
  onClear: () => void;
  onSave: () => void;
}

/** 저장 단추 글자 */
function saveLabel(saving: boolean, editing: boolean): string {
  if (saving) return '저장 중…';
  return editing ? '수정 저장' : '문제지 만들기';
}

/**
 * 문제지 설정 줄.
 *
 * 1단 권유는 **권하기만** 한다 — 종이 수를 우선할 수도 있고, 인쇄 엔진이 지문을 문단
 * 단위로 흘려 보내므로 2단에서도 내용이 잘리지는 않는다.
 */
export default function PaperToolbar({
  title, settings, count, saving, longestPassageChars, omrNotice = null, edit, saveBlocked = false,
  onTitle, onSettings, onShuffle, onClear, onSave,
}: PaperToolbarProps) {
  const hint = settings.columns === 2 && suggestsSingleColumn(longestPassageChars);
  const editing = edit !== undefined;

  return (
    <div className="space-y-3 rounded-lg border border-gray-200 p-3">
      <div className="space-y-1">
        <Label htmlFor="paper-title" className="text-xs text-gray-500">문제지 제목</Label>
        <Input
          id="paper-title" value={title} onChange={(e) => onTitle(e.target.value)}
          placeholder="예: 2026 중2 1학기 중간 대비" className="h-9 text-sm"
        />
      </div>

      <div className="flex flex-wrap items-center gap-3 text-sm">
        <div className="flex items-center gap-1">
          <span className="text-gray-500">단</span>
          {([1, 2] as const).map((c) => (
            <Button
              key={c} type="button" size="sm"
              variant={settings.columns === c ? 'default' : 'outline'}
              onClick={() => onSettings({ columns: c })}
            >
              {c}단
            </Button>
          ))}
        </div>

        {/* 출처는 기본 표시라 체크박스는 '숨기기' 다. 저장 키는 `showSource` 그대로이고
            뒤집는 곳은 여기 하나뿐이다 — 렌더러·RPC·옛 문제지는 그 키를 그대로 본다 */}
        <label className="flex items-center gap-1.5 text-gray-600">
          <input
            type="checkbox" checked={!settings.showSource}
            onChange={(e) => onSettings({ showSource: !e.target.checked })}
            className="h-4 w-4 accent-[color:var(--primary)]"
          />
          출처 숨기기
        </label>

        {/* 켜면 저장 직후 학원 성적 시스템에 시험으로 등록되고 인쇄물에 90A 답안지 안내가 붙는다.
            **만들 때만** 정한다 — 고치기에서는 잠근다(서버도 저장값을 그대로 둔다, sql/103) */}
        <label
          className="flex items-center gap-1.5 text-gray-600 has-[:disabled]:opacity-60"
          title={editing ? 'OMR 채점은 만들 때만 정해요' : '학원 성적에 시험으로 등록하고 90A 답안지로 채점해요'}
        >
          <input
            type="checkbox" checked={settings.omr} disabled={editing}
            onChange={(e) => onSettings({ omr: e.target.checked })}
            className="h-4 w-4 accent-[color:var(--primary)]"
          />
          OMR 채점(90A)
        </label>

        <div className="ml-auto flex items-center gap-1">
          <Button type="button" variant="outline" size="sm" onClick={onShuffle} disabled={count < 2}>
            <Shuffle className="h-3.5 w-3.5" /><span className="ml-1">섞기</span>
          </Button>
          {edit ? (
            <Button
              type="button" variant="outline" size="sm" disabled={!edit.dirty || saving}
              onClick={() => { if (window.confirm('고친 것을 모두 버리고 저장된 상태로 되돌릴까요?')) edit.onReset(); }}
            >
              <RotateCcw className="h-3.5 w-3.5" /><span className="ml-1">처음 상태로</span>
            </Button>
          ) : (
            <Button
              type="button" variant="outline" size="sm" disabled={count === 0}
              onClick={() => { if (window.confirm('담은 문항을 모두 뺄까요?')) onClear(); }}
            >
              <Eraser className="h-3.5 w-3.5" /><span className="ml-1">비우기</span>
            </Button>
          )}
          <Button
            type="button" size="sm" onClick={onSave}
            disabled={saving || saveBlocked || count === 0 || (edit !== undefined && !edit.dirty)}
            title={saveBlocked ? '문항을 담는 중이에요 — 끝나면 저장할 수 있어요' : undefined}
          >
            <Save className="h-3.5 w-3.5" />
            <span className="ml-1">{saveLabel(saving, editing)}</span>
          </Button>
        </div>
      </div>

      {omrNotice && (
        <p className={`text-xs ${omrNotice.tone === 'block' ? 'text-red-600' : 'text-gray-500'}`} role="status">
          {omrNotice.text}
        </p>
      )}

      {hint && (
        <p className="text-xs text-amber-700">
          지문이 길어요. 1단으로 두면 읽기 편합니다(2단에서도 내용이 잘리지는 않아요).
        </p>
      )}
    </div>
  );
}
