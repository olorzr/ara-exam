'use client';

import { useCallback, type RefObject } from 'react';
import { toast } from 'sonner';
import type { Editor } from '@tiptap/react';
import { extractMarks } from '@/lib/concept-marks';

const CONCEPT_MARK = 'concept';

/**
 * 개념지 편집기의 concept 마킹을 붙이고 떼는 조작들을 모은 훅.
 *
 * 편집기 문서를 직접 건드리는 역할만 담당한다 — 개념지의 로딩/저장은
 * `useConceptSheetEditor` 가 맡는다.
 *
 * @param editorRef - TipTap Editor 를 담은 ref (아직 준비 전이면 null)
 * @param setEditorHTML - 문서 변경을 미리보기에 반영하기 위한 HTML setter
 * @returns 마킹 조작 함수 4종
 */
export function useConceptMarkActions(
  editorRef: RefObject<Editor | null>,
  setEditorHTML: (html: string) => void,
) {
  /** 위치·길이를 알고 있을 때 해당 구간의 마킹을 뗀다 */
  const deleteMark = useCallback((pos: number, len: number) => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.chain().focus()
      .setTextSelection({ from: pos, to: pos + len })
      .unsetMark(CONCEPT_MARK).run();
  }, [editorRef]);

  /** 문서 전체의 마킹을 뗀다 */
  const clearAllMarks = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.chain().focus().selectAll().unsetMark(CONCEPT_MARK).run();
    toast.success('모든 마킹이 해제되었습니다');
  }, [editorRef]);

  /**
   * 텍스트로 찾아 마킹을 뗀다(미리보기에서 단어를 클릭했을 때).
   * 텍스트 노드가 서식 때문에 쪼개져 정확히 일치하지 않을 수 있으므로,
   * 못 찾으면 `extractMarks` 가 병합한 목록에서 다시 찾는다.
   */
  const removeMarkByText = useCallback((text: string) => {
    const editor = editorRef.current;
    if (!editor) return;

    let found = false;
    editor.state.doc.descendants((node, pos) => {
      if (found) return false;
      if (!node.isText) return;
      if (!node.marks.some((m) => m.type.name === CONCEPT_MARK)) return;
      if (node.text !== text) return;

      editor.chain()
        .setTextSelection({ from: pos, to: pos + node.nodeSize })
        .unsetMark(CONCEPT_MARK).run();
      found = true;
      return false;
    });

    if (!found) {
      const match = extractMarks(editor).find((m) => m.text === text);
      if (match) {
        editor.chain()
          .setTextSelection({ from: match.pos, to: match.pos + match.len })
          .unsetMark(CONCEPT_MARK).run();
      }
    }
    setEditorHTML(editor.getHTML());
  }, [editorRef, setEditorHTML]);

  /** 텍스트로 처음 찾은 자리에 마킹을 붙인다 */
  const addMarkByText = useCallback((text: string) => {
    const editor = editorRef.current;
    if (!editor) return;

    let found = false;
    editor.state.doc.descendants((node, pos) => {
      if (found) return false;
      if (!node.isText) return;

      const idx = (node.text ?? '').indexOf(text);
      if (idx === -1) return;

      const from = pos + idx;
      editor.chain()
        .setTextSelection({ from, to: from + text.length })
        .setMark(CONCEPT_MARK).run();
      found = true;
      return false;
    });
    setEditorHTML(editor.getHTML());
  }, [editorRef, setEditorHTML]);

  return { deleteMark, clearAllMarks, removeMarkByText, addMarkByText };
}
