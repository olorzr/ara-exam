import { normalizeCategoryName } from '@/lib/category-name';
import { UNIT_DEPTH_MAX, unitPathLabel } from '@/lib/problem-bank/unit-tree';
import type { Category } from '@/types';
import type { ReferenceUnit } from '@/types/reference-text';
import { REFERENCE_UNITS_MAX } from './constants';

/**
 * 작품 전문의 교과서 단원 (순수 함수, sql/60 `units`).
 *
 * 전문 하나에 단원이 **여럿** 붙는다 — 같은 「봄봄」이 천재·비상 교과서에 다 실린다.
 * 원소는 카테고리 관리의 **이름 스냅샷**이라(문항의 `unit_path` 와 같은 규약) 마스터에서
 * 이름이 바뀌어도 이미 붙인 단원은 그대로다.
 *
 * ⚠️ DB 는 모양만 검사하고(`exam.reference_units_valid`) 다듬지 않는다 — **보내기 전에
 *    여기서 다듬는다**(`normalizeReferenceUnits`). 상한(8개·2단)은 그 함수와 같아야 한다.
 */

/** 값이 평범한 객체인가 (배열·null 제외) */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * 읽어 온 값이 단원 모양인가 — DB 에서 온 JSON 을 `as` 없이 좁힌다.
 * @param value - 아무 값
 * @returns 단원이면 true
 */
export function isReferenceUnit(value: unknown): value is ReferenceUnit {
  if (!isRecord(value)) return false;
  const { grade, textbook, semester, unit_path: path } = value;
  return typeof grade === 'string'
    && typeof textbook === 'string'
    && typeof semester === 'string'
    && Array.isArray(path)
    && path.every((segment) => typeof segment === 'string');
}

/**
 * 카테고리(트리에서 고른 잎)를 단원으로.
 * @param category - 중등·고등 카테고리 (외부지문은 부르는 쪽이 거른다)
 * @returns 단원 — 소단원이 없으면 대단원 하나짜리 경로
 */
export function unitFromCategory(
  category: Pick<Category, 'grade' | 'publisher' | 'semester' | 'chapter' | 'sub_chapter'>,
): ReferenceUnit {
  return {
    grade: category.grade,
    textbook: category.publisher,
    semester: category.semester,
    unit_path: category.sub_chapter ? [category.chapter, category.sub_chapter] : [category.chapter],
  };
}

/**
 * 단원 하나를 가리키는 열쇠 — 겹침 판정·강조·React key.
 *
 * ⚠️ `JSON.stringify` 로 만든다. 교과서·단원 이름은 자유 텍스트라 `'|'` 같은 구분자로
 *    이으면 이름에 그 글자가 든 순간 다른 단원과 열쇠가 겹친다(다른 트리들과 같은 규약).
 * @param unit - 단원
 * @returns 열쇠
 */
export function unitKey(unit: ReferenceUnit): string {
  return JSON.stringify([unit.grade, unit.textbook, unit.semester, ...unit.unit_path]);
}

/**
 * 단원을 한 줄로 — 칩·목록 부제가 쓴다.
 * @param unit - 단원
 * @returns '중2 천재(노미숙) 1학기 1. 문학 > (1) 시' (빈 칸은 뺀다)
 */
export function unitLabel(unit: ReferenceUnit): string {
  return [unit.grade, unit.textbook, unit.semester, unitPathLabel(unit.unit_path)]
    .filter(Boolean)
    .join(' ');
}

/**
 * 단원 하나 다듬기. 쓸 수 없으면 null.
 * @param unit - 단원
 * @returns 다듬은 단원 또는 null
 */
function normalizeUnit(unit: ReferenceUnit): ReferenceUnit | null {
  const textbook = normalizeCategoryName(unit.textbook);
  const path = unit.unit_path
    .map((segment) => normalizeCategoryName(segment))
    .filter(Boolean)
    .slice(0, UNIT_DEPTH_MAX);
  // 교과서나 대단원이 없으면 어느 단원인지 알 수 없다 — DB 검사도 거절한다
  if (!textbook || path.length === 0) return null;
  return {
    grade: unit.grade.trim(),
    textbook,
    semester: unit.semester.trim(),
    unit_path: path,
  };
}

/**
 * 단원 목록을 저장할 수 있는 모양으로 — 이름 정리, 빈 단원 버림, 겹침 제거, 상한.
 *
 * 순서는 **사람이 붙인 순서 그대로**다(먼저 붙인 것이 이긴다). 정렬하지 않는 까닭: 상한에서
 * 자를 때 정렬하면 이미 붙어 있던 단원이 밀려 사라질 수 있다(문법 태그 합치기와 같은 판단).
 * @param units - 화면에서 모은 단원들
 * @returns 다듬은 목록
 */
export function normalizeReferenceUnits(units: readonly ReferenceUnit[]): ReferenceUnit[] {
  const out: ReferenceUnit[] = [];
  const seen = new Set<string>();
  for (const raw of units) {
    const unit = normalizeUnit(raw);
    if (!unit) continue;
    const key = unitKey(unit);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(unit);
    if (out.length >= REFERENCE_UNITS_MAX) break;
  }
  return out;
}

/**
 * 두 단원 목록이 같은가 (순서까지).
 * @param a - 한쪽
 * @param b - 다른 쪽
 * @returns 같으면 true
 */
export function unitsEqual(a: readonly ReferenceUnit[], b: readonly ReferenceUnit[]): boolean {
  return a.length === b.length && a.every((unit, i) => unitKey(unit) === unitKey(b[i]));
}

/**
 * 두 문자열 목록이 같은가 (순서까지).
 * @param a - 한쪽
 * @param b - 다른 쪽
 * @returns 같으면 true
 */
export function stringsEqual(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((value, i) => value === b[i]);
}

/**
 * 단원 하나를 붙이거나 뗀다 — 이미 붙어 있으면 떼고, 없으면 끝에 붙인다.
 * @param units - 지금 붙은 단원들
 * @param unit - 누른 단원
 * @returns 바뀐 목록. 상한이 차서 붙일 수 없으면 null (부르는 쪽이 알린다)
 */
export function toggleReferenceUnit(
  units: readonly ReferenceUnit[],
  unit: ReferenceUnit,
): ReferenceUnit[] | null {
  const key = unitKey(unit);
  if (units.some((u) => unitKey(u) === key)) return units.filter((u) => unitKey(u) !== key);
  if (units.length >= REFERENCE_UNITS_MAX) return null;
  return [...units, unit];
}
