import { getAllSelectableCategories } from '@/lib/category-master';
import { EXTERNAL_LEVEL } from '@/lib/constants';
import type { Category } from '@/types';
import type { ReferenceUnit } from '@/types/reference-text';
import { unitFromCategory, unitKey } from './units';

/**
 * 작품 전문 · 개념이 붙을 수 있는 교과서 단원 — 카테고리 관리의 중등·고등 단원 전부.
 *
 * 단원 고르기 창(카테고리 트리를 체크 모드로)과 왼쪽 단원 트리(빈 단원을 `(0)` 으로 드러낸다)가 같은 재료를 쓴다.
 * ⚠️ 외부지문·프린트는 뺀다: 학교 축은 없고(원장님 결정) 교과서 단원도 없다.
 */

/**
 * 고를 수 있는 단원 카테고리 — 중등·고등만.
 * @returns 카테고리
 */
export async function loadUnitCategories(): Promise<Category[]> {
  const all = await getAllSelectableCategories();
  return all.filter((c) => c.level !== EXTERNAL_LEVEL);
}

/**
 * 카테고리 목록을 단원 목록으로 — 대단원이 빈 자리(교과서만 등록된 옛 자리)는 뺀다(고르기 창과 같은 규칙).
 * @param categories - 중등·고등 카테고리
 * @returns 겹침 없는 단원 목록
 */
export function unitMasterFromCategories(categories: readonly Category[]): ReferenceUnit[] {
  const out = new Map<string, ReferenceUnit>();
  for (const category of categories) {
    if (category.level === EXTERNAL_LEVEL || !category.chapter?.trim() || !category.publisher?.trim()) continue;
    const unit = unitFromCategory(category);
    out.set(unitKey(unit), unit);
  }
  return [...out.values()];
}

/**
 * 왼쪽 트리용 단원 마스터.
 * @returns 단원 목록
 * @throws 카테고리를 읽지 못했을 때
 */
export async function loadReferenceUnitMaster(): Promise<ReferenceUnit[]> {
  return unitMasterFromCategories(await loadUnitCategories());
}
