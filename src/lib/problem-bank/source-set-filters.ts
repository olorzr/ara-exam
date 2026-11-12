import type { SelectOption } from '@/components/ui/option-select';
import { ALL_AXIS } from './filter-axes';
import { setLevel, type SourceSet } from './source-sets';

/**
 * 세트 목록(`/problems/sets`)의 거르기 (순수 함수).
 *
 * 세트는 2026-11-13 기준 231장이라 한 번에 받아 **브라우저에서** 거른다(서버에 다시 묻지 않는다).
 * 주소 키는 이 화면 전용(`kind`·`year`·`q`)이다 — 세트 한 장 화면·아카이브의 키와 섞이지 않는다.
 */

/** 구분 — '' 은 전체 */
export type SetKind = '' | '중등' | '고등' | '모의고사';

/** 화면이 들고 있는 거르기 */
export interface SourceSetFilters {
  kind: SetKind;
  /** 학년도 — '' 은 전체 */
  year: string;
  /** 학교(모의고사는 과목 제목) 이름 찾기 */
  q: string;
}

/** 아무 조건 없는 거르기 */
export const EMPTY_SET_FILTERS: SourceSetFilters = { kind: '', year: '', q: '' };

/** 구분 드롭다운 — '전체' 는 빈 값을 못 보내는 드롭다운 규약(option-select.tsx) 때문에 ALL_AXIS 다 */
export const SET_KIND_OPTIONS: SelectOption[] = [
  { value: ALL_AXIS, label: '구분 전체' },
  { value: '중등', label: '중등' },
  { value: '고등', label: '고등' },
  { value: '모의고사', label: '모의고사·수능' },
];

const KINDS: readonly SetKind[] = ['중등', '고등', '모의고사'];

/**
 * 드롭다운 값을 구분으로.
 * @param value - 드롭다운이 보낸 값
 * @returns 모르는 값·전체는 ''
 */
export function toSetKind(value: string | null): SetKind {
  return (KINDS as readonly string[]).includes(value ?? '') ? (value as SetKind) : '';
}

/** 찾기 비교용 — 공백을 빼고 소문자로 */
function squash(text: string): string {
  return text.replace(/\s+/g, '').toLowerCase();
}

/**
 * 이름 찾기 함수 — 비었으면 undefined(카드가 이름 차례를 바꾸지 않게).
 * @param q - 찾는 글자
 * @returns 이름이 맞는지 보는 함수
 */
export function setNameMatcher(q: string): ((name: string) => boolean) | undefined {
  const needle = squash(q);
  if (!needle) return undefined;
  return (name) => squash(name).includes(needle);
}

/**
 * 세트를 거른다.
 * @param sets - 정렬된 세트들
 * @param filters - 거르기
 * @returns 남은 세트 (차례 그대로)
 */
export function filterSourceSets(sets: readonly SourceSet[], filters: SourceSetFilters): SourceSet[] {
  const match = setNameMatcher(filters.q);
  return sets.filter((set) => (
    (!filters.kind || setLevel(set) === filters.kind)
    && (!filters.year || set.year === filters.year)
    && (!match || set.names.some(match))
  ));
}

/**
 * 학년도 드롭다운 — 실제로 있는 학년도만, 최근부터.
 * @param sets - 세트들
 * @returns 드롭다운 선택지 ('학년도 전체' 포함)
 */
export function setYearOptions(sets: readonly SourceSet[]): SelectOption[] {
  const years = [...new Set(sets.map((s) => s.year).filter(Boolean))].sort((a, b) => b.localeCompare(a));
  return [{ value: ALL_AXIS, label: '학년도 전체' }, ...years.map((y) => ({ value: y, label: y }))];
}

/**
 * 고른 조건이 있는가 — '조건 지우기' 를 보일지.
 * @param filters - 거르기
 * @returns 하나라도 있으면 true
 */
export function hasActiveSetFilters(filters: SourceSetFilters): boolean {
  return Boolean(filters.kind || filters.year || filters.q.trim());
}

/**
 * 주소에서 거르기를 되살린다.
 * @param params - 주소 쿼리
 * @returns 거르기 (모르는 구분은 전체)
 */
export function setFiltersFromParams(params: URLSearchParams): SourceSetFilters {
  return {
    kind: toSetKind(params.get('kind')),
    year: params.get('year') ?? '',
    q: params.get('q') ?? '',
  };
}

/**
 * 거르기를 주소 쿼리로.
 * @param filters - 거르기
 * @returns '?kind=…' (조건이 없으면 빈 글자)
 */
export function setFiltersToQueryString(filters: SourceSetFilters): string {
  const params = new URLSearchParams();
  if (filters.kind) params.set('kind', filters.kind);
  if (filters.year) params.set('year', filters.year);
  if (filters.q) params.set('q', filters.q);
  const text = params.toString();
  return text ? `?${text}` : '';
}
