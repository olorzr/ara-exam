import type { Category, ConceptSheetListItem } from '@/types';
import { normalizeCategoryName } from './category-name';
import { categoryNaturalKey } from './category-key';

/** 개념지 카테고리의 자연키 필드 (Category 컬럼명 기준) */
export interface ConceptCategoryFields {
  level: string;
  year: string | null;
  grade: string;
  publisher: string;
  semester: string;
  chapter: string;
  sub_chapter: string;
  school_name?: string | null;
}

/**
 * 개념지 카테고리의 그룹화 키를 만든다. 이름 필드는 `normalizeCategoryName` 으로
 * 정규화하므로 표기 변형이 섞여 있어도 같은 키로 수렴한다.
 *
 * 개념지 목록 트리는 `concept_sheets` 에 **복사 저장된 텍스트**로 노드를 묶는데,
 * 쓰기 경로 정규화(2026-08-22) 이전에 저장된 행에는 `천재(정호웅)` 과
 * `천재 (정호웅)` 처럼 눈에 같은 표기가 섞여 있어 같은 출판사가 트리에 두 번 나왔다.
 * sql/16 을 적용하면 데이터 자체가 합쳐지지만, 적용 전에도 화면이 갈라지지 않도록
 * 읽기 경로에서 한 번 더 맞춘다(적용 후에는 값이 이미 정규형이라 no-op).
 *
 * ⚠️ 트리 그룹화와 목록 필터가 **반드시 같은 키 함수**를 써야 한다. 트리만 합치고
 * 필터는 원시 문자열로 비교하면, 합쳐진 노드를 눌렀을 때 한쪽 표기의 개념지가
 * 조용히 사라진다.
 *
 * @param c - 카테고리 자연키 필드 (Category 또는 개념지에서 파생한 값)
 * @returns `'|'` 로 이어붙인 정규화된 그룹 키
 */
export function conceptCategoryKey(c: ConceptCategoryFields): string {
  return categoryNaturalKey(c);
}

/**
 * 개념지 한 건을 트리 구성용 합성 Category 로 변환한다.
 * `id` 는 정규화된 그룹 키라, 표기만 다른 개념지들은 같은 노드로 묶인다.
 *
 * 컬럼명 대응 주의: concept_sheets `unit`/`subunit` ↔ Category `chapter`/`sub_chapter`.
 *
 * @param sheet - 목록에서 조회한 경량 개념지
 * @returns buildCategoryTree 에 넘길 합성 Category
 */
export function conceptSheetToCategory(sheet: ConceptSheetListItem): Category {
  const fields: ConceptCategoryFields = {
    level: sheet.level,
    year: sheet.year ?? '',
    grade: sheet.grade,
    publisher: sheet.publisher,
    semester: sheet.semester,
    chapter: sheet.unit,
    sub_chapter: sheet.subunit,
    school_name: sheet.school_name,
  };

  return {
    id: conceptCategoryKey(fields),
    level: sheet.level as Category['level'],
    year: fields.year ?? '',
    grade: sheet.grade,
    publisher: normalizeCategoryName(sheet.publisher ?? ''),
    semester: sheet.semester,
    chapter: normalizeCategoryName(sheet.unit ?? ''),
    sub_chapter: normalizeCategoryName(sheet.subunit ?? ''),
    school_name: normalizeCategoryName(sheet.school_name ?? ''),
    user_id: sheet.user_id,
    created_at: sheet.created_at,
  };
}
