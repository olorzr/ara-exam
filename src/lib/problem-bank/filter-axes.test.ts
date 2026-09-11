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
    const axes = build({}, { textbooks: ['천재'] }, { workFacets: [{ title: '동백꽃', author: '김유정', count: 1 }] });

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
