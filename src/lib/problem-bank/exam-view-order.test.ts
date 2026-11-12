import { describe, expect, it } from 'vitest';
import type { Bbox, QuestionType } from '@/types/problem-bank';
import { compareExamProblems, groupExamItems } from './exam-view-order';

function q(id: string, number: number | null, passage_id: string | null, question_type: QuestionType = '객관식', page_no = 1) {
  return { id, number, passage_id, question_type, page_no };
}

function p(id: string, page_no = 1, bbox: Bbox | null = null) {
  return { id, page_no, bbox };
}

/** 덩어리를 읽기 쉬운 글자로 */
function shape(blocks: ReturnType<typeof groupExamItems>): string[] {
  return blocks.map((b) => {
    const head = b.passage ? b.passage.id : b.repeatOf ? `↺${b.repeatOf.id}` : '-';
    return `${head}:${b.problems.map((x) => x.id).join(',')}`;
  });
}

describe('compareExamProblems', () => {
  it('서술형은 뒤로, 그 안에서 번호 차례, 번호 없는 것은 뒤', () => {
    const rows = [q('s1', 1, null, '서술형'), q('b', 2, null), q('n', null, null), q('a', 1, null), q('s2', 2, null, '서술형')];
    expect([...rows].sort(compareExamProblems).map((r) => r.id)).toEqual(['a', 'b', 'n', 's1', 's2']);
  });

  it('한 쪽에 서술형이 객관식보다 앞에 있어도 뒤로 간다(조회는 쪽 → 번호 차례다)', () => {
    const rows = [q('s1', 1, null, '서술형', 3), q('o18', 18, null, '객관식', 3)];
    expect([...rows].sort(compareExamProblems).map((r) => r.id)).toEqual(['o18', 's1']);
  });
});

describe('groupExamItems', () => {
  it('같은 지문이 이어지면 한 덩어리, 지문 없는 문항은 제자리', () => {
    const blocks = groupExamItems([p('A'), p('B')], [
      q('1', 1, 'A'), q('2', 2, 'A'), q('3', 3, null), q('4', 4, 'B'), q('5', 5, 'B'),
    ]);
    expect(shape(blocks)).toEqual(['A:1,2', '-:3', 'B:4,5']);
  });

  it('지문 없는 문항이 이어지면 한 덩어리다', () => {
    expect(shape(groupExamItems([], [q('1', 1, null), q('2', 2, null)]))).toEqual(['-:1,2']);
  });

  it('앞에서 찍은 지문이 서술형에서 다시 나오면 본문 없이 가리키고, 연달은 서술형은 한 덩어리다', () => {
    const blocks = groupExamItems([p('A'), p('B')], [
      q('1', 1, 'A'), q('2', 2, 'B'), q('s1', 1, 'A', '서술형'), q('s2', 2, 'A', '서술형'), q('s3', 3, 'B', '서술형'),
    ]);
    expect(shape(blocks)).toEqual(['A:1', 'B:2', '↺A:s1,s2', '↺B:s3']);
  });

  it('문항이 없는 지문은 읽는 차례로 맨 뒤에 붙는다', () => {
    const blocks = groupExamItems(
      [p('late', 2), p('right', 1, { x: 0.55, y: 0.1, w: 0.4, h: 0.3 }), p('left', 1, { x: 0.05, y: 0.1, w: 0.4, h: 0.3 }), p('A')],
      [q('1', 1, 'A')],
    );
    expect(shape(blocks)).toEqual(['A:1', 'left:', 'right:', 'late:']);
  });

  it('사라진 지문을 가리키는 문항은 지문 없는 문항으로 그린다', () => {
    expect(shape(groupExamItems([], [q('1', 1, 'gone')]))).toEqual(['-:1']);
  });
});
