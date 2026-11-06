import { Extension } from '@tiptap/core';
import { DOMParser as ProseMirrorDOMParser } from '@tiptap/pm/model';
import { Plugin } from '@tiptap/pm/state';
import type { EditorView } from '@tiptap/pm/view';
import { textToHtml } from '@/lib/reference-texts/body-format';
import { REFERENCE_TABLE_LAYOUTS } from '@/lib/workbook-markup';
import { keepPhraseRuns } from './phrase-run-keeper';
import { createTableLayoutAttribute } from './VerseTableAttribute';
import {
  HighlightMark, PhraseNoteMark, ReferenceCodeMark, ShapeMark, SmallMark, passThrough,
} from './WorkbookMarks';

export { HighlightMark, PhraseNoteMark, ReferenceCodeMark, ShapeMark, SmallMark } from './WorkbookMarks';

/**
 * 작품 전문 · 개념 편집기(참고자료 프로필)에만 얹는 확장 — 문제집 서식(workbook-markup.ts)이 저장할 때 사라지지 않게.
 *
 * ⚠️ TipTap 은 모르는 태그·속성을 **버린다.** 확장 없이 말머리 상자·형광펜이 든 본문을 열면 한 글자만 고쳐도
 *    `getHTML()` 이 표시를 빼고, 저장하는 순간 상자·해설·어휘 풀이가 영영 사라진다(BoxAttribute·VerseTableAttribute 와
 *    같은 함정). 값 검증은 정화기(`sanitizeReferenceHTML`)가 하므로 여기서는 통과만 시킨다.
 * ⚠️ 문항 편집기에는 넣지 않는다 — 문항 정화기가 어차피 지우고, 지운 표시를 편집기가 다시 만들면 안 된다.
 */

/** 말머리 상자 — blockquote 의 `data-callout`(말머리) · `data-tone`(색 갈래). 〈보기〉 상자(`data-box`)와 같은 꼴 */
export const CalloutAttribute = Extension.create({
  name: 'calloutAttribute',
  addGlobalAttributes() {
    return [{
      types: ['blockquote'],
      attributes: { 'data-callout': passThrough('data-callout'), 'data-tone': passThrough('data-tone') },
    }];
  },
});

/** 화살표 도식 — 점 목록의 `data-flow`(down · right) */
export const FlowAttribute = Extension.create({
  name: 'flowAttribute',
  addGlobalAttributes() {
    return [{ types: ['bulletList'], attributes: { 'data-flow': passThrough('data-flow') } }];
  },
});

/** 표 모양 — 나란히(verse) · 여백 해설(gloss) · 어휘 풀이(vocab). 문항 편집기의 `VerseTableAttribute` 대신 쓴다 */
export const ReferenceTableLayoutAttribute = createTableLayoutAttribute(REFERENCE_TABLE_LAYOUTS, 'referenceTableLayout');

/**
 * 평문을 붙여 넣는다 — 빈 줄은 문단(시의 연), 줄바꿈은 `<br>`(행). 평문 편집칸·`textToHtml` 과 같은 규칙이다.
 *
 * ⚠️ ProseMirror 의 기본 평문 붙여넣기는 줄마다 문단을 만들고 빈 줄을 접는다 — 시를 붙여 넣으면 행과 연의 구분이
 *    사라진다(코덱스 2R). 새 작품의 기본 형식이 서식이 되면서 '작품 원문 붙여 넣기' 가 이 길을 탄다.
 * @param view - 편집기 화면
 * @param text - 붙여 넣을 평문
 */
export function pastePlainText(view: EditorView, text: string): void {
  const host = document.createElement('div');
  // textToHtml 은 글자를 이스케이프해 태그를 만들지 않는다 — 문단·줄바꿈 표시만 든다
  host.innerHTML = textToHtml(text);
  const slice = ProseMirrorDOMParser.fromSchema(view.state.schema).parseSlice(host);
  view.dispatch(view.state.tr.replaceSelection(slice).scrollIntoView());
}

/** 평문 붙여넣기만 가로챈다 — 서식(text/html)이 함께 오면(웹·문서에서 복사) 기본 처리에 맡긴다 */
export const PlainTextPaste = Extension.create({
  name: 'plainTextPaste',
  addProseMirrorPlugins() {
    return [new Plugin({
      props: {
        handlePaste: (view, event) => {
          const data = event.clipboardData;
          if (!data || data.types.includes('text/html')) return false;
          const text = data.getData('text/plain');
          if (!text.includes('\n')) return false;
          pastePlainText(view, text);
          return true;
        },
      },
    })];
  },
});

/** 내용이 바뀌어도 풀이·표식 한 덩이가 갈라지지 않게 지킨다(`keepPhraseRuns`) — 키보드 · 툴바 · 붙여넣기 어느 길이든 */
export const PhraseRunKeeper = Extension.create({
  name: 'phraseRunKeeper',
  addProseMirrorPlugins() {
    return [new Plugin({
      appendTransaction: (transactions, _oldState, state) => keepPhraseRuns(transactions, state),
    })];
  },
});

/**
 * 참고자료 편집기의 StarterKit 설정 — `code` 는 `ReferenceCodeMark` 로 바꾸고 `link` 는 끈다.
 * ⚠️ 링크는 우선순위가 1000 이라 구절 풀이보다 바깥에 놓여 풀이를 링크 경계마다 쪼갠다. 그런데 정화기는 `<a>` 를 지우므로
 *    저장하면 링크는 사라지고 같은 풀이만 여러 번 찍힌다. 어차피 저장 못 할 표시라 편집기에 들이지 않는다.
 */
export const REFERENCE_STARTER_KIT = { code: false, link: false } as const;

/** 참고자료 편집기에 얹는 확장 묶음(표 모양 속성은 따로 — 문항 편집기의 verse 속성과 자리를 바꾼다) */
export const WORKBOOK_EXTENSIONS = [
  CalloutAttribute, FlowAttribute, HighlightMark, SmallMark, PhraseNoteMark, ShapeMark, ReferenceCodeMark,
  PhraseRunKeeper, PlainTextPaste,
];
