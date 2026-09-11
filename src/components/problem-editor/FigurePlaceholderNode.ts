import { Node } from '@tiptap/core';

/**
 * 본문 안 **그림 자리표시자** TipTap 노드.
 *
 * ⚠️ 이게 없으면 편집기가 `<figure data-figure="1">` 을 **모르는 태그로 보고 버린다.**
 *    선생님이 발문에서 글자 하나만 고쳐도 `getHTML()` 에서 자리표시자가 빠지고,
 *    저장하는 순간 그림이 본문 어디에 있었는지가 영영 사라진다
 *    (`<blockquote data-box>` 가 겪었던 것과 같은 함정 — ProblemHtmlEditor 주석 참조).
 *
 * 내용이 없는 덩어리(atom)다. 사람이 **끌어 옮길 수는 있어야 한다** — 읽어 낸 자리가
 * 틀렸을 때 고칠 길이 이것뿐이다. 화면에는 '그림 n' 칩으로 보인다(실제 그림은 서명 URL
 * 이라 편집기 안에서 그릴 수 없다).
 */
export const FigurePlaceholderNode = Node.create({
  name: 'figurePlaceholder',
  group: 'block',
  atom: true,
  draggable: true,
  selectable: true,

  addAttributes() {
    return {
      index: {
        default: 1,
        parseHTML: (element: HTMLElement) => Number(element.getAttribute('data-figure')) || 1,
        renderHTML: (attributes: Record<string, unknown>) => ({
          'data-figure': String(attributes.index ?? 1),
        }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'figure[data-figure]' }];
  },

  renderHTML({ HTMLAttributes }) {
    // ⚠️ 내용(자식)을 두지 않는다 — 저장 HTML 은 **빈** figure 여야 정화를 통과하고,
    //    그리는 쪽이 그 자리에서 갈라 서명 URL 이미지를 끼운다
    return ['figure', { ...HTMLAttributes, class: 'pb-figure-slot' }];
  },
});
