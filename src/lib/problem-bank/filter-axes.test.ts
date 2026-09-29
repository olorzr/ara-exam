import { describe, expect, it } from 'vitest';
import { ALL_AXIS, buildFilterAxes, type FilterAxis } from './filter-axes';
import { EMPTY_FILTERS, UNSPECIFIED_AXIS, type ProblemFilters } from './filters';
import { EMPTY_SOURCE_FACETS, type SourceFacets, type WorkFacet } from './facets';
import { grammarSelectOptions } from './grammar-browse-tree';

const grammarOptions = grammarSelectOptions();

function build(
  filters: Partial<ProblemFilters> = {},
  facets: Partial<SourceFacets> = {},
  extra: { areaFacets?: string[][]; unitFacets?: string[][]; workFacets?: WorkFacet[] } = {},
): FilterAxis[] {
  return buildFilterAxes({
    filters: { ...EMPTY_FILTERS, ...filters },
    facets: { ...EMPTY_SOURCE_FACETS, ...facets },
    areaFacets: extra.areaFacets ?? [],
    unitFacets: extra.unitFacets ?? [],
    workFacets: extra.workFacets ?? [],
    grammarOptions,
  });
}

const axis = (axes: FilterAxis[], key: string) => axes.find((a) => a.key === key);
const values = (a: FilterAxis) => a.options.map((o) => o.value);
const labels = (a: FilterAxis) => a.options.map((o) => o.label);

describe("'전체' 칸", () => {
  it('이름은 칸 이름을 딴다 — 값은 센티널이다', () => {
    const a = axis(build(), 'source_type')!;

    expect(a.options[0]).toEqual({ value: ALL_AXIS, label: '유형 전체' });
    expect(a.value).toBe(ALL_AXIS);
  });

  it("'전체' 를 고르면 그 축을 비우고 첫 쪽으로 돌아간다", () => {
    expect(axis(build({ source_type: '내신기출' }), 'source_type')!.toPatch(ALL_AXIS))
      .toEqual({ source_type: '', page: 0 });
  });
});

describe('유형 칸 — 시험 구분과 맞추기', () => {
  it('모의고사 회차를 고른 채 내신으로 바꾸면 회차를 비운다 — 있을 수 없는 조합이라 0건이 된다', () => {
    expect(axis(build({ source_type: '모의고사', exam_type: '수능' }), 'source_type')!.toPatch('내신기출'))
      .toEqual({ source_type: '내신기출', exam_type: '', page: 0 });
  });

  it('맞는 값이면 그대로 둔다', () => {
    expect(axis(build({ source_type: '내신기출', exam_type: '중간' }), 'source_type')!.toPatch('문제집'))
      .toEqual({ source_type: '문제집', page: 0 });
  });

  it('모의고사로 바꾸면 학교·학기를 비운다 — 모의고사는 둘 다 빈 채로 저장된다', () => {
    const patch = axis(build({ source_type: '내신기출', school_name: '상현중', semester: '1학기', exam_type: '중간' }), 'source_type')!
      .toPatch('모의고사');
    expect(patch).toEqual({ source_type: '모의고사', exam_type: '', school_name: '', semester: '', page: 0 });
  });

  it("'전체' 로 풀면 무엇이든 남긴다", () => {
    expect(axis(build({ source_type: '모의고사', exam_type: '수능' }), 'source_type')!.toPatch(ALL_AXIS))
      .toEqual({ source_type: '', page: 0 });
  });

  it('유형이 모의고사면 시험 칸 선택지가 회차다', () => {
    expect(values(axis(build({ source_type: '모의고사' }), 'exam_type')!)).toContain('수능');
  });
});

describe("'미지정' 칸", () => {
  /**
   * 빈 문자열은 이 필터에서 '전체' 라 '미지정인 것만' 을 따로 표시해야 한다.
   * ⚠️ 자유 텍스트 축에는 두면 안 된다 — 저장값이 우연히 '__none__' 인 학교가 있으면
   *    그 학교 대신 '이름 없는 출처' 를 찾게 된다.
   */
  it('선택지가 정해진 축에만 있다', () => {
    const axes = build({}, { semesters: ['1학기'] });

    for (const key of ['year', 'grade', 'semester', 'exam_type']) {
      expect(values(axis(axes, key)!), key).toContain(UNSPECIFIED_AXIS);
    }
  });

  it('자유 텍스트 축(학교·교과서·작품)에는 없다', () => {
    const axes = build({}, { textbooks: ['천재'] }, { workFacets: [{ title: '동백꽃', author: '김유정', count: 1, kind: 'literary' }] });

    for (const key of ['school_name', 'textbook', 'work_title']) {
      expect(values(axis(axes, key)!), key).not.toContain(UNSPECIFIED_AXIS);
    }
  });
});

describe('조건이 걸린 칸은 사라지지 않는다', () => {
  /**
   * 선택지 유무만 보면 조건이 걸린 칸이 화면에서 사라져 **끌 수가 없다**(코덱스 리뷰 3R).
   */
  it('패싯이 비어도 조건이 있으면 칸이 남는다', () => {
    expect(axis(build({ semester: UNSPECIFIED_AXIS }), 'semester')).toBeDefined();
    expect(axis(build({ textbook: '천재' }), 'textbook')).toBeDefined();
    expect(axis(build({ unit_path: ['1. 문학'] }), 'unit_path')).toBeDefined();
  });

  it('패싯도 조건도 없으면 칸을 안 그린다', () => {
    const axes = build();

    expect(axis(axes, 'semester')).toBeUndefined();
    expect(axis(axes, 'textbook')).toBeUndefined();
    expect(axis(axes, 'unit_path')).toBeUndefined();
  });
});

describe('패싯에 없는 현재 값', () => {
  /**
   * 패싯은 문항이 실제로 있는 값만 모은다. 트리에서 아직 기출이 없는 교과서를 고르면
   * 그 값이 목록에 없어 칸이 '전체' 인 것처럼 비어 보인다(코덱스 리뷰 4R).
   */
  it('선택지에 만들어 앞에 붙인다', () => {
    const a = axis(build({ textbook: '아직없는교과서' }), 'textbook')!;

    expect(values(a)).toContain('아직없는교과서');
    expect(a.value).toBe('아직없는교과서');
  });
});

describe('경로 축 (단원·영역)', () => {
  it("값은 '>' 로 접고 이름은 ' > ' 로 편다", () => {
    const a = axis(build({}, {}, { unitFacets: [['1. 문학', '현대시']] }), 'unit_path')!;

    expect(values(a)).toContain('1. 문학>현대시');
    expect(labels(a)).toContain('1. 문학 > 현대시');
  });

  it('고르면 마디 배열로 되돌린다', () => {
    const a = axis(build({}, {}, { unitFacets: [['1. 문학', '현대시']] }), 'unit_path')!;

    expect(a.toPatch('1. 문학>현대시')).toEqual({ unit_path: ['1. 문학', '현대시'], page: 0 });
    expect(a.toPatch(ALL_AXIS)).toEqual({ unit_path: [], page: 0 });
  });
});

describe('문항 유형 축', () => {
  /**
   * 문법 칸과 같은 규약 — 선택지가 **정해진 둘**이라 패싯을 보지 않고 늘 그린다.
   * 값은 갈래이고 DB 의 `question_type` 이 아니다('서술형' 은 '주관식' 갈래에 든다).
   */
  it('늘 나오고 선택지는 갈래 둘이다', () => {
    const a = axis(build(), 'question_kind')!;

    expect(values(a)).toEqual([ALL_AXIS, 'objective', 'subjective']);
    expect(labels(a)).toContain('주관식·서술형');
    expect(a.value).toBe(ALL_AXIS);
  });

  it("'미지정' 칸은 두지 않는다 — question_type 은 늘 값이 있다", () => {
    expect(values(axis(build(), 'question_kind')!)).not.toContain(UNSPECIFIED_AXIS);
  });

  it('고르면 축을 채우고 전체는 비운다 — 둘 다 첫 쪽으로', () => {
    const a = axis(build({ question_kind: 'subjective' }), 'question_kind')!;

    expect(a.value).toBe('subjective');
    expect(a.toPatch('objective')).toEqual({ question_kind: 'objective', page: 0 });
    expect(a.toPatch(ALL_AXIS)).toEqual({ question_kind: '', page: 0 });
  });
});

describe('학교급 축', () => {
  const facets: Partial<SourceFacets> = {
    schools: ['광희중', '성수고'],
    grades: ['고1', '고2', '중1', '중2'],
    schoolsByLevel: { 중등: ['광희중'], 고등: ['성수고'] },
  };

  it('학교·학년보다 앞에 늘 나오고 선택지는 전체·중등·고등이다', () => {
    const axes = build();
    const keys = axes.map((a) => a.key);

    expect(values(axis(axes, 'school_level')!)).toEqual([ALL_AXIS, '중등', '고등']);
    expect(keys.indexOf('school_level')).toBeLessThan(keys.indexOf('school_name'));
    expect(keys.indexOf('school_level')).toBeLessThan(keys.indexOf('grade'));
  });

  it('고르면 학교·학년 칸이 그 학교급으로 좁혀지고 미지정 칸은 빠진다', () => {
    const axes = build({ school_level: '고등' }, facets);

    expect(values(axis(axes, 'school_name')!)).toEqual([ALL_AXIS, '성수고']);
    expect(values(axis(axes, 'grade')!)).toEqual([ALL_AXIS, '고1', '고2']);
  });

  /** 남기면 '고등 ∩ 중2' 가 조용히 0건이 된다 */
  it('어긋나는 학교·학년은 비우고, 맞는 것은 남긴다', () => {
    const off = axis(build({ school_name: '광희중', grade: '중2' }, facets), 'school_level')!;
    expect(off.toPatch('고등')).toEqual({
      school_level: '고등', school_name: '', grade: '', page: 0,
    });

    const fits = axis(build({ school_name: '성수고', grade: '고1' }, facets), 'school_level')!;
    expect(fits.toPatch('고등')).toEqual({ school_level: '고등', page: 0 });
  });

  it("'미지정' 학년은 학교급과 함께 걸 수 없어 비운다", () => {
    const a = axis(build({ grade: UNSPECIFIED_AXIS }, facets), 'school_level')!;
    expect(a.toPatch('중등')).toEqual({ school_level: '중등', grade: '', page: 0 });
  });

  /** 패싯을 못 읽었을 때 멀쩡한 학교 조건을 지우면 안 된다 */
  it('패싯에 없는 학교는 판정하지 않고 남긴다', () => {
    const a = axis(build({ school_name: '행당중' }, facets), 'school_level')!;
    expect(a.toPatch('고등')).toEqual({ school_level: '고등', page: 0 });
  });

  it('전체로 돌리면 학교급만 비운다', () => {
    const a = axis(build({ school_level: '중등', grade: '중2' }, facets), 'school_level')!;
    expect(a.toPatch(ALL_AXIS)).toEqual({ school_level: '', page: 0 });
  });
});

describe('문법 축', () => {
  /**
   * 이 테스트가 고정하는 것: 문법 칸은 **패싯이 비어도 항상** 그린다.
   * 예전에는 태그가 0건이면 칸이 안 나타나 붙일 길이 없는 닭-달걀이었다.
   */
  it('태그가 하나도 없어도 칸이 나온다', () => {
    expect(axis(build(), 'grammar_path')).toBeDefined();
  });

  it('선택지가 마스터 전체다', () => {
    const a = axis(build(), 'grammar_path')!;

    expect(values(a)).toContain('단어 > 품사 > 명사');
    expect(values(a)).toContain('단어 > 품사');
  });

  it("마디를 ' > ' 로 잇는다 — 다른 경로 축과 구분자가 다르다", () => {
    const a = axis(build({ grammar_path: ['단어', '품사'] }), 'grammar_path')!;

    expect(a.value).toBe('단어 > 품사');
    expect(a.toPatch('단어 > 품사 > 명사'))
      .toEqual({ grammar_path: ['단어', '품사', '명사'], page: 0 });
  });

  it('마스터에서 빠진 옛 경로도 보여 준다 — 끌 수 있어야 한다', () => {
    const a = axis(build({ grammar_path: ['옛분류', '옛개념'] }), 'grammar_path')!;

    expect(values(a)).toContain('옛분류 > 옛개념');
    expect(a.value).toBe('옛분류 > 옛개념');
  });
});
