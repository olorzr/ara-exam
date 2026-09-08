'use client';

import { useEditorState, type Editor } from '@tiptap/react';
import { Bold, Italic, Minus, Table as TableIcon, Underline as UnderlineIcon, WrapText } from 'lucide-react';
import { BOX_LABEL_OPTIONS } from '@/lib/box-labels';

/** '상자 아님' 센티널 — 빈 문자열 option 은 브라우저마다 다루기가 다르다 */
const NO_BOX = '__none__';

interface ProblemEditorToolbarProps {
  editor: Editor;
}

/**
 * 문항·지문 편집기 툴바.
 *
 * ⚠️ 활성 상태를 `editor.isActive(...)` 로 **직접 읽으면 안 된다.** TipTap 3.x 의
 *    `useEditor` 는 `shouldRerenderOnTransaction` 이 기본 false 라, 커서를 옮겨도
 *    다시 그려지지 않아 버튼과 선택 칸이 옛 상태에 머문다. `useEditorState` 로 구독한다.
 */
export default function ProblemEditorToolbar({ editor }: ProblemEditorToolbarProps) {
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive('bold'),
      italic: e.isActive('italic'),
      underline: e.isActive('underline'),
      table: e.isActive('table'),
      blockquote: e.isActive('blockquote'),
      boxLabel: (e.getAttributes('blockquote')['data-box'] as string | null) ?? null,
    }),
  });

  const buttonClass = (active: boolean) =>
    `rounded px-2 py-1 text-xs ${active ? 'bg-primary text-white' : 'bg-gray-100 text-gray-700'}`;

  /** 고른 말머리로 감싸거나(없으면 만들고) 상자를 푼다 */
  const setBox = (value: string) => {
    const chain = editor.chain().focus();
    if (value === NO_BOX) {
      if (state.blockquote) chain.toggleBlockquote().run();
      return;
    }
    if (!state.blockquote) chain.setBlockquote();
    chain.updateAttributes('blockquote', { 'data-box': value }).run();
  };

  return (
    <div className="flex flex-wrap items-center gap-1 border-b border-gray-200 bg-gray-50 px-2 py-1">
      <button
        type="button" className={buttonClass(state.bold)}
        onClick={() => editor.chain().focus().toggleBold().run()} aria-label="굵게"
      >
        <Bold className="h-3.5 w-3.5" />
      </button>
      <button
        type="button" className={buttonClass(state.italic)}
        onClick={() => editor.chain().focus().toggleItalic().run()} aria-label="기울임"
      >
        <Italic className="h-3.5 w-3.5" />
      </button>
      <button
        type="button" className={buttonClass(state.underline)}
        onClick={() => editor.chain().focus().toggleUnderline().run()} aria-label="밑줄"
      >
        <UnderlineIcon className="h-3.5 w-3.5" />
      </button>
      <button
        type="button" className={buttonClass(false)}
        onClick={() => editor.chain().focus().setHardBreak().run()}
        aria-label="줄바꿈" title="줄바꿈 (Shift+Enter)"
      >
        <WrapText className="h-3.5 w-3.5" />
      </button>
      <button
        type="button" className={buttonClass(false)}
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
        aria-label="구분선"
      >
        <Minus className="h-3.5 w-3.5" />
      </button>
      <button
        type="button" className={buttonClass(state.table)}
        onClick={() => editor.chain().focus().insertTable({ rows: 2, cols: 2 }).run()}
        aria-label="표 넣기"
      >
        <TableIcon className="h-3.5 w-3.5" />
      </button>

      <select
        className="ml-1 rounded border border-gray-200 bg-white px-1.5 py-1 text-xs text-gray-700"
        aria-label="상자·구역"
        value={state.boxLabel ?? NO_BOX}
        onChange={(e) => setBox(e.target.value)}
      >
        <option value={NO_BOX}>상자 없음</option>
        {BOX_LABEL_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}
