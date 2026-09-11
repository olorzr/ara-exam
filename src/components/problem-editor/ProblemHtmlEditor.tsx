'use client';

import { useEffect, useRef } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TextAlign from '@tiptap/extension-text-align';
import { Table, TableRow } from '@tiptap/extension-table';
import { Extension } from '@tiptap/core';
import { CustomTableCell, CustomTableHeader } from '@/components/exam-builder/CustomTableCell';
import { sanitizeProblemHTML } from '@/lib/sanitize-problem';
import { FigurePlaceholderNode } from './FigurePlaceholderNode';
import ProblemEditorToolbar from './ProblemEditorToolbar';

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
  /**
   * 우리가 마지막으로 밖에 내보낸 HTML.
   *
   * ⚠️ 이게 없으면 **표가 있는 글에서 글자마다 커서가 끝으로 튄다.** TipTap 은
   *    `<colgroup>` 과 표 크기 style 을 함께 내는데 정화가 그걸 지우므로,
   *    "정화한 값 == getHTML()" 비교가 **영영 참이 되지 않아** 키를 칠 때마다
   *    문서를 통째로 갈아 끼우게 된다(코덱스 리뷰 18R).
   *    내가 낸 값이 돌아온 것인지부터 확인해 그 경우는 아무것도 하지 않는다.
   */
  const lastEmitted = useRef<string>(value);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      // 밑줄·줄바꿈(<br>)·구분선(<hr>)은 StarterKit 3.x 에 이미 들어 있다.
      // @tiptap/extension-underline 을 따로 등록하면 확장이 두 벌이 된다
      StarterKit.configure({ heading: { levels: [3, 4] } }),
      BoxAttribute,
      // 없으면 편집기가 그림 자리표시자를 모르는 태그로 보고 버린다
      FigurePlaceholderNode,
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
    onUpdate: ({ editor: e }) => {
      const html = e.getHTML();
      lastEmitted.current = html;
      onChange(html);
    },
  });

  // 바깥에서 내용이 갈렸을 때만 갈아 끼운다 — 타이핑 중에 덮어쓰면 커서가 튄다
  useEffect(() => {
    if (!editor) return;
    // 내가 방금 낸 값이 그대로 돌아온 것이면 아무것도 하지 않는다
    if (value === lastEmitted.current) return;
    const next = sanitizeProblemHTML(value);
    if (next === editor.getHTML()) return;
    editor.commands.setContent(next, { emitUpdate: false });
    lastEmitted.current = next;
    // value 가 바뀔 때만 반응한다(editor 는 안정적인 참조다)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  if (!editor) return null;

  return (
    <div className="pb-editor rounded-md border border-gray-200">
      <ProblemEditorToolbar editor={editor} />
      <EditorContent editor={editor} className="px-3 py-2" style={{ minHeight }} />
    </div>
  );
}
