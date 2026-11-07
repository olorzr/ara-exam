import { describe, expect, it } from 'vitest';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import {
  MARKS_INSIDE_SHAPE, boxRunAt, selectionInOneNote, selectionSplitsBox, shapeEditRange, shapeWouldCrossNote,
} from './phrase-mark-rules';
import { REFERENCE_STARTER_KIT, WORKBOOK_EXTENSIONS } from './WorkbookExtensions';
import { PHRASE_NOTE_MARK, SHAPE_MARK } from './WorkbookMarks';

/** 참고자료 편집기와 같은 마크를 든 편집기 */
function buildEditor(html: string): Editor {
  return new Editor({ extensions: [StarterKit.configure(REFERENCE_STARTER_KIT), ...WORKBOOK_EXTENSIONS], content: html });
}

/** 범위를 고른 상태로 판정을 부른다 */
function judge(html: string, from: number, to: number) {
  const editor = buildEditor(html);
  editor.commands.setTextSelection({ from, to });
  const result = {
    splits: selectionSplitsBox(editor.state),
    splitsForShape: selectionSplitsBox(editor.state, MARKS_INSIDE_SHAPE),
    crosses: shapeWouldCrossNote(editor.state),
    inNote: selectionInOneNote(editor.state),
  };
  editor.destroy();
  return result;
}

describe('selectionSplitsBox', () => {
  const SHAPE = '<p>앞 <span data-shape="box">푸른 파도가</span> 뒤</p>';

  it('표식 일부에 풀이를 달면 표식이 갈라진다', () => {
    expect(judge(SHAPE, 6, 8).splits).toBe(true);
  });

  it('표식 전체 또는 표식을 품은 범위는 갈라지지 않는다', () => {
    expect(judge(SHAPE, 3, 9).splits).toBe(false);
    expect(judge(SHAPE, 1, 11).splits).toBe(false);
  });

  it('표식에 걸치기만 해도 갈라진다', () => {
    expect(judge(SHAPE, 1, 5).splits).toBe(true);
  });

  it('⚠️ 기존 네모(code)도 표식처럼 갈라진다', () => {
    const html = '<p><code>푸른 파도가</code></p>';
    expect(judge(html, 4, 6).splits).toBe(true);
    expect(judge(html, 1, 7).splits).toBe(false);
  });

  it('⚠️ 네모 일부에 표식을 그려도 네모가 갈라진다 — 표식이 네모의 바깥이다', () => {
    const html = '<p><code>푸른 파도가</code></p>';
    expect(judge(html, 4, 6).splitsForShape).toBe(true);
    expect(judge(html, 1, 7).splitsForShape).toBe(false);
  });

  it('표식을 그릴 때는 다른 표식을 안 본다 — 덮어쓰는 것이라 갈라지지 않는다', () => {
    expect(judge('<p><span data-shape="box">푸른 파도</span></p>', 4, 6).splitsForShape).toBe(false);
  });

  it('⚠️ 줄바꿈으로 시작하는 범위도 표식에 걸린다', () => {
    expect(judge('<p><span data-shape="box">가<br></span>나</p>', 2, 4).splits).toBe(true);
  });

  it('표식이 없으면 갈라질 것이 없다', () => {
    expect(judge('<p>푸른 파도가</p>', 2, 4).splits).toBe(false);
  });
});

describe('selectionInOneNote', () => {
  const NOTE = '<p>앞<span data-note="풀이">구절</span>뒤</p>';

  it('풀이 안쪽·풀이 전체는 든다', () => {
    expect(judge(NOTE, 2, 3).inNote).toBe(true);
    expect(judge(NOTE, 2, 4).inNote).toBe(true);
  });

  it('풀이 밖으로 나가면 안 든다', () => {
    expect(judge(NOTE, 1, 3).inNote).toBe(false);
    expect(judge(NOTE, 3, 5).inNote).toBe(false);
  });

  it('⚠️ 줄바꿈으로 시작하는 범위는 안 든다 — isActive 는 표시 없는 줄바꿈을 건너뛴다', () => {
    expect(judge('<p><br><span data-note="같은">구절이다</span></p>', 1, 4).inNote).toBe(false);
  });
});

describe('표식 한 덩이는 풀이 경계에서 끊긴다', () => {
  /** 풀이 안 □ 바로 뒤의 다른 □ — 모델에서는 이어져 있어도 화면에서는 두 네모다 */
  const TWO = '<p><span data-note="풀이"><span data-shape="box">자립</span></span><span data-shape="box">형태소</span></p>';

  it('⚠️ 글자 하나짜리 표식은 자기 덩이로 잰다 — 다음 글자의 다른 표식으로 재면 판정이 틀린다', () => {
    const html = '<p><span data-shape="box"><strong>푸른</strong>파</span><span data-shape="circle">도</span></p>';
    expect(judge(html, 3, 5).splits).toBe(true);
  });

  it('같은 뜻이어도 갈래가 다르면 다른 풀이다', () => {
    const editor = buildEditor('<p><span data-note="뜻">가나</span><span data-note="뜻" data-note-kind="vocab">다라</span></p>');
    expect(boxRunAt(editor.state, 1, PHRASE_NOTE_MARK)).toEqual({ from: 1, to: 3 });
    expect(boxRunAt(editor.state, 3, PHRASE_NOTE_MARK)).toEqual({ from: 3, to: 5 });
    editor.destroy();
  });

  it('덩이는 풀이가 달라지는 자리에서 끝난다', () => {
    const editor = buildEditor(TWO);
    expect(boxRunAt(editor.state, 1)).toEqual({ from: 1, to: 3 });
    expect(boxRunAt(editor.state, 4)).toEqual({ from: 3, to: 6 });
    editor.destroy();
  });

  it('⚠️ 네모는 바깥 표식이 달라지는 자리에서도 끝난다 — 표식이 네모의 바깥이라 화면에서 두 네모다', () => {
    const html = '<p><span data-shape="star"><code>abc</code></span><code>def</code></p>';
    expect(judge(html, 4, 7).splits).toBe(false);
    expect(judge(html, 4, 7).splitsForShape).toBe(false);
    expect(judge(html, 5, 7).splits).toBe(true);
  });

  it('둘째 네모 전체에는 풀이를 달 수 있다', () => {
    expect(judge(TWO, 3, 6).splits).toBe(false);
  });

  it('⚠️ 둘째 네모를 지워도 풀이 안 네모는 남는다', () => {
    const editor = buildEditor(TWO);
    editor.commands.setTextSelection(4);
    editor.chain().setTextSelection(shapeEditRange(editor.state)).unsetMark(SHAPE_MARK).run();
    expect(editor.getHTML()).toBe('<p><span data-note="풀이"><span data-shape="box">자립</span></span>형태소</p>');
    editor.destroy();
  });

  it('⚠️ 둘째 네모만 모양을 바꾼다', () => {
    const editor = buildEditor(TWO);
    editor.commands.setTextSelection(4);
    editor.chain().setTextSelection(shapeEditRange(editor.state)).updateAttributes(SHAPE_MARK, { 'data-shape': 'star' }).run();
    expect(editor.getHTML()).toContain('<span data-shape="box">자립</span>');
    expect(editor.getHTML()).toContain('<span data-shape="star">형태소</span>');
    editor.destroy();
  });

  it('두 덩이에 걸친 범위는 양쪽 덩이 끝까지 넓힌다', () => {
    const editor = buildEditor(TWO);
    editor.commands.setTextSelection({ from: 2, to: 4 });
    expect(shapeEditRange(editor.state)).toEqual({ from: 1, to: 6 });
    editor.destroy();
  });
});

describe('shapeWouldCrossNote', () => {
  const NOTE = '<p>앞 <span data-note="풀이">푸른 파도가</span> 뒤</p>';

  it('풀이 안쪽·풀이 전체·풀이 밖은 넘지 않는다', () => {
    expect(judge(NOTE, 4, 6).crosses).toBe(false);
    expect(judge(NOTE, 3, 9).crosses).toBe(false);
    expect(judge(NOTE, 1, 3).crosses).toBe(false);
  });

  it('풀이 경계에 걸치면 넘는다', () => {
    expect(judge(NOTE, 1, 5).crosses).toBe(true);
    expect(judge(NOTE, 7, 11).crosses).toBe(true);
    expect(judge(NOTE, 1, 11).crosses).toBe(true);
  });

  it('다른 풀이 둘에 걸치면 넘는다', () => {
    expect(judge('<p><span data-note="가">앞</span><span data-note="나">뒤</span></p>', 1, 3).crosses).toBe(true);
  });
});
