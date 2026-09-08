'use client';

import { useEffect } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import { Table, TableRow } from '@tiptap/extension-table';
import { Extension } from '@tiptap/core';
import { Bold, Italic, Table as TableIcon, Underline as UnderlineIcon } from 'lucide-react';
import { CustomTableCell, CustomTableHeader } from '@/components/exam-builder/CustomTableCell';
import { sanitizeProblemHTML } from '@/lib/sanitize-problem';

/**
 * 〈보기〉 상자를 살려 두는 blockquote.
 *
 * ⚠️ StarterKit 기본 blockquote 는 **모르는 속성을 버린다.** 그대로 두면 OCR 이 만든
 *    `<blockquote data-box="보기">` 를 한 글자만 고쳐도 `getHTML()` 이 속성을 빼고,
 *    저장하는 순간 말머리와 인쇄 상자 테두리가 영영 사라진다
 *    (인쇄 CSS 가 `blockquote[data-box]` 를 겨냥한다).
 *    값 검증은 정화(sanitize-problem.ts)가 하므로 여기서는 통과만 시킨다.
 *
 * blockquote 확장을 갈아 끼우지 않고 **전역 속성**으로 얹는다 — 새 패키지를 늘리지 않고
 * StarterKit 의 blockquote 동작(단축키·입력 규칙)을 그대로 쓰기 위해서다.
 */
const BoxAttribute = Extension.create({
  name: 'boxAttribute',
  addGlobalAttributes() {
    return [{
      types: ['blockquote'],
      attributes: {
        'data-box': {
          default: null,
          parseHTML: (element: HTMLElement) => element.getAttribute('data-box'),
          renderHTML: (attributes: Record<string, unknown>) =>
            (attributes['data-box'] ? { 'data-box': attributes['data-box'] } : {}),
        },
      },
    }];
  },
});

interface ProblemHtmlEditorProps {
  /** 저장된 HTML. 바뀌면 편집기 내용을 갈아 끼운다 */
  value: string;
  onChange: (html: string) => void;
  /** 지문처럼 긴 글이면 높이를 키운다 */
  minHeight?: number;
  ariaLabel?: string;
}

/**
 * 문항·지문 본문 편집기.
 *
 * 개념지 편집기와 확장 셋은 같지만 **개념어 마킹(ConceptMark)은 뺐다** —
 * 문항에는 개념어 표시가 없고, 들어오면 정화가 지운다.
 *
 * ⚠️ 로드 경로에서도 정화한다. 저장 때 걸렀더라도 과거 오염 데이터나 DB 직접 수정이
 *    남아 있을 수 있어, 편집기에 넣기 **전에** 막는다(개념지에서 실제로 겪은 경로다).
 */
export default function ProblemHtmlEditor({
  value, onChange, minHeight = 120, ariaLabel,
}: ProblemHtmlEditorProps) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ heading: { levels: [3, 4] } }),
      BoxAttribute,
      Underline,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Table.configure({ resizable: true }),
      TableRow,
      CustomTableCell,
      CustomTableHeader,
    ],
    content: sanitizeProblemHTML(value),
    editorProps: {
      attributes: {
        class: 'prose-sm max-w-none focus:outline-none',
        ...(ariaLabel ? { 'aria-label': ariaLabel } : {}),
      },
    },
    onUpdate: ({ editor: e }) => onChange(e.getHTML()),
  });

  // 다른 문항으로 옮겨 갔을 때만 갈아 끼운다 — 타이핑 중에 덮어쓰면 커서가 튄다
  useEffect(() => {
    if (!editor) return;
    const next = sanitizeProblemHTML(value);
    if (next !== editor.getHTML()) editor.commands.setContent(next, { emitUpdate: false });
    // value 가 바뀔 때만 반응한다(editor 는 안정적인 참조다)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  if (!editor) return null;

  const buttonClass = (active: boolean) =>
    `rounded px-2 py-1 text-xs ${active ? 'bg-primary text-white' : 'bg-gray-100 text-gray-700'}`;

  return (
    <div className="rounded-md border border-gray-200">
      <div className="flex items-center gap-1 border-b border-gray-200 bg-gray-50 px-2 py-1">
        <button
          type="button" className={buttonClass(editor.isActive('bold'))}
          onClick={() => editor.chain().focus().toggleBold().run()} aria-label="굵게"
        >
          <Bold className="h-3.5 w-3.5" />
        </button>
        <button
          type="button" className={buttonClass(editor.isActive('italic'))}
          onClick={() => editor.chain().focus().toggleItalic().run()} aria-label="기울임"
        >
          <Italic className="h-3.5 w-3.5" />
        </button>
        <button
          type="button" className={buttonClass(editor.isActive('underline'))}
          onClick={() => editor.chain().focus().toggleUnderline().run()} aria-label="밑줄"
        >
          <UnderlineIcon className="h-3.5 w-3.5" />
        </button>
        <button
          type="button" className={buttonClass(editor.isActive('table'))}
          onClick={() => editor.chain().focus().insertTable({ rows: 2, cols: 2 }).run()}
          aria-label="표 넣기"
        >
          <TableIcon className="h-3.5 w-3.5" />
        </button>
      </div>
      <EditorContent editor={editor} className="px-3 py-2" style={{ minHeight }} />
    </div>
  );
}
