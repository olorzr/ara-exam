import type { ProblemSource } from '@/types/problem-bank';

/**
 * 출처를 한 줄로 보여 준다 (순수 함수).
 *
 * 인쇄 머리말의 출처 줄은 **DB(RPC)가 만든다** — 문제지는 불변 스냅샷이라
 * 나중에 출처 정보가 바뀌어도 이미 인쇄한 문제지의 머리말이 흔들리면 안 되기 때문이다.
 * 이 함수는 **화면 표시용**이고, RPC 의 조립 규칙과 같은 순서를 쓴다.
 */

/** 라벨을 만들 수 있는 최소한의 필드 */
export type SourceLabelInput = Pick<
  ProblemSource,
  'source_type' | 'title' | 'school_name' | 'year' | 'grade' | 'exam_type' | 'publisher'
>;

/**
 * 목록·카드에 쓰는 한 줄 라벨.
 * @param source - 출처 (일부 필드만 있어도 된다)
 * @returns '2026 중2 상현중 중간' 같은 문자열. 만들 수 없으면 제목
 */
export function sourceLabel(source: SourceLabelInput): string {
  const parts = [
    source.year,
    source.grade,
    source.school_name || source.publisher,
    source.exam_type,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(' ') : source.title;
}

/**
 * 유형까지 붙인 긴 라벨 (필터 결과 요약 등).
 * @param source - 출처
 * @returns '내신기출 · 2026 중2 상현중 중간'
 */
export function sourceLabelWithType(source: SourceLabelInput): string {
  return `${source.source_type} · ${sourceLabel(source)}`;
}
