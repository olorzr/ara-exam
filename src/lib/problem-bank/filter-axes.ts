import type { SelectOption } from '@/components/ui/option-select';
import { SEMESTER_OPTIONS } from '@/lib/constants';
import { areaPathLabel } from './area-tree';
import { formatGrammarPath, parseGrammarPath } from './grammar-tree';
import { EXAM_TYPE_OPTIONS, SOURCE_TYPE_OPTIONS } from './source-form';
import { UNSPECIFIED_AXIS, type ProblemFilters } from './filters';
import { unitPathLabel } from './unit-tree';
import type { SourceFacets, WorkFacet } from './facets';

/**
 * 아카이브 필터 줄의 칸들을 만든다 (순수 함수).
 *
 * 칸마다 흩어져 있던 규칙 — '전체' 센티널, '미지정' 칸을 둘 축, 조건이 걸린 칸을 남길지,
 * 패싯에 없는 현재 값을 끼워 넣을지 — 을 한곳에 모은다. 화면은 이 목록을 그리기만 한다.
 */

/**
 * '전체'를 뜻하는 센티널 — base-ui Select 는 빈 문자열 value 를 싫어한다.
 *
 * ⚠️ 이론상 값이 실제로 `'__all__'` 인 학교·교과서가 있으면 겹친다. `UNSPECIFIED_AXIS` 와
 *    같은 성질의 한계이고(자유 텍스트 축), 실제로 그런 이름은 없어 감수한다.
 */
export const ALL_AXIS = '__all__';

/** 경로를 주소·선택값으로 접을 때 쓰는 구분자 (filters.ts 의 AREA_SEPARATOR 와 같다) */
const PATH_SEPARATOR = '>';

/** 화면이 그릴 칸 하나 */
export interface FilterAxis {
  /** React key 겸 축 이름 */
  key: string;
  /** 칸에 붙일 이름. '전체' 항목은 '유형 전체' 처럼 이 말을 쓴다 */
  label: string;
  /** 트리거 폭 클래스 */
  widthClass: string;
  /** 지금 고른 값 (센티널 포함) */
  value: string;
  options: SelectOption[];
  /** 고른 값을 필터 패치로 */
  toPatch: (value: string) => Partial<ProblemFilters>;
}

/** 값과 이름이 같은 축 */
const plain = (name: string): SelectOption => ({ value: name, label: name });

/**
 * '전체' 칸을 맨 앞에 붙인다. 필요하면 '미지정' 칸도.
 *
 * ⚠️ '미지정'(`UNSPECIFIED_AXIS`)은 **선택지가 정해진 축에만** 둔다. 학교·교과서·작품은
 *    자유 텍스트라 저장값이 우연히 `'__none__'` 이면 그 이름의 학교 대신 '이름 없는 출처' 를
 *    찾게 된다(filters.ts 의 같은 경고).
 * @param label - 칸 이름 ('유형' → '유형 전체')
 * @param options - 패싯이 준 선택지
 * @param unspecified - '미지정' 칸을 둘지
 * @returns 앞에 '전체'(+'미지정')가 붙은 선택지
 */
function withAll(label: string, options: SelectOption[], unspecified = false): SelectOption[] {
  const head: SelectOption[] = [{ value: ALL_AXIS, label: `${label} 전체` }];
  if (unspecified) head.push({ value: UNSPECIFIED_AXIS, label: '미지정' });
  return [...head, ...options];
}

/**
 * 지금 걸린 값이 선택지에 없으면 만들어 앞에 붙인다.
 *
 * ⚠️ 패싯은 **문항이 실제로 있는 값**만 모은다. 그래서 왼쪽 트리에서 아직 기출이 없는
 *    교과서·단원을 고르면 그 값이 목록에 없고, 칸이 아무것도 안 고른 것처럼 보인다
 *    (조건은 걸려 있는데 화면은 '전체'라고 말하는 셈이다).
 * @param options - '전체'까지 붙은 선택지
 * @param value - 지금 걸린 값
 * @param label - 없을 때 만들어 붙일 이름 (경로 축은 값과 다르다)
 * @returns 걸린 값이 반드시 들어 있는 선택지
 */
function withValue(options: SelectOption[], value: string, label?: string): SelectOption[] {
  if (!value || options.some((o) => o.value === value)) return options;
  return [{ value, label: label ?? value }, ...options];
}

/**
 * 이 칸을 보여 줄지.
 *
 * ⚠️ 선택지 유무만 보면 **조건이 걸린 칸이 사라진다.** 모든 출처의 학기가 비어 있으면
 *    패싯이 비는데, 학교 기출 트리에서 '미지정' 갈래를 고르면 학기 조건은 살아 있다 —
 *    칸이 없으면 그 조건을 볼 수도 끌 수도 없다(코덱스 리뷰 3R).
 * @param hasOptions - 고를 값이 하나라도 있는가
 * @param hasValue - 지금 이 축에 조건이 걸려 있는가
 * @returns 보여 줄지
 */
function showAxis(hasOptions: boolean, hasValue: boolean): boolean {
  return hasOptions || hasValue;
}

/** 경로 축(단원·영역)의 값 ↔ 이름 */
const pathOption = (path: string[]): SelectOption => ({
  value: path.join(PATH_SEPARATOR),
  label: areaPathLabel(path),
});

interface BuildInput {
  filters: ProblemFilters;
  facets: SourceFacets;
  areaFacets: string[][];
  unitFacets: string[][];
  workFacets: WorkFacet[];
  /** 문법 선택지 — 마스터 전체다(패싯이 아니다). 자세한 까닭은 grammar-browse-tree.ts */
  grammarOptions: SelectOption[];
}

/**
 * 필터 줄에 그릴 칸 목록.
 * @param input - 지금 필터와 패싯들
 * @returns 그릴 순서대로의 칸 목록
 */
export function buildFilterAxes(input: BuildInput): FilterAxis[] {
  const { filters, facets, areaFacets, unitFacets, workFacets, grammarOptions } = input;
  const axes: FilterAxis[] = [];

  /** 값 하나짜리 축을 담는다 */
  const simple = (
    key: keyof ProblemFilters, label: string, widthClass: string,
    options: SelectOption[], unspecified = false,
  ) => {
    const value = String(filters[key] ?? '');
    axes.push({
      key, label, widthClass, value: value || ALL_AXIS,
      options: withValue(withAll(label, options, unspecified), value),
      toPatch: (v) => ({ [key]: v === ALL_AXIS ? '' : v, page: 0 }) as Partial<ProblemFilters>,
    });
  };

  simple('source_type', '유형', 'w-32', SOURCE_TYPE_OPTIONS.map(plain));
  simple('school_name', '학교', 'w-36', facets.schools.map(plain));
  simple('year', '학년도', 'w-28', facets.years.map(plain), true);
  simple('grade', '학년', 'w-24', facets.grades.map(plain), true);
  if (showAxis(facets.semesters.length > 0, Boolean(filters.semester))) {
    simple('semester', '학기', 'w-24', SEMESTER_OPTIONS.map(plain), true);
  }
  simple('exam_type', '시험', 'w-24', EXAM_TYPE_OPTIONS.map(plain), true);
  if (showAxis(facets.textbooks.length > 0, Boolean(filters.textbook))) {
    simple('textbook', '교과서', 'w-40', facets.textbooks.map(plain));
  }

  if (showAxis(unitFacets.length > 0, filters.unit_path.length > 0)) {
    const value = filters.unit_path.join(PATH_SEPARATOR);
    axes.push({
      key: 'unit_path', label: '단원', widthClass: 'w-48', value: value || ALL_AXIS,
      options: withValue(withAll('단원', unitFacets.map(pathOption)), value, unitPathLabel(filters.unit_path)),
      toPatch: (v) => ({ unit_path: v === ALL_AXIS ? [] : v.split(PATH_SEPARATOR), page: 0 }),
    });
  }

  if (showAxis(workFacets.length > 0, Boolean(filters.work_title))) {
    simple('work_title', '작품', 'w-40', workFacets.map((w) => plain(w.title)));
  }

  if (showAxis(areaFacets.length > 0, filters.area_path.length > 0)) {
    const value = filters.area_path.join(PATH_SEPARATOR);
    axes.push({
      key: 'area_path', label: '영역', widthClass: 'w-44', value: value || ALL_AXIS,
      options: withValue(withAll('영역', areaFacets.map(pathOption)), value, areaPathLabel(filters.area_path)),
      toPatch: (v) => ({ area_path: v === ALL_AXIS ? [] : v.split(PATH_SEPARATOR), page: 0 }),
    });
  }

  // ⚠️ 문법 칸에는 showAxis 를 걸지 않는다 — 선택지가 **마스터**라 비는 일이 없고,
  //    예전처럼 패싯으로 가리면 태그가 0건일 때 칸이 영영 안 나타나 태깅을 시작할 길이 없었다.
  // ⚠️ 이 축만 마디를 `' > '` 로 잇는다 — 저장값·마스터 표기가 그렇다(grammar-tree.ts).
  //    다른 경로 축의 `'>'` 로 접으면 선택지의 값과 어긋나 아무것도 안 고른 것처럼 보인다.
  const grammarValue = formatGrammarPath(filters.grammar_path);
  axes.push({
    key: 'grammar_path', label: '문법', widthClass: 'w-52', value: grammarValue || ALL_AXIS,
    options: withValue(withAll('문법', grammarOptions), grammarValue),
    toPatch: (v) => ({ grammar_path: v === ALL_AXIS ? [] : parseGrammarPath(v), page: 0 }),
  });

  return axes;
}
