import { fetchPublicTextbook, fetchSchoolScopeRows } from '@/lib/naesin-scope/fetch';
import type { PublicTextbook, SchoolScopeRow } from '@/lib/naesin-scope/types';
import {
  findExactSlot, pickTextbookRow, toScopeBasis, toScopeWanted,
  type ScopeBasis, type ScopeWanted,
} from './scope-pick';
import { matchTextbookName } from './unit-master';

/**
 * 관리자시스템 **내신 관리**에 등록된 시험범위로 업로드 폼을 거들어 준다 (읽기 전용).
 *
 * 학교를 고르면 그 학교의 슬롯을 전부 읽어, **범위(단원)는 정확히 그 시험의 것만** 쓰고
 * **교과서는 가장 가까운 슬롯에서** 가져온다. 학년도가 하나 어긋난다고 교과서를 비워 두면
 * 이미 등록돼 있는 값을 매번 손으로 다시 고르게 된다(줄 세우기는 `scope-pick.ts`).
 *
 * ⚠️ 자동으로 채우기만 하고 **덮어쓰지 않는다**(호출부 책임). 직접 고른 교과서를
 *    범위 조회가 되돌리면 선생님이 같은 칸을 두 번 고치게 된다.
 */

export { semesterDigit } from './scope-pick';
export type { ScopeBasis } from './scope-pick';

/** 폼에 돌려줄 힌트 */
export interface ScopeHint {
  /** 체크된 단원 키("대단원" | "대단원 > 소단원"). **정확히 그 시험**의 것만 담는다 */
  units: string[];
  /** 이 학교가 이 시험을 안 본다(ara-system mig379). 값이 남아 있어도 쓰면 안 된다 */
  noExam: boolean;
  /** 등록된 교과서 이름 (관리자시스템 표기 그대로). 없으면 null */
  textbookName: string | null;
  /** 그 교과서를 이 앱의 카테고리 마스터에서 찾은 결과. 못 찾으면 null */
  matchedTextbook: string | null;
  /** 교과서를 어느 슬롯에서 가져왔는가. 못 가져왔으면 null */
  basis: ScopeBasis | null;
  /** 그 슬롯이 폼의 다섯 키와 정확히 같은가 — 아니면 화면이 기준을 밝힌다 */
  exact: boolean;
}

/** `toScopeHint` 에 넘길 재료 */
export interface ScopeHintInput {
  /** 그 학교의 슬롯 전부 */
  rows: readonly SchoolScopeRow[];
  /** 폼 조건 */
  wanted: ScopeWanted;
  /** 교과서를 가져온 슬롯 (`pickTextbookRow` 결과) */
  chosen: SchoolScopeRow | null;
  /** 그 슬롯에 연결된 교과서. 못 읽었으면 null */
  textbook: PublicTextbook | null;
  /** 이 앱의 교과서(출판사) 이름 목록 */
  textbookNames: readonly string[];
}

/**
 * 조회 결과를 폼이 쓸 힌트로 바꾼다 (순수 함수).
 *
 * 범위·'안 보는 시험' 은 **정확한 슬롯**만 본다 — 다른 학년도의 단원을 이번 시험 범위라고
 * 보여 주면 거짓말이 된다. 교과서만 다른 슬롯에서 빌린다.
 * @param input - 조회 재료
 * @returns 힌트. 그 학교에 등록된 슬롯이 하나도 없으면 null
 */
export function toScopeHint(input: ScopeHintInput): ScopeHint | null {
  const { rows, wanted, chosen, textbook, textbookNames } = input;
  if (rows.length === 0) return null;

  const exactSlot = findExactSlot(rows, wanted);
  const noExam = exactSlot?.noExam === true;
  // '안 보는 시험'의 범위는 값 보존·잠금으로 남은 옛 값이다
  const units = exactSlot && !noExam ? exactSlot.units : [];
  const name = chosen && textbook ? textbook.publisher : null;

  return {
    units,
    noExam,
    textbookName: name,
    matchedTextbook: matchTextbookName(textbookNames, name),
    basis: chosen && textbook ? toScopeBasis(chosen) : null,
    exact: chosen !== null && chosen === exactSlot,
  };
}

/** 시험범위를 찾을 조건 (폼 표시값 그대로) */
export interface ScopeQuery {
  /** public.schools.id — 이것만 필수다 */
  schoolId: string;
  grade: string;
  year: string;
  semester: string;
  examType: string;
  /** 이 앱의 교과서(출판사) 이름 목록 — 이름 맞추기에 쓴다 */
  textbookNames: readonly string[];
}

/**
 * 시험범위 힌트를 읽어 온다.
 *
 * 학교만 고르면 조회한다 — 나머지 조건은 **어느 슬롯을 고를지**에만 쓰인다.
 * 조회 실패는 fail-soft — 힌트가 없을 뿐 업로드를 막지 않는다.
 * @param query - 조회 조건
 * @returns 힌트. 학교를 안 골랐거나 등록된 범위가 없으면 null
 */
export async function fetchScopeHint(query: ScopeQuery): Promise<ScopeHint | null> {
  const { schoolId, textbookNames } = query;
  if (!schoolId) return null;

  try {
    const rows = await fetchSchoolScopeRows(schoolId);
    const wanted = toScopeWanted(query);
    const chosen = pickTextbookRow(rows, wanted);
    const textbook = chosen?.textbook_id ? await fetchPublicTextbook(chosen.textbook_id) : null;
    return toScopeHint({ rows, wanted, chosen, textbook, textbookNames });
  } catch {
    // 힌트가 없을 뿐이다 — 교과서는 손으로 고를 수 있다
    return null;
  }
}
