import { isCount, isRecord, isStringArray, pickAll } from './facets-payload';
import { MOCK_EXAM_SOURCE_TYPE, SCHOOL_EXAM_SOURCE_TYPE } from './school-exam-tree';

/**
 * `exam.source_sets()`(sql/107) 응답의 모양과 파서.
 *
 * 키 이름·모양은 sql/107 과 1:1 이다. 파서는 `facets-payload.ts` 와 같은 규약으로 **모양이 어긋난 원소만** 버린다 —
 * 하나가 틀렸다고 목록을 통째로 버리면 세트 화면이 비고, 어긋난 원소를 그대로 들이면 카드가 깨진다.
 */

/** 세트가 되는 출처 유형 — 평가문제집·문제집·프린트는 세트가 아니다 */
export const SET_SOURCE_TYPES = [SCHOOL_EXAM_SOURCE_TYPE, MOCK_EXAM_SOURCE_TYPE] as const;

/** 세트 유형 */
export type SetSourceType = (typeof SET_SOURCE_TYPES)[number];

/** 서버가 준 세트 한 장 */
export interface SourceSetRow {
  source_type: SetSourceType;
  year: string;
  grade: string;
  /** 모의고사는 늘 '' */
  semester: string;
  /** 시험(중간·기말) 또는 모의고사 회차 */
  exam_type: string;
  /** 내신 교과서. '' 는 미지정(2015 개정은 일부러 비워 둔다). 모의고사는 늘 '' */
  textbook: string;
  /** 모의고사 주관(평가원·교육청). 내신은 늘 '' */
  publisher: string;
  /** 출처 행 수 — 같은 학교가 두 건 든 세트가 있어 `names` 수와 다를 수 있다 */
  exam_count: number;
  /** 내신은 학교 이름, 모의고사는 출처 제목(중복 없음) */
  names: string[];
}

const TEXT_KEYS = ['year', 'grade', 'semester', 'exam_type', 'textbook', 'publisher'] as const;

/**
 * 세트 유형인가.
 * @param value - 출처 유형
 * @returns 내신기출·모의고사면 true
 */
export function isSetSourceType(value: unknown): value is SetSourceType {
  return typeof value === 'string' && (SET_SOURCE_TYPES as readonly string[]).includes(value);
}

/** 원소 하나 — null 칸은 '' 로 읽는다(DB 의 빈 값 규약), 어긋나면 null */
function pickSet(item: unknown): SourceSetRow | null {
  if (!isRecord(item) || !isSetSourceType(item.source_type)) return null;
  if (!isCount(item.exam_count) || !isStringArray(item.names) || item.names.length === 0) return null;
  const text: Record<string, string> = {};
  for (const key of TEXT_KEYS) {
    const value = item[key] ?? '';
    if (typeof value !== 'string') return null;
    text[key] = value;
  }
  return {
    source_type: item.source_type,
    year: text.year, grade: text.grade, semester: text.semester, exam_type: text.exam_type,
    textbook: text.textbook, publisher: text.publisher,
    exam_count: item.exam_count,
    names: [...item.names],
  };
}

/**
 * RPC 응답을 읽는다.
 * @param raw - `supabase.rpc('source_sets')` 의 data
 * @returns 모양이 맞는 세트들 (배열이 아니면 빈 배열)
 */
export function parseSourceSets(raw: unknown): SourceSetRow[] {
  return pickAll(raw, pickSet);
}
