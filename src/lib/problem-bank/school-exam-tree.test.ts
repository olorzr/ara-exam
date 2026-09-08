import { describe, it, expect } from 'vitest';
import { EMPTY_FILTERS, UNSPECIFIED_AXIS } from './filters';
import {
  buildSchoolExamTree, initialSideTab, schoolExamFilterPatch, schoolExamKey,
  schoolExamLeafLabel, type SchoolExamFacet,
} from './school-exam-tree';

function facet(over: Partial<SchoolExamFacet> = {}): SchoolExamFacet {
  return {
    school_name: '상현중', year: '2026', grade: '중2', semester: '1학기', exam_type: '중간',
    ...over,
  };
}

/** 트리의 라벨만 뽑아 본다 */
function labels(nodes: { label: string }[]): string[] {
  return nodes.map((n) => n.label);
}

describe('buildSchoolExamTree', () => {
  it('학교 › 학년도 › 학년 › 학기·시험 네 단계로 묶는다', () => {
    const tree = buildSchoolExamTree([facet()]);
    expect(labels(tree)).toEqual(['상현중']);
    expect(labels(tree[0].children)).toEqual(['2026학년도']);
    expect(labels(tree[0].children[0].children)).toEqual(['중2']);
    expect(labels(tree[0].children[0].children[0].children)).toEqual(['1학기 중간']);
  });

  it('학교는 한글 사전순, 학년도는 내림차순, 학년은 자연순이다', () => {
    const tree = buildSchoolExamTree([
      facet({ school_name: '태전중' }),
      facet({ school_name: '상현중', year: '2025' }),
      facet({ school_name: '상현중', year: '2026' }),
      facet({ school_name: '상현중', year: '2026', grade: '중10' }),
      facet({ school_name: '상현중', year: '2026', grade: '중2' }),
    ]);
    expect(labels(tree)).toEqual(['상현중', '태전중']);
    expect(labels(tree[0].children)).toEqual(['2026학년도', '2025학년도']);
    // '중10' 을 사전순으로 두면 '중2' 앞에 온다 — 자연순이어야 한다
    expect(labels(tree[0].children[0].children)).toEqual(['중2', '중10']);
  });

  it('잎은 학기 → 시험 순이고 미지정이 맨 뒤다', () => {
    const tree = buildSchoolExamTree([
      facet({ semester: '2학기', exam_type: '기말' }),
      facet({ semester: '', exam_type: '' }),
      facet({ semester: '1학기', exam_type: '기말' }),
      facet({ semester: '1학기', exam_type: '중간' }),
    ]);
    expect(labels(tree[0].children[0].children[0].children))
      .toEqual(['1학기 중간', '1학기 기말', '2학기 기말', '미지정 시험 미지정']);
  });

  it('학년도·학년이 비면 미지정 폴더로 가고 맨 뒤에 둔다', () => {
    const tree = buildSchoolExamTree([
      facet({ year: '' }),
      facet({ year: '2026' }),
      facet({ year: '2026', grade: '' }),
    ]);
    expect(labels(tree[0].children)).toEqual(['2026학년도', '미지정']);
    expect(labels(tree[0].children[0].children)).toEqual(['중2', '미지정']);
  });

  it('같은 갈래가 여러 번 와도 잎은 하나다 — 출처가 여러 건이어도 한 시험이다', () => {
    const tree = buildSchoolExamTree([facet(), facet(), facet()]);
    expect(tree[0].children[0].children[0].children).toHaveLength(1);
  });

  it('학교 이름이 빈 갈래는 버린다', () => {
    expect(buildSchoolExamTree([facet({ school_name: '' })])).toEqual([]);
  });

  it('빈 입력이면 빈 트리', () => {
    expect(buildSchoolExamTree([])).toEqual([]);
  });

  it('잎은 고른 갈래를 그대로 들고 있다', () => {
    const one = facet();
    const leaf = buildSchoolExamTree([one])[0].children[0].children[0].children[0];
    expect(leaf.value).toEqual(one);
    expect(leaf.id).toBe(schoolExamKey(one));
  });
});

describe('schoolExamLeafLabel', () => {
  it('학기·시험이 있으면 그대로 이어 붙인다', () => {
    expect(schoolExamLeafLabel({ semester: '2학기', exam_type: '기말' })).toBe('2학기 기말');
  });

  it('비면 미지정으로 적는다', () => {
    expect(schoolExamLeafLabel({ semester: '', exam_type: '' })).toBe('미지정 시험 미지정');
  });
});

describe('schoolExamFilterPatch', () => {
  it('학교 축을 채우고 교과서·단원을 비운다 — 두 트리가 조용히 교집합이 되면 안 된다', () => {
    const patch = schoolExamFilterPatch(facet());
    expect(patch).toEqual({
      source_type: '내신기출', school_name: '상현중', year: '2026', grade: '중2',
      semester: '1학기', exam_type: '중간', textbook: '', unit_path: [], page: 0,
    });
  });
});

describe('schoolExamFilterPatch — 미지정 갈래', () => {
  it("빈 축은 '미지정만' 으로 싣는다 — 빈 문자열은 '전체' 라 그 축이 통째로 딸려 온다", () => {
    const patch = schoolExamFilterPatch(facet({ semester: '', exam_type: '' }));
    expect(patch.semester).toBe(UNSPECIFIED_AXIS);
    expect(patch.exam_type).toBe(UNSPECIFIED_AXIS);
  });

  it('학년도·학년이 비어도 마찬가지다', () => {
    const patch = schoolExamFilterPatch(facet({ year: '', grade: '' }));
    expect(patch.year).toBe(UNSPECIFIED_AXIS);
    expect(patch.grade).toBe(UNSPECIFIED_AXIS);
  });

  it('값이 있으면 그대로 둔다', () => {
    const patch = schoolExamFilterPatch(facet());
    expect(patch.year).toBe('2026');
    expect(patch.semester).toBe('1학기');
  });
});

describe('initialSideTab', () => {
  it('학교 조건만 있으면 학교 기출 탭', () => {
    expect(initialSideTab({ ...EMPTY_FILTERS, school_name: '상현중' })).toBe('schools');
  });

  it('단원 조건이 있으면 교과서 탭', () => {
    expect(initialSideTab({ ...EMPTY_FILTERS, school_name: '상현중', unit_path: ['1. 문학'] }))
      .toBe('units');
  });

  it('아무 조건도 없으면 교과서 탭', () => {
    expect(initialSideTab(EMPTY_FILTERS)).toBe('units');
  });
});
