import { describe, it, expect } from 'vitest';
import { buildMockExamNodes, mockExamGrade, mockExamLeafLabel } from './mock-exam-tree';
import type { SchoolExamFacet } from './school-exam-tree';

function mock(over: Partial<SchoolExamFacet> = {}): SchoolExamFacet {
  return {
    source_type: '모의고사', school_name: '', year: '2026', grade: '', semester: '', exam_type: '수능',
    ...over,
  };
}

const keyOf = (f: SchoolExamFacet) => JSON.stringify([f.year, f.grade, f.exam_type]);
const labels = (nodes: { label: string }[]) => nodes.map((n) => n.label);

describe('buildMockExamNodes', () => {
  it('학년 › 학년도 › 회차 세 단계다', () => {
    const nodes = buildMockExamNodes([mock({ grade: '고1', exam_type: '3월 학평' })], keyOf);
    expect(labels(nodes)).toEqual(['고1']);
    expect(labels(nodes[0].children)).toEqual(['2026학년도']);
    expect(labels(nodes[0].children[0].children)).toEqual(['3월 학평']);
  });

  it('평가원 회차는 학년이 비어 있어도 고3 폴더에 든다 — 교육청 고3 학평과 한 폴더', () => {
    const nodes = buildMockExamNodes([mock(), mock({ grade: '고3', exam_type: '3월 학평' })], keyOf);
    expect(labels(nodes)).toEqual(['고3']);
    expect(labels(nodes[0].children[0].children)).toEqual(['수능', '3월 학평']);
  });

  it('학년은 고1 → 고2 → 고3, 학년이 빈 학평은 맨 뒤', () => {
    const nodes = buildMockExamNodes([
      mock(), mock({ grade: '', exam_type: '6월 학평' }), mock({ grade: '고2', exam_type: '9월 학평' }),
      mock({ grade: '고1', exam_type: '9월 학평' }),
    ], keyOf);
    expect(labels(nodes)).toEqual(['고1', '고2', '고3', '학년 미지정']);
  });

  it('학년도는 학년마다 최근부터, 비면 맨 뒤', () => {
    const nodes = buildMockExamNodes([
      mock({ year: '1994' }), mock({ year: '' }), mock({ year: '2027' }),
      mock({ grade: '고1', exam_type: '3월 학평', year: '2020' }),
    ], keyOf);
    expect(labels(nodes[0].children)).toEqual(['2020학년도']);
    expect(labels(nodes[1].children)).toEqual(['2027학년도', '1994학년도', '미지정']);
  });

  it('같은 학년도가 학년마다 있어도 폴더 id 가 겹치지 않는다', () => {
    const nodes = buildMockExamNodes([
      mock({ grade: '고1', exam_type: '3월 학평' }), mock({ grade: '고2', exam_type: '3월 학평' }),
    ], keyOf);
    const ids = [...nodes.map((n) => n.id), ...nodes.flatMap((n) => n.children.map((c) => c.id))];
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('잎은 평가원 회차 먼저 수능 → 9월 → 6월 → 예비, 그다음 학평이 늦은 달부터', () => {
    const nodes = buildMockExamNodes([
      mock({ exam_type: '6월 모평' }), mock({ exam_type: '예시문항' }), mock({ exam_type: '9월 모평' }), mock(),
      mock({ grade: '고3', exam_type: '3월 학평' }), mock({ grade: '고3', exam_type: '10월 학평' }),
    ], keyOf);
    expect(labels(nodes[0].children[0].children))
      .toEqual(['수능', '9월 모평', '6월 모평', '예시문항', '10월 학평', '3월 학평']);
  });

  it('잎 id 는 넘겨받은 함수로 만들고 갈래를 그대로 든다', () => {
    const one = mock();
    const leaf = buildMockExamNodes([one], keyOf)[0].children[0].children[0];
    expect(leaf.id).toBe(keyOf(one));
    expect(leaf.value).toEqual(one);
  });
});

describe('mockExamGrade', () => {
  it('평가원 회차는 늘 고3, 학평은 저장된 학년', () => {
    expect(mockExamGrade({ grade: '', exam_type: '수능' })).toBe('고3');
    expect(mockExamGrade({ grade: '고2', exam_type: '9월 학평' })).toBe('고2');
    expect(mockExamGrade({ grade: '', exam_type: '9월 학평' })).toBe('');
  });
});

describe('mockExamLeafLabel', () => {
  it('학년은 폴더가 말하므로 회차만', () => {
    expect(mockExamLeafLabel({ exam_type: '9월 모평' })).toBe('9월 모평');
    expect(mockExamLeafLabel({ exam_type: '3월 학평' })).toBe('3월 학평');
  });

  it('회차가 비면 회차 미지정', () => {
    expect(mockExamLeafLabel({ exam_type: '' })).toBe('회차 미지정');
  });
});
