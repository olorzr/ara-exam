import { describe, it, expect } from 'vitest';
import { buildMockExamNodes, mockExamLeafLabel } from './mock-exam-tree';
import type { SchoolExamFacet } from './school-exam-tree';

function mock(over: Partial<SchoolExamFacet> = {}): SchoolExamFacet {
  return {
    source_type: '모의고사', school_name: '', year: '2026', grade: '고3', semester: '', exam_type: '수능',
    ...over,
  };
}

const keyOf = (f: SchoolExamFacet) => JSON.stringify([f.year, f.grade, f.exam_type]);

describe('buildMockExamNodes', () => {
  it('학년도 › 회차 두 단계다', () => {
    const nodes = buildMockExamNodes([mock()], keyOf);
    expect(nodes.map((n) => n.label)).toEqual(['2026학년도']);
    expect(nodes[0].children.map((n) => n.label)).toEqual(['수능']);
  });

  it('학년도는 최근부터, 비면 맨 뒤', () => {
    const nodes = buildMockExamNodes([mock({ year: '1994' }), mock({ year: '' }), mock({ year: '2027' })], keyOf);
    expect(nodes.map((n) => n.label)).toEqual(['2027학년도', '1994학년도', '미지정']);
  });

  it('잎은 수능 → 9월 → 6월 → 예비 순이다 — 늦은 시험부터', () => {
    const nodes = buildMockExamNodes([
      mock({ exam_type: '6월 모평' }), mock({ exam_type: '예시문항' }), mock({ exam_type: '9월 모평' }), mock(),
    ], keyOf);
    expect(nodes[0].children.map((n) => n.label)).toEqual(['수능', '9월 모평', '6월 모평', '예시문항']);
  });

  it('교육청 학평은 학년을 붙이고 고3 뒤에 둔다', () => {
    const nodes = buildMockExamNodes([mock({ grade: '고1', exam_type: '3월 학평' }), mock()], keyOf);
    expect(nodes[0].children.map((n) => n.label)).toEqual(['수능', '고1 3월 학평']);
  });

  it('잎 id 는 넘겨받은 함수로 만들고 갈래를 그대로 든다', () => {
    const one = mock();
    const leaf = buildMockExamNodes([one], keyOf)[0].children[0];
    expect(leaf.id).toBe(keyOf(one));
    expect(leaf.value).toEqual(one);
  });
});

describe('mockExamLeafLabel', () => {
  it('고3 이면 회차만', () => {
    expect(mockExamLeafLabel({ grade: '고3', exam_type: '9월 모평' })).toBe('9월 모평');
  });

  it('교육청 학평은 고3 이어도 학년을 붙인다 — 학년이 빈 출처와 이름이 같아지면 안 된다', () => {
    expect(mockExamLeafLabel({ grade: '고3', exam_type: '3월 학평' })).toBe('고3 3월 학평');
    expect(mockExamLeafLabel({ grade: '', exam_type: '3월 학평' })).toBe('학년 미지정 3월 학평');
  });

  it('회차가 비면 회차 미지정', () => {
    expect(mockExamLeafLabel({ grade: '', exam_type: '' })).toBe('학년 미지정 회차 미지정');
  });
});
