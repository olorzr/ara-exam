import { describe, it, expect } from 'vitest';
import { getSchema } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { Table, TableRow } from '@tiptap/extension-table';
import { CustomTableCell, CustomTableHeader } from '@/components/exam-builder/CustomTableCell';
import { findMarkTarget } from './concept-mark-target';

// 편집기와 **같은 확장 묶음**으로 문서를 만든다 — 문서 모양이 다르면 검사가 거짓말을 한다
const schema = getSchema([
  StarterKit.configure({ heading: { levels: [3, 4] } }),
  Table, TableRow, CustomTableCell, CustomTableHeader,
]);

const p = (text: string) => ({ type: 'paragraph', content: [{ type: 'text', text }] });
const cell = (text: string) => ({ type: 'tableCell', content: [p(text)] });

/** 시 본문 한 줄 + 그 아래 풀이 표 — 개념지의 가장 흔한 모양 */
const doc = schema.nodeFromJSON({
  type: 'doc',
  content: [
    p('나무는 흔들리며 서 있다'),
    {
      type: 'table',
      content: [
        { type: 'tableRow', content: [cell('나무'), cell('꿈을 지닌 대상')] },
      ],
    },
  ],
});

const textAt = (target: { from: number; to: number } | null) =>
  (target ? doc.textBetween(target.from, target.to) : null);

describe('findMarkTarget', () => {
  it('자리 힌트가 가리키는 자리를 고른다', () => {
    const target = findMarkTarget(doc, '나무', '| 나무 | 꿈을 지닌 대상 |');
    expect(textAt(target)).toBe('나무');
    // 시 본문(문서 첫머리)이 아니라 표 쪽이어야 한다
    expect(target!.from).toBeGreaterThan(doc.child(0).nodeSize);
  });

  it('힌트가 없으면 표 칸을 먼저 본다 — 작품 원문에 구멍을 내지 않는다', () => {
    const target = findMarkTarget(doc, '나무');
    expect(target!.from).toBeGreaterThan(doc.child(0).nodeSize);
  });

  it('힌트가 본문 쪽을 가리키면 그 자리를 고른다', () => {
    const target = findMarkTarget(doc, '나무', '나무는 흔들리며 서 있다');
    expect(target!.from).toBeLessThan(doc.child(0).nodeSize);
  });

  it('공백·구분 기호가 달라도 힌트를 알아본다 — 평문에는 | 가 있고 문서에는 없다', () => {
    const target = findMarkTarget(doc, '대상', '|나무|꿈을 지닌 대상|');
    expect(textAt(target)).toBe('대상');
  });

  it('표가 없으면 처음 나오는 자리', () => {
    const plainDoc = schema.nodeFromJSON({
      type: 'doc', content: [p('서정시다'), p('다시 서정시')],
    });
    const target = findMarkTarget(plainDoc, '서정시');
    expect(target).toEqual({ from: 1, to: 4 });
  });

  it('한 상자 안에 문장이 둘이면 힌트가 맞는 문장을 고른다 — 조상이 담기만 한 것으로는 모자라다', () => {
    // 코덱스 리뷰가 재현한 자리: 둘 다 같은 인용 상자를 조상으로 가진다
    const quoted = schema.nodeFromJSON({
      type: 'doc',
      content: [{
        type: 'blockquote',
        content: [p('나무는 흔들린다'), p('나무는 꿈을 지닌 대상이다')],
      }],
    });
    const target = findMarkTarget(quoted, '나무', '나무는 꿈을 지닌 대상이다');
    expect(quoted.textBetween(target!.from, target!.to)).toBe('나무');
    // 첫 문장이 아니라 둘째 문장이어야 한다
    expect(target!.from).toBeGreaterThan(quoted.child(0).child(0).nodeSize);
  });

  it('목록·제목에서 베낀 힌트도 알아본다 — 평문의 "-"·"#" 는 편집기 문서에 없다', () => {
    const listed = schema.nodeFromJSON({
      type: 'doc',
      content: [
        p('의인법이 쓰였다'),
        {
          type: 'bulletList',
          content: [{ type: 'listItem', content: [p('표현법은 의인법이다')] }],
        },
      ],
    });
    const target = findMarkTarget(listed, '의인법', '- 표현법은 의인법이다');
    expect(target!.from).toBeGreaterThan(listed.child(0).nodeSize);
  });

  it('같은 문단에 두 번 나오면 힌트가 덮는 구간 안쪽을 고른다 — 조상만 보면 앞것이 늘 이긴다', () => {
    // 코덱스 리뷰 2R 이 재현한 자리: 두 자리가 **똑같은 문단**을 조상으로 가진다
    const twice = schema.nodeFromJSON({
      type: 'doc', content: [p('나무는 흔들린다. 나무는 꿈을 지닌 대상이다')],
    });
    const target = findMarkTarget(twice, '나무', '나무는 꿈을 지닌 대상이다');
    expect(target!.from).toBe(twice.textContent.indexOf('나무는 꿈') + 1);
  });

  it('글자 그대로 맞는 자리가 기호만 지워 맞는 자리를 이긴다', () => {
    // 느슨한 세기는 '-' 를 지워 '가-나의 대비' 도 맞다고 본다 — 그래서 엄격한 쪽을 먼저 본다
    const dashed = schema.nodeFromJSON({
      type: 'doc', content: [p('가-나의 대비'), p('가나의 대비')],
    });
    const target = findMarkTarget(dashed, '대비', '가나의 대비');
    expect(target!.from).toBeGreaterThan(dashed.child(0).nodeSize);
  });

  it('없는 말은 null — 호출부가 "못 붙였다" 고 셀 수 있어야 한다', () => {
    expect(findMarkTarget(doc, '역설법')).toBeNull();
    expect(findMarkTarget(doc, '')).toBeNull();
  });

  it('맞는 힌트가 없으면 힌트를 무시하고 표로 물러선다 — 추천을 버리지 않는다', () => {
    const target = findMarkTarget(doc, '나무', '본문에 없는 구절');
    expect(textAt(target)).toBe('나무');
    expect(target!.from).toBeGreaterThan(doc.child(0).nodeSize);
  });
});
