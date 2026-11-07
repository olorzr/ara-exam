import { describe, expect, it } from 'vitest';
import { Editor, type AnyExtension } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { Table, TableRow } from '@tiptap/extension-table';
import { CustomTableCell, CustomTableHeader } from '@/components/exam-builder/CustomTableCell';
import { sanitizeReferenceHTML } from '@/lib/sanitize-reference';
import { VerseTableAttribute } from './VerseTableAttribute';
import { REFERENCE_STARTER_KIT, ReferenceTableLayoutAttribute, WORKBOOK_EXTENSIONS, pastePlainText } from './WorkbookExtensions';
import { PHRASE_NOTE_MARK, ReferenceCodeMark, SHAPE_MARK } from './WorkbookMarks';

/** 편집기에 넣었다가 내보낸 뒤 정화한다 — 저장 경로와 같다 */
function roundTrip(html: string, extensions: AnyExtension[]): string {
  const editor = buildEditor(html, extensions);
  const out = sanitizeReferenceHTML(editor.getHTML());
  editor.destroy();
  return out;
}

/** 표까지 든 편집기 — 확장 셋에 `code` 가 있으면 StarterKit 판을 끈다(ProblemHtmlEditor 와 같다) */
function buildEditor(content: string, extensions: AnyExtension[]): Editor {
  const ownCode = extensions.some((extension) => extension.name === 'code');
  return new Editor({
    extensions: [
      StarterKit.configure(ownCode ? REFERENCE_STARTER_KIT : {}), Table, TableRow, CustomTableCell, CustomTableHeader, ...extensions,
    ],
    content,
  });
}

const REFERENCE = [...WORKBOOK_EXTENSIONS, ReferenceTableLayoutAttribute];

/** 참고자료 편집기와 같은 확장 셋 */
const referenceEditor = (content: string) => buildEditor(content, REFERENCE);

/** 참고자료 편집기를 지난 뒤 정화한 값 */
const referenceRoundTrip = (html: string) => roundTrip(html, REFERENCE);

describe('문제집 서식 확장 — 편집기를 지나도 표시가 남는다', () => {
  it('말머리 상자(말머리·색 갈래)', () => {
    const out = roundTrip('<blockquote data-callout="학습 목표" data-tone="goal"><p>가</p></blockquote>', REFERENCE);
    expect(out).toContain('data-callout="학습 목표"');
    expect(out).toContain('data-tone="goal"');
  });

  it('형광펜·작은 글씨', () => {
    const out = roundTrip('<p><mark>특성</mark>과 화자 <small>(話 말할 화)</small></p>', REFERENCE);
    expect(out).toBe('<p><mark>특성</mark>과 화자 <small>(話 말할 화)</small></p>');
  });

  it('화살표 도식', () => {
    expect(roundTrip('<ul data-flow="down"><li><p>전</p></li><li><p>후</p></li></ul>', REFERENCE))
      .toContain('<ul data-flow="down">');
  });

  it('여백 해설·어휘 풀이·나란히 표', () => {
    for (const layout of ['gloss', 'vocab', 'verse']) {
      const html = `<table data-layout="${layout}"><tbody><tr><td><p>가</p></td><td><p>나</p></td></tr></tbody></table>`;
      expect(roundTrip(html, REFERENCE)).toContain(`data-layout="${layout}"`);
    }
  });

  it('⚠️ 확장이 없으면 표시가 사라진다 — 지우면 저장할 때마다 상자·해설이 사라진다', () => {
    const out = roundTrip('<blockquote data-callout="학습 목표"><p><mark>가</mark></p></blockquote>', []);
    expect(out).not.toContain('data-callout');
    expect(out).not.toContain('<mark');
  });

  it('문항 편집기의 표 속성은 verse 만 받는다 — 여백 해설은 걷힌다', () => {
    const html = '<table data-layout="gloss"><tbody><tr><td><p>가</p></td></tr></tbody></table>';
    expect(roundTrip(html, [VerseTableAttribute])).not.toContain('data-layout');
  });
});

describe('구절 풀이 · 표식 — 편집기를 지나도 남는다', () => {
  it('아래·위 풀이와 표식 다섯', () => {
    const html = '<p><span data-note="시각적 심상">푸른 파도가</span> <span data-note="항구" data-note-pos="over">우리 집 현관</span></p>'
      + '<p><span data-shape="box">가</span> <span data-shape="circle">나</span> <span data-shape="triangle">다</span> '
      + '<span data-shape="diamond">라</span> <span data-shape="star">마</span></p>';
    expect(referenceRoundTrip(html)).toBe(html);
  });

  it('낱말 뜻풀이 갈래가 남고 모르는 값은 해설로 읽는다', () => {
    const html = '<p><span data-note="닭의 수컷" data-note-kind="vocab">수탉</span></p>';
    expect(referenceRoundTrip(html)).toBe(html);
    expect(referenceRoundTrip('<p><span data-note="뜻" data-note-kind="term">수탉</span></p>')).toBe('<p><span data-note="뜻">수탉</span></p>');
  });

  it('한 span 의 풀이와 표식은 두 마크로 읽히고 글자는 한 번만 들어간다', () => {
    expect(referenceRoundTrip('<p><span data-note="가" data-shape="circle">나</span></p>'))
      .toBe('<p><span data-note="가"><span data-shape="circle">나</span></span></p>');
  });

  it('⚠️ 풀이·표식은 밑줄의 바깥이다 — 안쪽이면 풀이 글자에 밑줄이 번진다', () => {
    expect(referenceRoundTrip('<p><u><span data-shape="box"><span data-note="가">나</span></span></u></p>'))
      .toBe('<p><span data-note="가"><span data-shape="box"><u>나</u></span></span></p>');
  });

  it('⚠️ 네모(code) 위에도 풀이가 남는다 — StarterKit 판 code 는 다른 마크를 밀어낸다', () => {
    expect(referenceRoundTrip('<p><span data-note="가"><code>나</code></span></p>'))
      .toBe('<p><span data-note="가"><code>나</code></span></p>');
    expect(roundTrip('<p><span data-note="가"><code>나</code></span></p>', REFERENCE.filter((e) => e.name !== 'code')))
      .not.toContain('data-note');
  });

  it('⚠️ 네모 안 일부를 굵게 해도 네모는 하나다 — 네모가 일반 서식의 바깥이다', () => {
    const editor = referenceEditor('<p><code>abcdef</code></p>');
    editor.chain().setTextSelection({ from: 3, to: 5 }).toggleBold().run();
    expect(editor.getHTML()).toBe('<p><code>ab<strong>cd</strong>ef</code></p>');
    editor.destroy();
  });

  it('⚠️ 링크는 편집기에 들이지 않는다 — 풀이를 링크 경계마다 쪼개고 저장하면 같은 풀이만 여러 번 남는다', () => {
    const editor = referenceEditor('<p><a href="https://example.com">링크</a>글자</p>');
    expect(editor.getHTML()).toBe('<p>링크글자</p>');
    editor.chain().setTextSelection({ from: 1, to: 5 }).setMark(PHRASE_NOTE_MARK, { 'data-note': '풀이' }).run();
    expect(editor.getHTML()).toBe('<p><span data-note="풀이">링크글자</span></p>');
    editor.destroy();
  });

  it('⚠️ 붙여 넣은 값도 읽을 때 본다 — 정화 전 값이 평문으로 나가면 꺾쇠 뒤 풀이 글자가 원문이 된다', () => {
    for (const html of [
      '<p><span data-note="현실 > 이상">바다</span>에서</p>', '<p><span data-note="">바다</span>에서</p>',
      '<p><span data-shape="square">바다</span>에서</p>',
    ]) {
      const editor = referenceEditor(html);
      expect(editor.getHTML()).toBe('<p>바다에서</p>');
      editor.destroy();
    }
    const editor = referenceEditor('<p><span data-note="가" data-note-pos="under">바다</span></p>');
    expect(editor.getHTML()).toBe('<p><span data-note="가">바다</span></p>');
    editor.destroy();
  });

  it('네모는 Code 처럼 문단 끝에서 빠져나온다', () => {
    expect(ReferenceCodeMark.config.exitable).toBe(true);
    expect(ReferenceCodeMark.config.code).toBe(true);
  });

  it('⚠️ 확장이 없으면 풀이가 사라진다 — 저장하면 글자만 남는다', () => {
    expect(roundTrip('<p><span data-note="가" data-shape="box">나</span></p>', [])).toBe('<p>나</p>');
  });
});

describe('구절 풀이 명령 — 툴바가 쓰는 체인', () => {
  const NOTE = '<p>푸른 <span data-note="심상">파도가</span> 온다</p>';
  /** '파도가' 가운데 글자 뒤 — 커서만 있고 고른 범위가 없다 */
  const INSIDE = 5;

  it('고른 범위에 풀이를 단다', () => {
    const editor = referenceEditor('<p>푸른 파도가 온다</p>');
    editor.chain().setTextSelection({ from: 4, to: 7 }).setMark(PHRASE_NOTE_MARK, { 'data-note': '심상' }).run();
    expect(editor.getHTML()).toBe(NOTE);
    editor.destroy();
  });

  it('⚠️ 커서만 있으면 updateAttributes 는 아무것도 안 한다 — 툴바가 extendMarkRange 를 먼저 거는 까닭', () => {
    const editor = referenceEditor(NOTE);
    editor.chain().setTextSelection(INSIDE).updateAttributes(PHRASE_NOTE_MARK, { 'data-note': '새 풀이' }).run();
    expect(editor.getHTML()).toBe(NOTE);
    editor.destroy();
  });

  it('extendMarkRange 를 걸면 구절 전체의 풀이·자리가 바뀐다', () => {
    const editor = referenceEditor(NOTE);
    editor.chain().setTextSelection(INSIDE).extendMarkRange(PHRASE_NOTE_MARK)
      .updateAttributes(PHRASE_NOTE_MARK, { 'data-note': '새 풀이', 'data-note-pos': 'over' }).run();
    expect(editor.getHTML()).toBe('<p>푸른 <span data-note="새 풀이" data-note-pos="over">파도가</span> 온다</p>');
    editor.destroy();
  });

  it('지우기는 구절 전체에서 풀이를 걷는다', () => {
    const editor = referenceEditor(NOTE);
    editor.chain().setTextSelection(INSIDE).extendMarkRange(PHRASE_NOTE_MARK).unsetMark(PHRASE_NOTE_MARK).run();
    expect(editor.getHTML()).toBe('<p>푸른 파도가 온다</p>');
    editor.destroy();
  });

  it('⚠️ 옛 위 풀이에 걸친 범위에 새 풀이를 달면 자리가 하나로 돌아온다 — setMark 는 글자마다 옛 속성에 합친다', () => {
    const editor = referenceEditor('<p>푸른 <span data-note="옛" data-note-pos="over">파도</span>가</p>');
    editor.chain().setTextSelection({ from: 4, to: 7 }).setMark(PHRASE_NOTE_MARK, { 'data-note': '새', 'data-note-pos': null }).run();
    expect(editor.getHTML()).toBe('<p>푸른 <span data-note="새">파도가</span></p>');
    editor.destroy();
  });

  it('⚠️ 옛 낱말 뜻풀이에 걸친 범위에 새 풀이를 달면 갈래가 하나로 돌아온다 — 글자마다 어휘·해설로 갈리면 안 된다', () => {
    const editor = referenceEditor('<p>푸른 <span data-note="옛" data-note-kind="vocab">파도</span>가</p>');
    editor.chain().setTextSelection({ from: 4, to: 7 }).setMark(PHRASE_NOTE_MARK, { 'data-note': '새', 'data-note-pos': null, 'data-note-kind': null }).run();
    expect(editor.getHTML()).toBe('<p>푸른 <span data-note="새">파도가</span></p>');
    editor.destroy();
  });

  it('구절 끝에서 이어 쳐도 풀이가 늘어나지 않는다', () => {
    const editor = referenceEditor(NOTE);
    editor.chain().setTextSelection(7).insertContent('요').run();
    expect(editor.getHTML()).toBe('<p>푸른 <span data-note="심상">파도가</span>요 온다</p>');
    editor.destroy();
  });

  it('표식을 바꾸고 지운다', () => {
    const editor = referenceEditor('<p><span data-shape="box">바다</span></p>');
    editor.chain().setTextSelection(2).extendMarkRange(SHAPE_MARK).updateAttributes(SHAPE_MARK, { 'data-shape': 'star' }).run();
    expect(editor.getHTML()).toBe('<p><span data-shape="star">바다</span></p>');
    editor.chain().setTextSelection(2).extendMarkRange(SHAPE_MARK).unsetMark(SHAPE_MARK).run();
    expect(editor.getHTML()).toBe('<p>바다</p>');
    editor.destroy();
  });
});

describe('평문 붙여넣기 — 시의 행과 연을 지킨다', () => {
  it('빈 줄은 연(문단), 줄바꿈은 행(<br>)', () => {
    const element = document.createElement('div');
    document.body.appendChild(element);
    const editor = new Editor({ element, extensions: [StarterKit.configure(REFERENCE_STARTER_KIT), ...REFERENCE], content: '<p></p>' });
    pastePlainText(editor.view, '나 보기가\n역겨워\n\n가실 때에는 <b>말없이</b>');
    expect(editor.getHTML()).toBe('<p>나 보기가<br>역겨워</p><p>가실 때에는 &lt;b&gt;말없이&lt;/b&gt;</p>');
    editor.destroy();
  });
});
