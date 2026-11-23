import { areaPathLabel } from '@/lib/problem-bank/area-tree';
import { sourceLabel, type SourceLabelInput } from '@/lib/problem-bank/source-label';
import type { ProblemSourceType } from '@/types/problem-bank';
import { withOriginalNumber, type ReportCategory } from './types';

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

/** 관리자센터 인테이크가 출처 글을 자르는 길이 — Ara-system `lib/problemReportIntake` 의 `LIMITS.sourceLabel` 과 같은 값 */
export const INTAKE_SOURCE_LABEL_MAX = 80;

/** 출처 끝의 괄호 꼬리(과목·형) — 앞 공백까지 함께 */
const SECTION_TAIL = /\s*\([^()]*\)$/;

/** 괄호 꼬리를 지키고도 앞에 남겨야 할 최소 글자 수 — 이보다 좁으면 꼬리를 포기한다(앞이 안 보이면 무슨 시험인지 모른다) */
const MIN_HEAD_CHARS = 12;

/**
 * 원장 웍스 알림에 보낼 출처 글 — 원래 번호 꼬리(' · 원래 35번')는 지키고 앞의 출처만 줄인다.
 * 인테이크는 넘치면 끝을 자르는데, 모의고사·평가문제집 제목(120자까지)이면 원래 번호가 잘려 문제지 신고에 인쇄 번호만 남는다(코덱스 2R).
 * @param label - 출처 줄(`reportSourceLabel`)
 * @param number - 원래 번호(`snapshot->number`)
 * @param max - 상한(기본 인테이크 상한)
 * @returns 상한 안의 출처 글
 */
export function intakeSourceLabel(label: string, number: unknown, max: number = INTAKE_SOURCE_LABEL_MAX): string {
  const base = label.trim();
  const full = withOriginalNumber(base, number);
  if (full.length <= max) return full;
  const tail = full.slice(base.length);
  // 끝의 괄호 꼬리('(언어와 매체)')는 같은 시험의 과목을 가른다 — 가운데를 줄이고 꼬리를 지킨다(코덱스 3R).
  // 꼬리를 남기면 앞에 둘 자리가 너무 좁을 때만 꼬리를 포기한다
  const section = SECTION_TAIL.exec(base)?.[0] ?? '';
  const head = base.slice(0, base.length - section.length).trimEnd();
  const room = max - tail.length - section.length - 1;
  if (section && room >= MIN_HEAD_CHARS) return `${head.slice(0, room)}…${section}${tail}`;
  return `${base.slice(0, Math.max(max - tail.length - 1, 0))}…${tail}`;
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

/**
 * 신고 창이 읽은 '굳힐 상태' — 서버가 만든 지문과 함께(`exam.problem_report_state`, sql/114).
 * 출처·번호는 신고가 굳힐 그 값이다(문제 은행 문항이면 지금 원본, 문제지 항목이면 문제지를 만들 때의 스냅샷 — 코덱스 5R).
 */
export interface ReportState {
  /** 지금 원본의 태그 — 원본 문항이 지워진 문제지 항목이면 null */
  tags: ReportTags | null;
  source: SourceLabelInput | null;
  /** 원래 번호 */
  number: number | null;
  /** 이 상태의 지문 — 신고에 실어 보내면 RPC 가 굳힐 값과 견준다(브라우저는 견주지 않는다) */
  token: string;
}

/** 상태를 읽을 대상 — 문제 은행 문항 또는 문제지 항목 */
export type ReportStateSubject = { problemId: string } | { paperItemId: string };

/**
 * `problem_report_state` 응답을 읽는다 — 지문이 없으면 null(지문 없이 보내면 대조 없이 지금 값이 굳는다).
 * @param value - RPC 응답
 * @returns 굳힐 상태 또는 null
 */
export function parseReportState(value: unknown): ReportState | null {
  const token = textOf(value, 'token');
  if (!token) return null;
  const number = fieldOf(value, 'number');
  return {
    tags: parseReportTags(fieldOf(value, 'tags')),
    source: reportSourceInput(fieldOf(value, 'source')),
    number: typeof number === 'number' && Number.isInteger(number) ? number : null,
    token,
  };
}

/**
 * 이 종류는 신고 창이 지금 상태를 보여 주고 그 지문을 실어 보내나 — 태그·출처 신고만.
 * 다른 종류에 실으면 그사이 태그가 고쳐졌다는 까닭만으로 정답·오타 신고가 거절된다.
 * @param category - 고른 종류
 * @returns 태그·출처 신고면 true
 */
export function categoryShowsState(category: ReportCategory | ''): category is 'tag' | 'source' {
  return category === 'tag' || category === 'source';
}
