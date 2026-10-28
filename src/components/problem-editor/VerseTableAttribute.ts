import { Extension } from '@tiptap/core';
import { TableView } from '@tiptap/extension-table';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { VERSE_LAYOUT } from '@/lib/sanitize-problem';

/**
 * 칸선 없는 나란히 표(`<table data-layout="verse">`)를 살려 두는 전역 속성.
 *
 * 향찰과 해독, 한시와 번역처럼 원문과 풀이를 줄 맞춰 나란히 적은 글은 **표로만** 담는다 —
 * 공백·탭으로 맞춘 줄은 HTML 이 접어 버려 두 칸이 한 줄로 뭉개진다(2026-10-26 화순고 제망매가).
 *
 * ⚠️ TipTap 의 Table 노드는 **모르는 속성을 버린다.** 이게 없으면 그런 지문을 한 글자만 고쳐
 *    저장해도 `data-layout` 이 빠지고, 인쇄에 칸선이 되살아난다. 값 검증은 정화(sanitize-problem.ts)
 *    가 하므로 여기서는 받을 값(문항은 verse 하나)일 때만 통과시킨다.
 */
export const VerseTableAttribute = createTableLayoutAttribute(new Set([VERSE_LAYOUT]), 'verseTableAttribute');

/**
 * 표의 `data-layout` 을 살려 두는 전역 속성을 만든다 — 받는 값만 다르다.
 * 문항 편집기는 verse 하나, 작품 전문·개념 편집기는 verse·gloss(여백 해설)·vocab(어휘 풀이)(workbook-markup.ts).
 * @param allowed - 받을 `data-layout` 값
 * @param name - 확장 이름(편집기 안에서 겹치지 않게)
 * @returns TipTap 확장
 */
export function createTableLayoutAttribute(allowed: ReadonlySet<string>, name: string) {
  return Extension.create({
    name,
    addGlobalAttributes() {
      return [{
        types: ['table'],
        attributes: {
          layout: {
            default: null,
            parseHTML: (element: HTMLElement) => {
              const value = element.getAttribute('data-layout');
              return value && allowed.has(value) ? value : null;
            },
            renderHTML: (attributes: Record<string, unknown>) => {
              const value = attributes.layout;
              return typeof value === 'string' && allowed.has(value) ? { 'data-layout': value } : {};
            },
          },
        },
      }];
    },
  });
}

/** 노드 속성 → 화면의 `<table>` 에 `data-layout` 을 맞춘다 */
function syncLayout(table: HTMLTableElement, node: ProseMirrorNode): void {
  // 받을 값은 속성 확장이 이미 걸렀다 — 무엇이든 그대로 단다(verse·gloss·vocab)
  const layout: unknown = node.attrs.layout;
  if (typeof layout === 'string' && layout) table.setAttribute('data-layout', layout);
  else table.removeAttribute('data-layout');
}

/**
 * 크기 조절 표의 화면 그리기(NodeView)에도 `data-layout` 을 단다.
 *
 * ⚠️ `Table.configure({ resizable: true })` 면 TipTap 의 `TableView` 가 `<table>` 을 **직접** 만들어
 *    `renderHTML` 의 속성이 화면에 안 붙는다 — 저장값(`getHTML()`)에는 표시가 있는데 편집기에서는
 *    점선 대신 보통 칸선으로 보이고, 단추를 눌러도 아무 변화가 없어 보인다(코덱스 1R).
 *    그래서 만들 때와 바뀔 때 직접 맞춘다.
 */
export class VerseTableView extends TableView {
  constructor(node: ProseMirrorNode, cellMinWidth: number) {
    super(node, cellMinWidth);
    syncLayout(this.table, node);
  }

  update(node: ProseMirrorNode): boolean {
    if (!super.update(node)) return false;
    syncLayout(this.table, node);
    return true;
  }
}
