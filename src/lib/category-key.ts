import { normalizeCategoryName } from './category-name';

/**
 * 카테고리 자연키 필드 — `categories` 의 `idx_categories_natural_key` 와 같은 조합.
 * 개념지는 카테고리 id 를 저장하지 않고 텍스트를 복사 저장하므로, 이 조합이
 * "같은 카테고리인가" 를 판정하는 기준이 된다.
 */
export interface CategoryNaturalKeyFields {
  level: string;
  year?: string | null;
  grade: string;
  publisher: string;
  semester: string;
  chapter: string;
  sub_chapter: string;
  school_name?: string | null;
}

/** 자연키에서 표기 정규화가 필요한 이름 필드 */
type CategoryNameField = 'publisher' | 'chapter' | 'sub_chapter' | 'school_name';
const NAME_FIELDS: CategoryNameField[] = ['publisher', 'chapter', 'sub_chapter', 'school_name'];

/**
 * 카테고리의 이름 필드를 표준 표기로 정규화한 사본을 만든다.
 *
 * 트리 그룹화(`buildCategoryTree` 의 `groupBy`)는 이름 문자열 완전 일치로 노드를
 * 묶으므로, **키뿐 아니라 값도** 정규화해야 같은 노드로 합쳐진다. 키만 맞추면
 * 자연키가 다른(예: 소단원이 다른) 두 행이 각자 살아남아 원시 표기를 그대로
 * 들고 있어 트리가 다시 갈라진다.
 *
 * @param cat - 정규화할 카테고리 (원본은 변경하지 않는다)
 * @returns 이름 필드만 정규화된 새 객체
 */
export function withNormalizedCategoryNames<T extends CategoryNaturalKeyFields>(cat: T): T {
  const next = { ...cat };
  for (const field of NAME_FIELDS) {
    const value = next[field];
    if (typeof value === 'string') {
      (next[field] as string) = normalizeCategoryName(value);
    }
  }
  return next;
}

/**
 * 카테고리 자연키 문자열을 만든다. 이름 필드는 `normalizeCategoryName` 을 거치므로
 * `천재(정호웅)` 과 `천재 (정호웅)` 처럼 표기만 다른 값이 같은 키로 수렴한다.
 *
 * ⚠️ 트리 그룹화와 목록/선택 필터가 **반드시 같은 키 함수**를 써야 한다.
 * 한쪽만 정규화하면 합쳐진 노드를 눌렀을 때 다른 표기로 저장된 행이 조용히 사라진다.
 *
 * `year` 와 `school_name` 은 키에 포함한다 — 빼면 학교·년도가 다른 외부지문
 * 카테고리가 한 노드로 뭉친다.
 *
 * 필드 경계는 `JSON.stringify` 로 만든다. 예전처럼 `join('|')` 을 쓰면 이름에 `|` 가
 * 섞였을 때(붙여넣기로 충분히 들어온다) 경계가 모호해져 **서로 다른 카테고리가 같은
 * 키가 된다** — 예: `chapter='1단원|소나기', sub_chapter='황순원'` 과
 * `chapter='1단원', sub_chapter='소나기|황순원'`. 그러면 트리 노드가 하나로 합쳐지고
 * 필터가 무관한 행까지 함께 집는다.
 *
 * @param cat - 카테고리 자연키 필드
 * @returns 필드 경계가 모호하지 않은 정규화된 자연키
 */
export function categoryNaturalKey(cat: CategoryNaturalKeyFields): string {
  return JSON.stringify([
    cat.level,
    cat.year ?? '',
    cat.grade,
    normalizeCategoryName(cat.publisher ?? ''),
    cat.semester,
    normalizeCategoryName(cat.chapter ?? ''),
    normalizeCategoryName(cat.sub_chapter ?? ''),
    normalizeCategoryName(cat.school_name ?? ''),
  ]);
}
