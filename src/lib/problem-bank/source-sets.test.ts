import { describe, expect, it } from 'vitest';
import type { SourceSetRow } from './source-sets-payload';
import {
  compareSourceSets, mockSubject, orderSetSources, setExamLabel, setIssueNo, setLevel, setNamesSummary,
  setTextbookLabel, sourceSetKey, sourceSetOf, toSourceSets, type SourceSet,
} from './source-sets';

function school(over: Partial<SourceSetRow> = {}): SourceSetRow {
  return {
    source_type: '내신기출', year: '2026', grade: '중2', semester: '1학기', exam_type: '중간',
    textbook: '비상(박영민)', publisher: '', exam_count: 1, names: ['무학중학교'], ...over,
  };
}

function mock(over: Partial<SourceSetRow> = {}): SourceSetRow {
  return {
    source_type: '모의고사', year: '2027', grade: '고3', semester: '', exam_type: '6월 모평',
    textbook: '', publisher: '평가원', exam_count: 1, names: ['2027학년도 6월 모평 (공통)'], ...over,
  };
}

describe('sourceSetKey', () => {
  it('이름에 구분자처럼 보이는 글자가 있어도 다른 세트와 섞이지 않는다', () => {
    const a = sourceSetKey({ ...school(), textbook: 'A|B', publisher: '' });
    const b = sourceSetKey({ ...school(), textbook: 'A', publisher: 'B' });
    expect(a).not.toBe(b);
  });
});

describe('toSourceSets', () => {
  it('평가원 회차는 학년이 빈 출처와 고3 출처를 한 세트로 합친다', () => {
    const sets = toSourceSets([
      mock({ grade: '', exam_count: 1, names: ['2027학년도 6월 모평 (언어와 매체)'] }),
      mock({ grade: '고3', exam_count: 2, names: ['2027학년도 6월 모평 (화법과 작문)', '2027학년도 6월 모평 (공통)'] }),
    ]);
    expect(sets).toHaveLength(1);
    expect(sets[0].grade).toBe('고3');
    expect(sets[0].exam_count).toBe(3);
    // 공통이 먼저, 나머지는 가나다
    expect(sets[0].names.map(mockSubject)).toEqual(['공통', '언어와 매체', '화법과 작문']);
  });

  it('교육청 학평은 학년마다 다른 세트다', () => {
    const sets = toSourceSets([
      mock({ grade: '고1', exam_type: '3월 학평', publisher: '교육청' }),
      mock({ grade: '고2', exam_type: '3월 학평', publisher: '교육청' }),
    ]);
    expect(sets).toHaveLength(2);
  });

  it('내신 학교 이름은 가나다로 정렬한다', () => {
    const [set] = toSourceSets([school({ names: ['한대부중', '광희중', '무학중'] })]);
    expect(set.names).toEqual(['광희중', '무학중', '한대부중']);
  });
});

describe('compareSourceSets', () => {
  it('내신이 먼저, 최근 학년도부터, 학년 → 늦은 시험부터(2학기 → 1학기, 기말 → 중간) → 교과서(미지정은 뒤)', () => {
    const rows = [
      school({ year: '2025' }),
      mock(),
      school({ grade: '고1' }),
      school({ textbook: '' }),
      school({ exam_type: '기말' }),
      school({ semester: '2학기' }),
      school({ textbook: '동아' }),
      school(),
    ];
    const order = toSourceSets(rows).sort(compareSourceSets).map((s) => sourceSetKey(s));
    const want = [
      school({ semester: '2학기' }), school({ exam_type: '기말' }), school({ textbook: '동아' }), school(),
      school({ textbook: '' }), school({ grade: '고1' }), school({ year: '2025' }), mock(),
    ].map((s) => sourceSetKey(s));
    expect(order).toEqual(want);
  });

  it('모의고사는 학년 → 회차(수능 먼저, 늦은 달부터)', () => {
    const rows = [
      mock({ exam_type: '6월 모평' }),
      mock({ exam_type: '수능' }),
      mock({ grade: '고1', exam_type: '3월 학평', publisher: '교육청' }),
      mock({ exam_type: '9월 모평' }),
    ];
    const order = toSourceSets(rows).sort(compareSourceSets).map((s) => `${s.grade} ${s.exam_type}`);
    expect(order).toEqual(['고1 3월 학평', '고3 수능', '고3 9월 모평', '고3 6월 모평']);
  });
});

describe('카드 글귀', () => {
  it('시험 이름 — 내신은 학기 + 고사, 모의고사는 회차 그대로', () => {
    expect(setExamLabel(school())).toBe('1학기 중간고사');
    expect(setExamLabel(school({ semester: '' }))).toBe('중간고사');
    expect(setExamLabel(mock({ exam_type: '9월 모평' }))).toBe('9월 모평');
  });

  it('교과서 · 주관 — 비면 미지정', () => {
    expect(setTextbookLabel(school())).toBe('비상(박영민)');
    expect(setTextbookLabel(school({ textbook: '' }))).toBe('교과서 미지정');
    expect(setTextbookLabel(mock())).toBe('평가원');
  });

  it('학교는 네 곳까지 + 외, N곳은 학교 수다', () => {
    const set = { source_type: '내신기출', names: ['가중', '나중', '다중', '라중', '마중'] } as const;
    expect(setNamesSummary({ ...set, names: [...set.names] })).toBe('5곳 · 가중, 나중, 다중, 라중 외');
    expect(setNamesSummary({ ...set, names: ['가중', '나중'] })).toBe('2곳 · 가중, 나중');
  });

  it('찾는 중이면 맞은 학교를 앞에 세운다 — 다섯째에 걸린 학교도 카드에 보인다', () => {
    const names = ['가중', '나중', '다중', '라중', '마중'];
    expect(setNamesSummary({ source_type: '내신기출', names }, (n) => n === '마중')).toBe('5곳 · 마중, 가중, 나중, 다중 외');
  });

  it('모의고사는 과목만 적는다', () => {
    const [set] = toSourceSets([mock({ names: ['2027학년도 6월 모평 (화법과 작문)', '2027학년도 6월 모평 (공통)'] })]);
    expect(setNamesSummary(set)).toBe('공통, 화법과 작문');
  });

  it('카드 번호는 두 자리', () => {
    expect(setIssueNo(1)).toBe('#01');
    expect(setIssueNo(141)).toBe('#141');
  });
});

describe('mockSubject', () => {
  it('제목 끝 괄호 안 글자, 없으면 국어', () => {
    expect(mockSubject('2027학년도 6월 모평 (화법과 작문)')).toBe('화법과 작문');
    expect(mockSubject('2016학년도 수능 (A형) ')).toBe('A형');
    expect(mockSubject('2026학년도 3월 고1 전국연합학력평가')).toBe('국어');
  });
});

describe('setLevel', () => {
  it('내신은 학년의 학교급, 모의고사는 모의고사', () => {
    expect(setLevel(school())).toBe('중등');
    expect(setLevel(school({ grade: '고2' }))).toBe('고등');
    expect(setLevel(school({ grade: '' }))).toBeNull();
    expect(setLevel(mock())).toBe('모의고사');
  });
});

describe('sourceSetOf', () => {
  const source = {
    source_type: '내신기출' as const, year: '2026', grade: '중2', semester: '1학기', exam_type: '중간',
    textbook: '비상(박영민)', publisher: '무시', title: '', school_name: '무학중', id: 's1',
  };

  it('내신은 주관을 접고, 모의고사는 학기·교과서를 접는다(sql/107 과 같다)', () => {
    expect(sourceSetOf(source)).toEqual({
      source_type: '내신기출', year: '2026', grade: '중2', semester: '1학기', exam_type: '중간',
      textbook: '비상(박영민)', publisher: '',
    });
    expect(sourceSetOf({ ...source, source_type: '모의고사', grade: '', exam_type: '수능', publisher: '평가원' })).toEqual({
      source_type: '모의고사', year: '2026', grade: '고3', semester: '', exam_type: '수능', textbook: '', publisher: '평가원',
    });
  });

  it('세트로 보는 유형이 아니면 null', () => {
    expect(sourceSetOf({ ...source, source_type: '평가문제집' })).toBeNull();
  });

  it('세트 목록의 열쇠와 같은 열쇠가 된다 — 시험 보기에서 돌아갈 세트를 찾는다', () => {
    const [set] = toSourceSets([school()]);
    expect(sourceSetKey(sourceSetOf(source)!)).toBe(sourceSetKey(set as SourceSet));
  });
});

describe('orderSetSources', () => {
  it('내신은 학교 가나다, 모의고사는 과목 차례', () => {
    const rows = [
      { id: '2', source_type: '내신기출' as const, school_name: '한대부중', title: '' },
      { id: '1', source_type: '내신기출' as const, school_name: '광희중', title: '' },
    ];
    expect(orderSetSources(rows).map((r) => r.school_name)).toEqual(['광희중', '한대부중']);
    const mocks = [
      { id: 'b', source_type: '모의고사' as const, school_name: '', title: '2027 6월 모평 (화법과 작문)' },
      { id: 'a', source_type: '모의고사' as const, school_name: '', title: '2027 6월 모평 (공통)' },
    ];
    expect(orderSetSources(mocks).map((r) => mockSubject(r.title))).toEqual(['공통', '화법과 작문']);
  });
});
