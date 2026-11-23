import { sourceLabel, type SourceLabelInput } from '@/lib/problem-bank/source-label';
import type { ProblemSourceType } from '@/types/problem-bank';
import type { ReportCategory } from './types';

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

/** 태그 한 갈래 — 이름표와 값 목록. `path` 면 값이 경로 마디(대단원 › 소단원)다 */
export interface ReportTagGroup {
  label: string;
  values: string[];
  path: boolean;
}

/** 출처 칸 하나 — 이름표와 값 */
export interface ReportSourceField {
  label: string;
  value: string;
}

const SOURCE_TYPES = ['내신기출', '모의고사', '문제집', '프린트', '평가문제집'] as const satisfies readonly ProblemSourceType[];

/** HTML 이 접는 공백 무리(띄어쓰기·탭·줄바꿈·폼 피드·CR) — sql/114 `problem_report_norm_text` ②와 같은 정규식(display.test 가 대조) */
export const REPORT_HTML_SPACE_RUNS = /[\t\n\f\r ]+/g;

/**
 * 글 한 칸 정규화 — **화면(HTML)이 똑같이 그리는 것만** 같게 본다. sql/114 `problem_report_norm_text` 와 같은 규칙·차례다
 * (NFC → HTML 이 접는 공백 무리를 한 칸으로 → 앞뒤 띄어쓰기 걷기). 그 밖의 글자는 걷지 않는다 — 보이지 않는 글자·방향 제어 글자는
 * 창이 ⟨U+XXXX⟩ 로 드러낸다(`reportVisibleSegments`). ⚠️ `trim()` 을 쓰지 말 것 — NBSP·BOM 까지 걷어 서버 지문과 갈린다(Stop 게이트).
 * @param value - 글
 * @returns 정규화한 글(비면 빈 글)
 */
export function normalizeReportText(value: string): string {
  return value.normalize('NFC').replace(REPORT_HTML_SPACE_RUNS, ' ').replace(/^ +| +$/g, '');
}

/** 화면에서 안 보이거나 공백처럼 보여 드러내 그릴 글자 — 제어·서식(방향 제어·폭 없는 공백·BOM …)·띄어쓰기 아닌 공백·줄/문단 구분·기본 무시 글자(결합 글자 잇기·이체자 선택자·채움 글자 …, 코덱스 11R) */
const REPORT_HIDDEN_CHAR = /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}\p{Zs}\p{Default_Ignorable_Code_Point}]/u;

/** 글 조각 — 보통 글 또는 드러낸 글자 표시 */
export interface ReportTextSegment {
  text: string;
  /** 드러낸 글자면 true(`text` 는 'U+202E' 꼴) */
  hidden: boolean;
}

/**
 * 드러내지 않고 그대로 둘 글자인가 — 옛한글 채움 글자(U+115F·U+1160)만. 첫가끝 조합의 빈 자리를 채워 넣고 빼면 글자 모양이 달라지고,
 * 드러내면 옛한글이 깨진다(Stop 게이트). ⚠️ 이모지 잇기(ZWJ)·이체자 선택자·깃발 태그는 **늘 드러낸다** — 글꼴이 그 조합을 지원하지 않으면
 * 넣든 빼든 같아 보여 지문만 갈린다(Stop 게이트). 출처·태그에 이모지가 들 일은 거의 없고, 들어도 확인 칸에서는 표시가 더 안전하다.
 * @param cp - 코드 포인트
 * @returns 그대로 둘 글자면 true
 */
function keepsShape(cp: number): boolean {
  return cp === 0x115f || cp === 0x1160;
}

/**
 * 화면에 그릴 조각 — 안 보이거나 공백처럼 보이는 글자(띄어쓰기 빼고)를 'U+XXXX' 표시로 드러낸다. 신고 창의 확인 칸·머리 줄과 목록의 출처 줄이 쓴다.
 * 지문은 이런 글자를 걷지 않으므로(방향 제어를 걷으면 'BA' 로 보이던 제목이 'AB' 와 같아진다) 화면이 드러내야 지문이 다르면 화면도 다르다.
 * 옛한글 채움 글자만 그대로 둔다(`keepsShape`). 지문과 상관없는 긴 글(발문 앞부분)에는 쓰지 않는다.
 * @param value - 정규화한 글
 * @returns 조각 목록
 */
export function reportVisibleSegments(value: string): ReportTextSegment[] {
  const out: ReportTextSegment[] = [];
  const cps = Array.from(value, (c) => c.codePointAt(0) ?? 0);
  let run = '';
  cps.forEach((cp) => {
    const ch = String.fromCodePoint(cp);
    if (ch !== ' ' && REPORT_HIDDEN_CHAR.test(ch) && !keepsShape(cp)) {
      if (run) out.push({ text: run, hidden: false });
      run = '';
      out.push({ text: `U+${cp.toString(16).toUpperCase().padStart(4, '0')}`, hidden: true });
    } else {
      run += ch;
    }
  });
  if (run) out.push({ text: run, hidden: false });
  return out;
}

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
  return typeof field === 'string' ? normalizeReportText(field) : '';
}

/**
 * 글 목록 칸 — 빈 글·문자열 아닌 것은 버린다.
 * @param value - 받은 객체
 * @param key - 칸 이름
 * @returns 글 목록
 */
function listOf(value: unknown, key: string): string[] {
  const field = fieldOf(value, key);
  return Array.isArray(field)
    ? field.filter((v): v is string => typeof v === 'string').map(normalizeReportText).filter((v) => v !== '')
    : [];
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
 * 태그 갈래 — 값이 있는 것만, 작품 · 단원 · 영역 · 문법 차례. 화면은 **값마다 칸 하나**로 그린다 — 글로 이으면
 * ['가, 나'] 와 ['가', '나'] 가, 마디 하나 'A > B' 와 마디 둘이 똑같이 보인다(Stop 게이트). 문법은 전체 경로 한 칸.
 * @param tags - 태그
 * @returns 갈래 목록(다 비었으면 빈 배열)
 */
export function reportTagGroups(tags: ReportTags): ReportTagGroup[] {
  const groups: ReportTagGroup[] = [
    { label: '작품', values: tags.work_titles, path: false },
    { label: '단원', values: tags.unit_path, path: true },
    { label: '영역', values: tags.area_path, path: true },
    { label: '문법', values: tags.grammar_paths, path: false },
  ];
  return groups.filter((g) => g.values.length > 0);
}

/**
 * 신고 창이 읽은 '굳힐 상태' — 서버가 만든 지문과 함께(`exam.problem_report_state`, sql/114).
 * 출처·번호는 신고가 굳힐 그 값이다(문제 은행 문항이면 지금 원본, 문제지 항목이면 문제지를 만들 때의 스냅샷 — 코덱스 5R).
 */
export interface ReportState {
  /** 지금 원본의 태그 — 원본 문항이 지워진 문제지 항목이면 null */
  tags: ReportTags | null;
  /** 굳힐 출처(서버가 정규화한 jsonb 그대로 — 그릴 때 `reportSourceInput`·`reportSourceFields` 로 읽는다). 없으면 null */
  source: unknown;
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
    source: fieldOf(value, 'source') ?? null,
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

/** 출처 칸의 이름표와 차례 — 신고 창·신고 목록이 같은 줄을 쓴다 */
const SOURCE_FIELDS: readonly { key: keyof SourceLabelInput; label: string }[] = [
  { key: 'source_type', label: '유형' },
  { key: 'title', label: '제목' },
  { key: 'year', label: '학년도' },
  { key: 'grade', label: '학년' },
  { key: 'school_name', label: '학교' },
  { key: 'publisher', label: '출판사' },
  { key: 'semester', label: '학기' },
  { key: 'exam_type', label: '시험' },
];

/**
 * 출처의 모든 칸 — 이름표와 값, 빈 칸은 뺀다. 신고 창(출처 줄 아래)과 출처 신고의 목록 줄이 칸마다 따로 그린다.
 * 지문은 출처의 칸을 전부 담으므로 출처 줄(모의고사는 제목만, 내신은 제목이 없다)만 보이면 바뀐 칸이 안 보인 채 거절될 수 있고(7R),
 * 이름표가 없으면 값이 다른 칸으로 옮겨 가도(학교 → 출판사) 같아 보인다(8R). 유형을 모르는 출처도 칸은 다 읽는다.
 * @param source - 출처(jsonb)
 * @returns 칸 목록(객체가 아니면 null — '출처 없음' 과 '칸이 모두 빔'(빈 배열)을 가른다)
 */
export function reportSourceFields(source: unknown): ReportSourceField[] | null {
  if (typeof source !== 'object' || source === null || Array.isArray(source)) return null;
  return SOURCE_FIELDS
    .map(({ key, label }) => ({ label, value: textOf(source, key) }))
    .filter((f) => f.value !== '');
}
