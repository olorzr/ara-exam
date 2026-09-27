'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import { Table, TableRow } from '@tiptap/extension-table';
import { Mark } from '@tiptap/core';
import { useCallback, useEffect, useRef } from 'react';
import type { Editor } from '@tiptap/react';
import type { MarkItem } from './ExamMarkingSidebar';
import { CustomTableCell, CustomTableHeader } from './CustomTableCell';
import CellStyleToolbar from './CellStyleToolbar';
import MarkingModeToggle from './MarkingModeToggle';
import { AlignLeft, AlignCenter, AlignRight } from 'lucide-react';
import { extractMarks } from '@/lib/concept-marks';

/** TipTap 커스텀 마크: 개념 하이라이트 */
const ConceptMark = Mark.create({
  name: 'concept',
  addAttributes() {
    return { 'data-concept': { default: 'true' } };
  },
  parseHTML() {
    return [{ tag: 'mark[data-concept]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['mark', { ...HTMLAttributes, 'data-concept': 'true' }, 0];
  },
});

const SAMPLE_CONTENT = `<h3>1. 「나무의 꿈」 제재 개관</h3>
<table><tbody>
<tr><td><strong>갈래</strong></td><td>자유시, 서정시</td></tr>
<tr><td><strong>성격</strong></td><td>희망적, 교훈적, 성찰적</td></tr>
<tr><td><strong>제재</strong></td><td>나무, 꿈</td></tr>
<tr><td><strong>주제</strong></td><td>다양한 꿈과 무한한 가능성을 지닌 대상에 대한 지지와 격려</td></tr>
</tbody></table>
<p><strong>특징</strong></p>
<p>① 나무를 의인화하여 말을 건네는 방식으로 시상을 전개함.</p>
<p>② 나무의 꿈을 연쇄적으로 연상하여 나열함.</p>
<p>③ 유사한 종결 표현을 반복하여 운율을 형성함.</p>`;

interface ExamEditorProps {
  onHTMLChange: (html: string) => void;
  onMarksChange: (marks: MarkItem[]) => void;
  editorRef: React.MutableRefObject<Editor | null>;
  /** 초기 에디터 콘텐츠 (저장된 개념지 불러오기 시 사용) */
  initialContent?: string;
  /** 마킹 모드 — 부모(`useConceptSheetEditor`)가 쥐고 미리보기와 같은 값을 나눠 쓴다 */
  markingMode: boolean;
  onToggleMarkingMode: () => void;
}

/**
 * TipTap 리치 에디터 + 마킹 모드 토글.
 * 마킹 ON 상태에서 드래그 → 하이라이트, 기존 마킹 클릭 → 해제.
 * 마킹 모드 값은 부모가 쥔다(미리보기와 같은 값을 본다) — 여기서는 읽고 토글만 부른다.
 */
export default function ExamEditor({
  onHTMLChange, onMarksChange, editorRef, initialContent, markingMode, onToggleMarkingMode,
}: ExamEditorProps) {
  const wrapRef = useRef<HTMLDivElement>(null);

  const syncMarks = useCallback((e: Editor) => {
    onMarksChange(extractMarks(e));
  }, [onMarksChange]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [3, 4] } }),
      Underline,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Table.configure({ resizable: true }),
      TableRow,
      CustomTableCell,
      CustomTableHeader,
      ConceptMark,
    ],
    content: initialContent !== undefined ? initialContent : SAMPLE_CONTENT,
    onUpdate: ({ editor: e }) => {
      onHTMLChange(e.getHTML());
      syncMarks(e);
    },
  });

  useEffect(() => {
    if (editor) {
      editorRef.current = editor;
      onHTMLChange(editor.getHTML());
      syncMarks(editor);
    }
  }, [editor, editorRef, onHTMLChange, syncMarks]);

  /** 에디터 클릭/드래그 → 마킹 적용/해제 */
  const handleMouseUp = useCallback(() => {
    if (!markingMode || !editor) return;
    const { from, empty } = editor.state.selection;
    if (empty) {
      // 기존 마크 위 클릭 → 해제
      const resolved = editor.state.doc.resolve(from);
      if (resolved.marks().some((m) => m.type.name === 'concept')) {
        let start = from;
        let end = from;
        editor.state.doc.nodesBetween(
          Math.max(0, from - 200),
          Math.min(editor.state.doc.content.size, from + 200),
          (node, pos) => {
            if (node.isText && node.marks.some((m) => m.type.name === 'concept')) {
              const nodeEnd = pos + node.nodeSize;
              if (pos <= from && nodeEnd >= from) { start = pos; end = nodeEnd; }
            }
          },
        );
        editor.chain().focus().setTextSelection({ from: start, to: end }).unsetMark('concept').run();
        syncMarks(editor);
      }
      return;
    }

    // 드래그 → 선택한 범위 그대로 마크 적용 (부분 단어 마킹 허용)
    // 여러 단어를 걸쳐 드래그해도 사이드바는 extractMarks 가 공백 기준으로
    // 쪼개어 단어별로 표시하므로 채점 카운트는 정확하게 유지된다.
    editor.chain().focus().setMark('concept').run();
    syncMarks(editor);
  }, [markingMode, editor, syncMarks]);

  if (!editor) return null;

  return (
    <div
      className={`bg-white rounded-lg shadow-sm border-2 transition-colors flex flex-col overflow-hidden h-full ${markingMode ? 'border-primary' : 'border-transparent'}`}
    >
      {/* 툴바 */}
      <EditorToolbar editor={editor} markingMode={markingMode} onToggleMarking={onToggleMarkingMode} />

      {/* 에디터 본문 */}
      <div className="eb-editor-wrap" ref={wrapRef} onMouseUp={handleMouseUp}>
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

/* ── 툴바 (분리하여 가독성 확보) ── */

interface ToolbarProps {
  editor: Editor;
  markingMode: boolean;
  onToggleMarking: () => void;
}

const TB_CMDS = [
  { cmd: 'bold', label: 'B', title: '굵게' },
  { cmd: 'italic', label: 'I', title: '기울임' },
  { cmd: 'underline', label: 'U', title: '밑줄' },
  { cmd: 'sep' },
  { cmd: 'bulletList', label: '•', title: '글머리 기호' },
  { cmd: 'orderedList', label: '1.', title: '번호 목록' },
  { cmd: 'sep' },
  { cmd: 'heading3', label: 'H3', title: '제목' },
  { cmd: 'heading4', label: 'H4', title: '소제목' },
  { cmd: 'sep' },
  { cmd: 'sep' },
  { cmd: 'insertTable', label: '⊞', title: '표 삽입' },
  { cmd: 'addColAfter', label: '+열', title: '열 추가' },
  { cmd: 'addRowAfter', label: '+행', title: '행 추가' },
  { cmd: 'deleteCol', label: '-열', title: '열 삭제' },
  { cmd: 'deleteRow', label: '-행', title: '행 삭제' },
  { cmd: 'mergeCells', label: '⊟', title: '셀 병합' },
  { cmd: 'sep' },
  { cmd: 'undo', label: '↩', title: '실행취소' },
  { cmd: 'redo', label: '↪', title: '다시실행' },
] as const;

function EditorToolbar({ editor, markingMode, onToggleMarking }: ToolbarProps) {
  function runCmd(cmd: string) {
    const chain = editor.chain().focus();
    const map: Record<string, () => void> = {
      bold: () => chain.toggleBold().run(),
      italic: () => chain.toggleItalic().run(),
      underline: () => chain.toggleUnderline().run(),
      bulletList: () => chain.toggleBulletList().run(),
      orderedList: () => chain.toggleOrderedList().run(),
      heading3: () => chain.toggleHeading({ level: 3 }).run(),
      heading4: () => chain.toggleHeading({ level: 4 }).run(),
      insertTable: () => chain.insertTable({ rows: 3, cols: 2, withHeaderRow: false }).run(),
      addColAfter: () => chain.addColumnAfter().run(),
      addRowAfter: () => chain.addRowAfter().run(),
      deleteCol: () => chain.deleteColumn().run(),
      deleteRow: () => chain.deleteRow().run(),
      mergeCells: () => chain.mergeCells().run(),
      alignLeft: () => chain.setTextAlign('left').run(),
      alignCenter: () => chain.setTextAlign('center').run(),
      alignRight: () => chain.setTextAlign('right').run(),
      undo: () => chain.undo().run(),
      redo: () => chain.redo().run(),
    };
    map[cmd]?.();
  }

  function isActive(cmd: string): boolean {
    const map: Record<string, boolean> = {
      bold: editor.isActive('bold'),
      italic: editor.isActive('italic'),
      underline: editor.isActive('underline'),
      bulletList: editor.isActive('bulletList'),
      orderedList: editor.isActive('orderedList'),
      heading3: editor.isActive('heading', { level: 3 }),
      heading4: editor.isActive('heading', { level: 4 }),
      alignLeft: editor.isActive({ textAlign: 'left' }),
      alignCenter: editor.isActive({ textAlign: 'center' }),
      alignRight: editor.isActive({ textAlign: 'right' }),
    };
    return map[cmd] ?? false;
  }

  return (
    <div className="flex items-center gap-1 px-3 py-2 border-b border-gray-200 bg-gray-50 flex-wrap">
      {TB_CMDS.map((item, i) =>
        item.cmd === 'sep' ? (
          <div key={`sep-${i}`} className="w-px h-6 bg-gray-200 mx-1" />
        ) : (
          <button
            key={item.cmd}
            className={`w-8 h-8 flex items-center justify-center rounded-md text-sm font-semibold transition-colors
              ${isActive(item.cmd) ? 'bg-primary/20 text-primary' : 'text-gray-700 hover:bg-gray-200'}`}
            onClick={() => runCmd(item.cmd)}
            title={item.title}
          >
            {item.label}
          </button>
        ),
      )}

      {/* 정렬 */}
      <div className="w-px h-6 bg-gray-200 mx-1" />
      {([
        { cmd: 'alignLeft', icon: AlignLeft, title: '왼쪽 정렬' },
        { cmd: 'alignCenter', icon: AlignCenter, title: '가운데 정렬' },
        { cmd: 'alignRight', icon: AlignRight, title: '오른쪽 정렬' },
      ] as const).map(({ cmd, icon: Icon, title }) => (
        <button
          key={cmd}
          className={`w-8 h-8 flex items-center justify-center rounded-md transition-colors
            ${isActive(cmd) ? 'bg-primary/20 text-primary' : 'text-gray-700 hover:bg-gray-200'}`}
          onClick={() => runCmd(cmd)}
          title={title}
        >
          <Icon className="h-4 w-4" />
        </button>
      ))}

      {/* 셀 스타일 (테두리 방향별 + 배경색) */}
      <CellStyleToolbar editor={editor} />

      {/* 마킹 모드 토글 — 미리보기 탭 바와 같은 단추 */}
      <MarkingModeToggle pressed={markingMode} onToggle={onToggleMarking} className="ml-auto" />
    </div>
  );
}

