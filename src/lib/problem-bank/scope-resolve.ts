import { fetchPublicTextbook, fetchScopeSlot } from '@/lib/naesin-scope/fetch';
import type { PublicTextbook, ScopeSlotRow } from '@/lib/naesin-scope/types';
import { matchTextbookName } from './unit-master';

/**
 * 관리자시스템 **내신 관리**에 등록된 시험범위로 업로드 폼을 거들어 준다 (읽기 전용).
 *
 * 선생님이 학교·학년·학년도·학기·시험을 이미 골랐다면 그 시험의 교과서는 이미
 * 관리자시스템에 등록돼 있다 — 다시 고르게 하지 않는다.
 *
 * ⚠️ 자동으로 채우기만 하고 **덮어쓰지 않는다**(호출부 책임). 직접 고른 교과서를
 *    범위 조회가 되돌리면 선생님이 같은 칸을 두 번 고치게 된다.
 */

/** 폼에 돌려줄 힌트 */
export interface ScopeHint {
  /** 체크된 단원 키("대단원" | "대단원 > 소단원"). 참고용이다 */
  units: string[];
  /** 이 학교가 이 시험을 안 본다(ara-system mig379). 값이 남아 있어도 쓰면 안 된다 */
  noExam: boolean;
  /** 등록된 교과서 이름 (관리자시스템 표기 그대로). 없으면 null */
  textbookName: string | null;
  /** 그 교과서를 이 앱의 카테고리 마스터에서 찾은 결과. 못 찾으면 null */
  matchedTextbook: string | null;
}

/**
 * '1학기' 같은 표시값에서 학기 숫자를 뽑는다.
 * @param semester - 폼의 학기 값 ('' 는 미지정)
 * @returns 1 | 2. 미지정이면 null
 */
export function semesterDigit(semester: string): 1 | 2 | null {
  const m = (semester ?? '').match(/[12]/);
  if (!m) return null;
  return m[0] === '1' ? 1 : 2;
}

/**
 * 조회 결과를 폼이 쓸 힌트로 바꾼다 (순수 함수).
 * @param slot - 시험범위 슬롯. 없으면 null
 * @param textbook - 슬롯에 연결된 교과서. 없으면 null
 * @param textbookNames - 이 앱의 교과서(출판사) 이름 목록
 * @returns 힌트. 슬롯이 없으면 null
 */
export function toScopeHint(
  slot: ScopeSlotRow | null,
  textbook: PublicTextbook | null,
  textbookNames: readonly string[],
): ScopeHint | null {
  if (!slot) return null;
  // '안 보는 시험'은 범위·교과서가 남아 있어도 쓰지 않는다 — 값 보존·잠금 방식이라 옛 값이다
  if (slot.noExam) {
    return { units: [], noExam: true, textbookName: null, matchedTextbook: null };
  }
  const name = textbook?.publisher ?? null;
  return {
    units: slot.units,
    noExam: false,
    textbookName: name,
    matchedTextbook: matchTextbookName(textbookNames, name),
  };
}

/** 시험범위를 찾을 조건 */
export interface ScopeQuery {
  /** public.schools.id */
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
 * 학교·학년·학년도·학기·시험이 하나라도 미지정이면 **조회하지 않는다**
 * (슬롯 키가 다섯 개 모두라 하나만 비어도 찾을 수 없다).
 * 조회 실패는 fail-soft — 힌트가 없을 뿐 업로드를 막지 않는다.
 * @param query - 조회 조건
 * @returns 힌트. 조건이 모자라거나 등록된 범위가 없으면 null
 */
export async function fetchScopeHint(query: ScopeQuery): Promise<ScopeHint | null> {
  const { schoolId, grade, year, semester, examType, textbookNames } = query;
  const sem = semesterDigit(semester);
  const yearNumber = Number(year);
  if (!schoolId || !grade || !sem || !Number.isInteger(yearNumber)) return null;
  if (examType !== '중간' && examType !== '기말') return null;

  try {
    const slot = await fetchScopeSlot(schoolId, grade, yearNumber, sem, examType);
    if (!slot) return null;
    const textbook = slot.noExam || !slot.textbook_id
      ? null
      : await fetchPublicTextbook(slot.textbook_id);
    return toScopeHint(slot, textbook, textbookNames);
  } catch {
    // 힌트가 없을 뿐이다 — 교과서는 손으로 고를 수 있다
    return null;
  }
}
