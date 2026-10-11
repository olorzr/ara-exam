import type { SchoolExamFacet } from './school-exam-tree';

/**
 * `exam.archive_facets()`(sql/66) 응답 — 모양 검사와 타입 (순수 모듈).
 *
 * 서버는 DISTINCT·GROUP BY 개수만 하고 **가중치 행**을 돌려준다. 세는 규칙(문법 조상 펴기,
 * 문학/문법/비문학 표결, 지은이 다수결)은 `grammar-counts.ts`·`work-counts.ts` 가 그대로 맡는다.
 *
 * ⚠️ 이 키 이름·모양은 sql/66 의 `jsonb_build_object` 와 **1:1** 이다. 한쪽만 바꾸면 그 패싯이
 *    조용히 빈 목록이 된다(모양이 어긋난 원소는 버리기 때문이다 — 화면이 죽지 않게).
 */

/** 패싯 스캔이 읽는 출처 칸 (출처 7칸의 서로 다른 조합 하나) */
export interface SourceFacetRow extends SchoolExamFacet {
  textbook: string;
  source_type: string;
}

/** 문법 태그 묶음(문항의 `grammar_paths` 그대로)과 그 묶음을 가진 문항 수 */
export interface WeightedGrammarPaths {
  paths: string[];
  n: number;
}

/** 작품명 묶음(문항의 `work_titles` 그대로)과 그 묶음을 가진 문항 수 */
export interface WeightedWorkTitles {
  titles: string[];
  n: number;
}

/** 지문의 (제목, 지은이, 영역) 조합과 그 조합이 나온 지문 수 */
export interface PassageWorkVote {
  title: string;
  author: string;
  area_path: string[];
  n: number;
}

/** 아카이브 패싯 재료 전부 */
export interface ArchiveFacetsPayload {
  sources: SourceFacetRow[];
  area_paths: string[][];
  unit_paths: string[][];
  grammar_paths: WeightedGrammarPaths[];
  work_titles: WeightedWorkTitles[];
  passage_works: PassageWorkVote[];
}

/** 아직 못 읽었거나 읽지 못했을 때 */
export const EMPTY_ARCHIVE_FACETS: ArchiveFacetsPayload = {
  sources: [], area_paths: [], unit_paths: [], grammar_paths: [], work_titles: [], passage_works: [],
};

const SOURCE_TEXT_KEYS = [
  'school_name', 'year', 'grade', 'textbook', 'source_type', 'semester', 'exam_type',
] as const;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === 'string');
}

/** 개수 — 1 이상의 정수만 받는다(0·음수·소수는 서버가 낼 리 없으니 모양이 어긋난 것이다) */
function isCount(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v >= 1;
}

/** 배열이면 원소마다 고쳐 담고, 고칠 수 없는 원소는 버린다. 배열이 아니면 빈 배열 */
function pickAll<T>(raw: unknown, pick: (item: unknown) => T | null): T[] {
  if (!Array.isArray(raw)) return [];
  const out: T[] = [];
  for (const item of raw) {
    const picked = pick(item);
    if (picked !== null) out.push(picked);
  }
  return out;
}

/** 출처 칸 — null 은 빈 문자열로 읽는다(DB 의 빈 값 규약이 `''` 이다) */
function pickSource(item: unknown): SourceFacetRow | null {
  if (!isRecord(item)) return null;
  const row: Record<string, string> = {};
  for (const key of SOURCE_TEXT_KEYS) {
    const v = item[key];
    if (v === null || v === undefined) row[key] = '';
    else if (typeof v === 'string') row[key] = v;
    else return null;
  }
  return {
    school_name: row.school_name, year: row.year, grade: row.grade, textbook: row.textbook,
    source_type: row.source_type, semester: row.semester, exam_type: row.exam_type,
  };
}

function pickPath(item: unknown): string[] | null {
  return isStringArray(item) && item.length > 0 ? item : null;
}

function pickGrammar(item: unknown): WeightedGrammarPaths | null {
  if (!isRecord(item) || !isStringArray(item.paths) || !isCount(item.n)) return null;
  return { paths: item.paths, n: item.n };
}

function pickTitles(item: unknown): WeightedWorkTitles | null {
  if (!isRecord(item) || !isStringArray(item.titles) || !isCount(item.n)) return null;
  return { titles: item.titles, n: item.n };
}

function pickVote(item: unknown): PassageWorkVote | null {
  if (!isRecord(item) || typeof item.title !== 'string' || !item.title || !isCount(item.n)) return null;
  const author = typeof item.author === 'string' ? item.author : '';
  // 영역이 없는 지문도 갈래 '모름' 으로 세야 하므로 null 은 빈 경로로 받는다
  const areaPath = item.area_path === null || item.area_path === undefined ? [] : item.area_path;
  if (!isStringArray(areaPath)) return null;
  return { title: item.title, author, area_path: areaPath, n: item.n };
}

/**
 * RPC 응답을 검사해 타입으로 옮긴다.
 *
 * 모양이 어긋난 원소는 **버리고** 나머지는 살린다 — 패싯은 목록을 돕는 곁가지라, 한 원소 때문에
 * 트리 전체가 비거나 화면이 죽으면 안 된다. 응답 자체가 객체가 아니면 빈 패싯이다.
 * @param raw - `supabase.rpc('archive_facets')` 의 data
 * @returns 검사를 통과한 패싯 재료
 */
export function parseArchiveFacets(raw: unknown): ArchiveFacetsPayload {
  if (!isRecord(raw)) return EMPTY_ARCHIVE_FACETS;
  return {
    sources: pickAll(raw.sources, pickSource),
    area_paths: pickAll(raw.area_paths, pickPath),
    unit_paths: pickAll(raw.unit_paths, pickPath),
    grammar_paths: pickAll(raw.grammar_paths, pickGrammar),
    work_titles: pickAll(raw.work_titles, pickTitles),
    passage_works: pickAll(raw.passage_works, pickVote),
  };
}
