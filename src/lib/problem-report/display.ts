import { areaPathLabel } from '@/lib/problem-bank/area-tree';
import { sourceLabel, type SourceLabelInput } from '@/lib/problem-bank/source-label';
import type { ProblemSourceType } from '@/types/problem-bank';

/**
 * 오류 신고 목록·원장 알림에 찍는 글 — 출처 줄과 신고 때의 태그(순수, 서버 라우트도 쓴다).
 *
 * 2026-11-23(sql/114, 코덱스 1R): 태그·출처 신고는 내용 없이도 낼 수 있어 '선생님이 무엇을 보고 신고했는가' 가
 * 기록에서 바로 읽혀야 한다.
 * - **출처 줄은 신고 스냅샷의 출처로 카드·교사용과 같은 규칙(`sourceLabel`)으로 만든다.** 저장된 `source_label` 은
 *   DB 함수(`paper_source_label`)가 칸을 이은 것이라 모의고사의 공통·화작·언매(제목으로 갈린다)가 한 줄로 뭉개진다.
 *   스냅샷 출처를 못 읽으면 저장된 줄로 떨어진다.
 * - **태그는 신고 때 원본 문항의 값**(`tags` 칸) — 원장이 보기 전에 태그를 고치거나 다시 적재해도 선생님이 짚은 값이 남는다.
 */

/** 신고 때 원본 문항의 태그(`problem_reports.tags`, sql/114) */
export interface ReportTags {
  work_titles: string[];
  unit_path: string[];
  area_path: string[];
  grammar_paths: string[];
}

/** 태그 한 줄 — 이름표와 값 */
export interface ReportTagLine {
  label: string;
  value: string;
}

const SOURCE_TYPES = ['내신기출', '모의고사', '문제집', '프린트', '평가문제집'] as const satisfies readonly ProblemSourceType[];

/**
 * 객체의 한 칸을 읽는다(모양을 모르는 jsonb).
 * @param value - 받은 값
 * @param key - 칸 이름
 * @returns 그 칸의 값(객체가 아니면 undefined)
 */
function fieldOf(value: unknown, key: string): unknown {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined;
  return (value as Record<string, unknown>)[key];
}

/**
 * 문자열 칸 — 문자열이 아니면 빈 글.
 * @param value - 받은 객체
 * @param key - 칸 이름
 * @returns 그 칸의 글
 */
function textOf(value: unknown, key: string): string {
  const field = fieldOf(value, key);
  return typeof field === 'string' ? field : '';
}

/**
 * 글 목록 칸 — 빈 글·문자열 아닌 것은 버린다.
 * @param value - 받은 객체
 * @param key - 칸 이름
 * @returns 글 목록
 */
function listOf(value: unknown, key: string): string[] {
  const field = fieldOf(value, key);
  return Array.isArray(field) ? field.filter((v): v is string => typeof v === 'string' && v.trim() !== '') : [];
}

/**
 * 신고 스냅샷의 출처(jsonb)를 출처 줄 입력으로 — 유형을 모르거나 객체가 아니면 null.
 * 원본 출처가 없던 문항은 칸이 전부 null 인 객체로 굳는다(sql/103 `paper_source_snapshot` 의 LEFT JOIN).
 * @param value - `snapshot.source`
 * @returns 출처 줄 입력 또는 null
 */
export function reportSourceInput(value: unknown): SourceLabelInput | null {
  const type = SOURCE_TYPES.find((t) => t === fieldOf(value, 'source_type'));
  if (!type) return null;
  return {
    source_type: type,
    title: textOf(value, 'title'),
    school_name: textOf(value, 'school_name'),
    year: textOf(value, 'year'),
    grade: textOf(value, 'grade'),
    semester: textOf(value, 'semester'),
    exam_type: textOf(value, 'exam_type'),
    publisher: textOf(value, 'publisher'),
  };
}

/**
 * 신고의 출처 줄 — 카드·교사용과 같은 규칙. 스냅샷 출처를 못 읽으면 저장된 줄.
 * @param source - 신고 스냅샷의 출처(`snapshot.source`)
 * @param stored - 저장된 `source_label`
 * @returns '2026학년도 수능 (언어와 매체)' · '2026 중2 상현중 1학기 중간' 같은 줄(없으면 빈 글)
 */
export function reportSourceLabel(source: unknown, stored: string | null | undefined): string {
  const input = reportSourceInput(source);
  const label = input ? sourceLabel(input).trim() : '';
  return label || (stored ?? '');
}

/**
 * `tags` 칸을 읽는다 — 객체가 아니면(원본이 없었거나 sql/114 전 신고) null.
 * @param value - 받은 값
 * @returns 태그 넷 또는 null
 */
export function parseReportTags(value: unknown): ReportTags | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  return {
    work_titles: listOf(value, 'work_titles'),
    unit_path: listOf(value, 'unit_path'),
    area_path: listOf(value, 'area_path'),
    grammar_paths: listOf(value, 'grammar_paths'),
  };
}

/**
 * 태그 줄 — 값이 있는 것만, 작품 · 단원 · 영역 · 문법 차례. 문법은 전체 경로(카드는 끝 마디만 칩으로 낸다 — 원장이 고칠 자리를 바로 짚게).
 * @param tags - 신고 때의 태그
 * @returns 줄 목록(다 비었으면 빈 배열)
 */
export function reportTagLines(tags: ReportTags): ReportTagLine[] {
  const lines: ReportTagLine[] = [
    { label: '작품', value: tags.work_titles.join(', ') },
    { label: '단원', value: areaPathLabel(tags.unit_path) },
    { label: '영역', value: areaPathLabel(tags.area_path) },
    { label: '문법', value: tags.grammar_paths.join(', ') },
  ];
  return lines.filter((line) => line.value !== '');
}
