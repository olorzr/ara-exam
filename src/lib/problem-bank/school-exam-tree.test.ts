import { describe, it, expect } from 'vitest';
import { EMPTY_FILTERS, UNSPECIFIED_AXIS } from './filters';
import {
  buildSchoolExamTree, initialSideTab, schoolExamFilterPatch, schoolExamKey,
  schoolExamLeafLabel, type FacetTreeNode, type SchoolExamFacet,
} from './school-exam-tree';

/** 학교급 가지 하나 아래(= 학교부터)를 꺼낸다 — 예전 테스트는 학교가 맨 위였다 */
function schoolsUnder(tree: FacetTreeNode<SchoolExamFacet>[], level = '중등') {
  const root = tree.find((n) => n.label === level);
  if (!root) throw new Error(`${level} 가지가 없다`);
  return root.children;
}

function facet(over: Partial<SchoolExamFacet> = {}): SchoolExamFacet {
  return {
    source_type: '내신기출', school_name: '상현중', year: '2026', grade: '중2', semester: '1학기', exam_type: '중간',
    ...over,
  };
}

/** 트리의 라벨만 뽑아 본다 */
function labels(nodes: { label: string }[]): string[] {
  return nodes.map((n) => n.label);
}

describe('buildSchoolExamTree', () => {
  it('학교 › 학년도 › 학년 › 학기·시험 네 단계로 묶는다', () => {
    const tree = schoolsUnder(buildSchoolExamTree([facet()]));
    expect(labels(tree)).toEqual(['상현중']);
    expect(labels(tree[0].children)).toEqual(['2026학년도']);
    expect(labels(tree[0].children[0].children)).toEqual(['중2']);
    expect(labels(tree[0].children[0].children[0].children)).toEqual(['1학기 중간']);
  });

  it('학교는 한글 사전순, 학년도는 내림차순, 학년은 자연순이다', () => {
    const tree = schoolsUnder(buildSchoolExamTree([
      facet({ school_name: '태전중' }),
      facet({ school_name: '상현중', year: '2025' }),
      facet({ school_name: '상현중', year: '2026' }),
      facet({ school_name: '상현중', year: '2026', grade: '중10' }),
      facet({ school_name: '상현중', year: '2026', grade: '중2' }),
    ]));
    expect(labels(tree)).toEqual(['상현중', '태전중']);
    expect(labels(tree[0].children)).toEqual(['2026학년도', '2025학년도']);
    // '중10' 을 사전순으로 두면 '중2' 앞에 온다 — 자연순이어야 한다
    expect(labels(tree[0].children[0].children)).toEqual(['중2', '중10']);
  });

  it('잎은 학기 → 시험 순이고 미지정이 맨 뒤다', () => {
    const tree = schoolsUnder(buildSchoolExamTree([
      facet({ semester: '2학기', exam_type: '기말' }),
      facet({ semester: '', exam_type: '' }),
      facet({ semester: '1학기', exam_type: '기말' }),
      facet({ semester: '1학기', exam_type: '중간' }),
    ]));
    expect(labels(tree[0].children[0].children[0].children))
      .toEqual(['1학기 중간', '1학기 기말', '2학기 기말', '미지정 시험 미지정']);
  });

  it('학년도·학년이 비면 미지정 폴더로 가고 맨 뒤에 둔다', () => {
    const tree = schoolsUnder(buildSchoolExamTree([
      facet({ year: '' }),
      facet({ year: '2026' }),
      facet({ year: '2026', grade: '' }),
    ]));
    expect(labels(tree[0].children)).toEqual(['2026학년도', '미지정']);
    expect(labels(tree[0].children[0].children)).toEqual(['중2', '미지정']);
  });

  it('같은 갈래가 여러 번 와도 잎은 하나다 — 출처가 여러 건이어도 한 시험이다', () => {
    const tree = schoolsUnder(buildSchoolExamTree([facet(), facet(), facet()]));
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
    const leaf = schoolsUnder(buildSchoolExamTree([one]))[0].children[0].children[0].children[0];
    expect(leaf.value).toEqual(one);
    expect(leaf.id).toBe(schoolExamKey(one));
  });
});

describe('buildSchoolExamTree — 맨 위 가지', () => {
  const mock = (over: Partial<SchoolExamFacet> = {}) => facet({
    source_type: '모의고사', school_name: '', grade: '고3', semester: '', exam_type: '수능', ...over,
  });

  it('고등 / 중등 / 모의고사·수능 순서다 — 사용자가 적어 준 순서', () => {
    const tree = buildSchoolExamTree([
      mock(), facet({ school_name: '상현중' }), facet({ school_name: '무학여고', grade: '고1' }),
    ]);
    expect(labels(tree)).toEqual(['고등', '중등', '모의고사·수능']);
    expect(labels(tree[0].children)).toEqual(['무학여고']);
  });

  it('비어 있는 가지는 그리지 않는다', () => {
    expect(labels(buildSchoolExamTree([facet()]))).toEqual(['중등']);
    expect(labels(buildSchoolExamTree([mock()]))).toEqual(['모의고사·수능']);
  });

  it('학년이 빈 출처도 그 학교의 학교급 가지에 붙는다 — 한 학교가 두 곳에 그려지지 않는다', () => {
    const tree = buildSchoolExamTree([facet(), facet({ grade: '', exam_type: '기말' })]);
    expect(labels(tree)).toEqual(['중등']);
    expect(labels(tree[0].children[0].children[0].children)).toEqual(['중2', '미지정']);
  });

  it('학년이 모두 빈 학교는 맨 뒤 학교급 미지정 가지에 둔다 — 버리면 찾을 길이 없다', () => {
    const tree = buildSchoolExamTree([facet({ school_name: '어느학교', grade: '' }), mock()]);
    expect(labels(tree)).toEqual(['학교급 미지정', '모의고사·수능']);
  });

  it('평가원 회차는 학년이 비어도 고3 과 한 잎이다 — 한 시험이 두 잎으로 갈리면 안 된다', () => {
    const tree = buildSchoolExamTree([mock(), mock({ grade: '' })]);
    const leaves = tree[0].children[0].children;
    expect(leaves.map((n) => n.label)).toEqual(['수능']);
    expect(schoolExamFilterPatch(leaves[0].value!).grade).toBe('');
  });

  it('모의고사에 학교·학기가 남아 있어도 같은 회차는 잎 하나다', () => {
    const tree = buildSchoolExamTree([mock(), mock({ school_name: '상현중', semester: '1학기' })]);
    const leaves = tree[0].children[0].children;
    expect(leaves.map((n) => n.label)).toEqual(['수능']);
    expect(leaves[0].value).toMatchObject({ school_name: '', semester: '' });
  });

  it('문제집·프린트는 트리에 오지 않는다', () => {
    expect(buildSchoolExamTree([facet({ source_type: '문제집' })])).toEqual([]);
  });

  it('노드 id 가 가지마다 고유하다', () => {
    const tree = buildSchoolExamTree([facet(), facet({ school_name: '무학여고', grade: '고1' }), mock()]);
    const ids: string[] = [];
    const walk = (nodes: FacetTreeNode<SchoolExamFacet>[]) => nodes.forEach((n) => { ids.push(n.id); walk(n.children); });
    walk(tree);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('schoolExamFilterPatch — 모의고사', () => {
  it('학교·학기를 비우고 학년도·학년·회차를 건다', () => {
    const patch = schoolExamFilterPatch(facet({
      source_type: '모의고사', school_name: '', grade: '고3', semester: '', exam_type: '6월 모평', year: '2027',
    }));
    expect(patch).toEqual({
      source_type: '모의고사', school_name: '', year: '2027', grade: '', school_level: '',
      semester: '', exam_type: '6월 모평', textbook: '', unit_path: [], work_title: '',
      grammar_path: [], page: 0,
    });
  });

  it('교육청 학평은 학년을 건다 — 같은 달에 고1·고2·고3 이 따로 있다', () => {
    const patch = schoolExamFilterPatch(facet({
      source_type: '모의고사', school_name: '', grade: '고1', semester: '', exam_type: '3월 학평',
    }));
    expect(patch.grade).toBe('고1');
  });

  it("회차가 비면 '미지정만' 으로 싣는다", () => {
    const patch = schoolExamFilterPatch(facet({ source_type: '모의고사', school_name: '', exam_type: '' }));
    expect(patch.exam_type).toBe(UNSPECIFIED_AXIS);
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
      source_type: '내신기출', school_name: '상현중', year: '2026', grade: '중2', school_level: '',
      semester: '1학기', exam_type: '중간', textbook: '', unit_path: [], work_title: '',
      grammar_path: [], page: 0,
    });
  });

  /**
   * 네 트리는 서로의 축을 비운다. 문법만 빠져 있으면 계약이 반쪽이 되어,
   * 문법을 고른 뒤 학교를 고르면 두 조건이 조용히 겹친다.
   */
  it('문법 축도 비운다', () => {
    expect(schoolExamFilterPatch(facet()).grammar_path).toEqual([]);
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
  it('학교 조건만 있으면 기출 탭', () => {
    expect(initialSideTab({ ...EMPTY_FILTERS, school_name: '상현중' })).toBe('schools');
  });

  it('유형이 모의고사면 학교가 없어도 기출 탭 — 모의고사·수능 가지가 거기 있다', () => {
    expect(initialSideTab({ ...EMPTY_FILTERS, source_type: '모의고사' })).toBe('schools');
  });

  it('단원 조건이 있으면 교과서 탭', () => {
    expect(initialSideTab({ ...EMPTY_FILTERS, school_name: '상현중', unit_path: ['1. 문학'] }))
      .toBe('units');
  });

  it('아무 조건도 없으면 교과서 탭', () => {
    expect(initialSideTab(EMPTY_FILTERS)).toBe('units');
  });

  it('작품 조건만 있으면 작품 탭 — 링크를 받아 열었을 때 왜 이 목록인지 보여야 한다', () => {
    expect(initialSideTab({ ...EMPTY_FILTERS, work_title: '동백꽃' })).toBe('works');
  });

  it('단원 조건이 함께 있으면 교과서 탭', () => {
    expect(initialSideTab({ ...EMPTY_FILTERS, work_title: '동백꽃', unit_path: ['1. 문학'] }))
      .toBe('units');
  });

  it('문법 조건만 있으면 문법 탭 — 개념은 트리에서 봐야 어느 가지인지 안다', () => {
    expect(initialSideTab({ ...EMPTY_FILTERS, grammar_path: ['단어', '품사'] })).toBe('grammar');
  });

  it('문법이 다른 축보다 먼저다', () => {
    expect(initialSideTab({
      ...EMPTY_FILTERS, grammar_path: ['음운'], school_name: '상현중', work_title: '동백꽃',
    })).toBe('grammar');
  });

  it('단원 조건이 함께 있으면 교과서 탭 (문법이어도)', () => {
    expect(initialSideTab({ ...EMPTY_FILTERS, grammar_path: ['음운'], unit_path: ['1. 문학'] }))
      .toBe('units');
  });
});
