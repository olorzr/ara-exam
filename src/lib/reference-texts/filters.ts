import { formatGrammarPath, grammarPathsUnder } from '@/lib/problem-bank/grammar-tree';
import { GRAMMAR_SELF_LEAF, grammarNodeKey } from '@/lib/problem-bank/grammar-browse-tree';
import { workKey } from '@/lib/problem-bank/work-tree';
import type { ReferenceUnit } from '@/types/reference-text';
import { unitKey, unitLabel } from './units';

/**
 * 작품 전문 목록을 **무엇으로 훑고 있는가** (순수 함수).
 *
 * 왼쪽 패널의 세 탭(교과서 · 단원 / 작품 / 문법)은 같은 목록에 이르는 **대안 경로**라
 * 축은 **한 번에 하나**다 — 문제 은행 아카이브가 트리를 누를 때마다 다른 축을 비우는 것과
 * 같은 판단이다(남겨 두면 '천재 1단원 ∩ 동백꽃' 이 조용히 0건이 되고 화면에 이유가 없다).
 * 그래서 칸 다섯 개짜리 필터 객체가 아니라 **갈래 하나짜리 값**으로 들고, '분류 없음' 도
 * 불리언 칸이 아니라 갈래로 둔다. 검색어는 축과 **따로** 함께 걸린다(훅이 든다).
 *
 * ⚠️ 주소(URL)에 남기지 않는다 — 이 화면은 원래 주소 상태가 없다. 필요해지면 그때 더한다.
 */

/** 지금 걸린 축 */
export type ReferenceBrowseAxis =
  | { kind: 'all' }
  /** 이 단원이 붙은 전문 — 대단원만 든 단원이면 그 아래 소단원 단원까지(jsonb 포함) */
  | { kind: 'unit'; unit: ReferenceUnit }
  /** 단원이 하나도 없는 전문 */
  | { kind: 'unit-none' }
  /** 이 제목의 전문 (판본이 여럿이면 함께 나온다) */
  | { kind: 'work'; title: string }
  /** 이 문법 개념과 그 아래 개념 */
  | { kind: 'grammar'; path: string[] }
  /** 문법 분류가 없는 전문 */
  | { kind: 'grammar-none' };

/** 아무 축도 없음 */
export const ALL_REFERENCE_TEXTS: ReferenceBrowseAxis = { kind: 'all' };

/** 왼쪽 패널의 탭 */
export type ReferenceSideTab = 'units' | 'works' | 'grammar';

/** 탭 순서 — 화면 순서가 곧 이 순서다 */
export const REFERENCE_SIDE_TABS: readonly ReferenceSideTab[] = ['units', 'works', 'grammar'];

/** 조회에 넘길 조건 (`applyReferenceQuery` 가 PostgREST 필터로 옮긴다) */
export interface ReferenceTextQuery {
  /** `units @> [unit]` */
  unit?: ReferenceUnit;
  /** `units = '[]'` */
  unitsEmpty?: true;
  /** `title = …` */
  title?: string;
  /** `grammar_paths && …` (고른 마디와 그 아래 경로 전부) */
  grammar_paths?: string[];
  /** `grammar_paths = '{}'` */
  grammarEmpty?: true;
}

/** '분류 없음' 잎의 열쇠 — 트리와 강조가 같은 값을 쓴다 */
export const UNIT_NONE_KEY = 'unit:none';
export const GRAMMAR_NONE_KEY = 'grammar:none';

/**
 * 축을 조회 조건으로.
 * @param axis - 지금 축
 * @returns 조회 조건 (축이 없으면 빈 객체)
 */
export function toReferenceTextQuery(axis: ReferenceBrowseAxis): ReferenceTextQuery {
  switch (axis.kind) {
    case 'unit': return { unit: axis.unit };
    case 'unit-none': return { unitsEmpty: true };
    case 'work': return { title: axis.title };
    // 상위 개념을 고르면 그 아래 경로를 펴서 겹침(&&)으로 찾는다 — 문제 은행과 같은 규칙
    case 'grammar': return { grammar_paths: grammarPathsUnder(axis.path) };
    case 'grammar-none': return { grammarEmpty: true };
    default: return {};
  }
}

/**
 * 축 하나를 가리키는 열쇠 — 트리 잎의 id 와 **같은 값**이라 강조가 축에서 바로 나온다.
 *
 * 작품은 `workKey`, 문법은 `grammarNodeKey` 를 그대로 쓴다(그 트리 빌더가 잎에 다는 id).
 * 문법 가지를 골랐으면 그 가지의 `(전체)` 잎을 가리킨다 — 가지 자체는 잎이 아니라 강조되지 않는다.
 * @param axis - 축
 * @returns 열쇠
 */
export function axisKey(axis: ReferenceBrowseAxis): string {
  switch (axis.kind) {
    case 'unit': return `unit:${unitKey(axis.unit)}`;
    case 'unit-none': return UNIT_NONE_KEY;
    case 'work': return workKey({ title: axis.title });
    case 'grammar': return grammarPathsUnder(axis.path).length > 1
      ? grammarNodeKey([...axis.path, GRAMMAR_SELF_LEAF])
      : grammarNodeKey(axis.path);
    case 'grammar-none': return GRAMMAR_NONE_KEY;
    default: return 'all';
  }
}

/**
 * 처음 펼칠 탭 — 걸린 축의 탭.
 * @param axis - 축
 * @returns 탭
 */
export function tabForAxis(axis: ReferenceBrowseAxis): ReferenceSideTab {
  if (axis.kind === 'work') return 'works';
  if (axis.kind === 'grammar' || axis.kind === 'grammar-none') return 'grammar';
  return 'units';
}

/**
 * 지금 축을 한 줄로 — 목록 위 요약 줄.
 * @param axis - 축
 * @returns 사람이 읽는 이름. 축이 없으면 ''
 */
export function describeAxis(axis: ReferenceBrowseAxis): string {
  switch (axis.kind) {
    case 'unit': return unitLabel(axis.unit);
    case 'unit-none': return '교과서 단원을 안 붙인 전문';
    case 'work': return `작품 · ${axis.title}`;
    case 'grammar': return `문법 · ${formatGrammarPath(axis.path)}`;
    case 'grammar-none': return '문법 분류를 안 붙인 전문';
    default: return '';
  }
}
