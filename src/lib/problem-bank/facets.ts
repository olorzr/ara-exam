import { supabase } from '@/lib/supabase';
import { expandGrammarAncestors } from './grammar-tree';
import { tallyGrammarCounts } from './grammar-counts';
import {
  SCHOOL_EXAM_SOURCE_TYPE, schoolExamKey, type SchoolExamFacet,
} from './school-exam-tree';

/**
 * 아카이브 필터 선택지(패싯) 모으기.
 *
 * ⚠️ **1,000행에서 자르면 안 된다.** PostgREST 기본 상한만 믿으면 업로드가 쌓였을 때
 *    그 뒤에만 있는 학교·학년도·교과서·영역·단원이 **선택지에서 조용히 사라진다**
 *    (문항은 목록에 있는데 고를 수가 없다 — 코덱스 리뷰 6R·15R).
 *    한두 컬럼만 읽으므로 끝까지 훑어도 가볍다.
 */

/** 한 번에 읽는 행 수 (PostgREST 기본 상한) */
const FACET_CHUNK = 1000;

/** 훑을 최대 행 수 — 무한정 훑지 않기 위한 안전판 */
const FACET_MAX_ROWS = 20_000;

/** 출처에서 모은 선택지 */
export interface SourceFacets {
  schools: string[];
  years: string[];
  grades: string[];
  /** 교과서(= exam.publishers.name 스냅샷) */
  textbooks: string[];
  /** 학기 ('1학기'·'2학기') */
  semesters: string[];
  /** 학교 기출 트리를 만들 갈래 (내신기출만, 중복 없음) */
  schoolExams: SchoolExamFacet[];
}

/** 아직 못 읽었을 때 쓰는 빈 선택지 */
export const EMPTY_SOURCE_FACETS: SourceFacets = {
  schools: [], years: [], grades: [], textbooks: [], semesters: [], schoolExams: [],
};

/** 패싯 스캔이 읽는 출처 컬럼 */
interface SourceFacetRow extends SchoolExamFacet {
  textbook: string;
  source_type: string;
}

/**
 * 출처 컬럼에서 실제로 존재하는 값들을 모은다.
 *
 * 학교 기출 트리의 갈래도 **같은 스캔**에서 뽑는다 — 컬럼 몇 개를 더 고르는 것뿐이라
 * 왕복을 늘릴 이유가 없다.
 * @returns 학교·학년도·학년·교과서·학기 목록과 학교 기출 갈래
 */
export async function fetchSourceFacets(): Promise<SourceFacets> {
  const rows: SourceFacetRow[] = [];
  for (let from = 0; from < FACET_MAX_ROWS; from += FACET_CHUNK) {
    const { data, error } = await supabase
      .from('problem_sources')
      .select('school_name, year, grade, textbook, source_type, semester, exam_type')
      .order('id')
      .range(from, from + FACET_CHUNK - 1);
    if (error) throw error;
    const page = (data ?? []) as typeof rows;
    rows.push(...page);
    if (page.length < FACET_CHUNK) break;
  }

  const uniq = (values: string[]) => [...new Set(values.filter(Boolean))].sort();
  return {
    schools: uniq(rows.map((r) => r.school_name)),
    years: uniq(rows.map((r) => r.year)).reverse(),
    grades: uniq(rows.map((r) => r.grade)),
    textbooks: uniq(rows.map((r) => r.textbook)),
    semesters: uniq(rows.map((r) => r.semester)),
    schoolExams: collectSchoolExams(rows),
  };
}

/** 내신기출 행에서 학교 기출 갈래를 중복 없이 모은다 */
function collectSchoolExams(rows: SourceFacetRow[]): SchoolExamFacet[] {
  const seen = new Set<string>();
  const out: SchoolExamFacet[] = [];
  for (const row of rows) {
    if (row.source_type !== SCHOOL_EXAM_SOURCE_TYPE || !row.school_name) continue;
    const facet: SchoolExamFacet = {
      school_name: row.school_name, year: row.year, grade: row.grade,
      semester: row.semester, exam_type: row.exam_type,
    };
    const key = schoolExamKey(facet);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(facet);
  }
  return out;
}

/**
 * 이름 경로 배열 컬럼에 실제로 쓰인 경로들 — 필터 선택지를 만든다.
 * @param column - 이름 경로 배열 컬럼 ('area_path' 영역 · 'unit_path' 교과서 단원)
 * @returns 중복 없는 경로 목록 (사전순)
 */
async function collectPathFacets(column: 'area_path' | 'unit_path'): Promise<string[][]> {
  const seen = new Set<string>();
  const out: string[][] = [];

  for (let from = 0; from < FACET_MAX_ROWS; from += FACET_CHUNK) {
    const { data, error } = await supabase
      .from('problems')
      .select(column)
      .not(column, 'eq', '{}')
      .order('id')
      .range(from, from + FACET_CHUNK - 1);
    // 선택지를 못 만들어도 목록은 봐야 한다 — 여기까지 모은 것만 돌려준다
    if (error) break;

    const rows = (data ?? []) as unknown as Record<string, string[]>[];
    for (const row of rows) {
      const path = row[column] ?? [];
      const key = path.join(' > ');
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push(path);
    }
    if (rows.length < FACET_CHUNK) break;
  }

  return out.sort((a, b) => a.join('>').localeCompare(b.join('>'), 'ko'));
}

/** 아카이브에 실제로 있는 작품 하나 */
export interface WorkFacet {
  /** `problems.work_title` (표준 표기) */
  title: string;
  /** 지은이 — 지문에서 가져온다. 모르면 '' */
  author: string;
  /** 이 작품으로 태깅된 문항 수 */
  count: number;
}

/**
 * 아카이브에 쓰인 작품 목록.
 *
 * 개수를 함께 세는 이유: 트리에 '동백꽃 (12)' 로 보여야 어느 작품이 문제 은행에 두툼하게
 * 쌓였는지 한눈에 보인다.
 *
 * 지은이는 `problems` 에 없다 — 지문(`passages.title`/`author`)에서 같은 제목을 찾아
 * 붙인다. 폴더를 지은이로 나누기 때문이다. 같은 제목에 지은이가 여럿이면(표기가 갈렸거나
 * 동명이작) **가장 많이 쓰인 이름**을 고른다.
 * @returns 작품 목록 (제목 한글 사전순)
 */
export async function fetchWorkFacets(): Promise<WorkFacet[]> {
  const counts = new Map<string, number>();
  for (let from = 0; from < FACET_MAX_ROWS; from += FACET_CHUNK) {
    const { data, error } = await supabase
      .from('problems')
      .select('work_title')
      .neq('work_title', '')
      .order('id')
      .range(from, from + FACET_CHUNK - 1);
    // 선택지를 못 만들어도 목록은 봐야 한다 — 여기까지 모은 것만 돌려준다
    if (error) break;
    const rows = (data ?? []) as { work_title: string }[];
    for (const row of rows) {
      const title = row.work_title;
      if (!title) continue;
      counts.set(title, (counts.get(title) ?? 0) + 1);
    }
    if (rows.length < FACET_CHUNK) break;
  }
  if (counts.size === 0) return [];

  const authors = await collectPassageAuthors();
  return [...counts.entries()]
    .map(([title, count]) => ({ title, author: authors.get(title) ?? '', count }))
    .sort((a, b) => a.title.localeCompare(b.title, 'ko'));
}

/** 지문에서 제목 → 지은이를 모은다 (가장 많이 쓰인 이름을 고른다) */
async function collectPassageAuthors(): Promise<Map<string, string>> {
  const tally = new Map<string, Map<string, number>>();
  for (let from = 0; from < FACET_MAX_ROWS; from += FACET_CHUNK) {
    const { data, error } = await supabase
      .from('passages')
      .select('title, author')
      .neq('title', '')
      .neq('author', '')
      .order('id')
      .range(from, from + FACET_CHUNK - 1);
    if (error) break;
    const rows = (data ?? []) as { title: string; author: string }[];
    for (const row of rows) {
      const byAuthor = tally.get(row.title) ?? new Map<string, number>();
      byAuthor.set(row.author, (byAuthor.get(row.author) ?? 0) + 1);
      tally.set(row.title, byAuthor);
    }
    if (rows.length < FACET_CHUNK) break;
  }

  const out = new Map<string, string>();
  for (const [title, byAuthor] of tally) {
    const best = [...byAuthor.entries()].sort((a, b) => b[1] - a[1])[0];
    if (best) out.set(title, best[0]);
  }
  return out;
}

/**
 * 아카이브에 쓰인 영역 경로 목록.
 * @returns 중복 없는 경로 목록
 */
export const fetchAreaFacets = (): Promise<string[][]> => collectPathFacets('area_path');


/**
 * 아카이브에 쓰인 교과서 단원 경로 목록.
 * @returns 중복 없는 경로 목록
 */
export const fetchUnitFacets = (): Promise<string[][]> => collectPathFacets('unit_path');

/** 문법 개념 하나 — 경로와 그 아래(자기 자신 포함) 문항 수 */
export interface GrammarFacet {
  /** 저장 표기 그대로의 경로 ('단어 > 품사 > 명사') */
  path: string;
  /** 이 경로에 걸리는 문항 수 */
  count: number;
}

/**
 * 아카이브에 태깅된 문법 분류와 그 문항 수.
 *
 * ⚠️ `collectPathFacets` 를 재사용할 수 없다 — 그쪽은 컬럼 하나가 **경로 하나**라는
 *    전제인데, 이 컬럼은 원소 하나가 경로 하나이고 한 행에 여러 개가 들어 있다.
 *
 * 세는 규칙(조상 중복 제거)은 `tallyGrammarCounts` 에 있다. 개수를 함께 세는 이유는
 * 작품 패싯과 같다 — 트리에 '명사 (5)' 로 보여야 어디에 기출이 쌓였는지, 어디가
 * 아직 비었는지 한눈에 보인다.
 *
 * ⚠️ 선택지는 이것으로 만들지 **않는다.** 태깅된 잎만 모으므로 아무도 안 붙인 개념은
 *    영영 안 나온다 — 선택지·트리는 마스터(`GRAMMAR_ALL_PATHS`)에서 만들고 여기 건수를
 *    얹는다. 이 함수는 '얼마나 쌓였나' 만 답한다.
 *
 * ⚠️ `FACET_MAX_ROWS` 를 넘는 아카이브에서는 건수가 근사치가 된다(작품 패싯과 같은 한계).
 * @returns 경로와 문항 수 (교재 목차 순서, 마스터에 없는 옛 경로는 뒤로)
 */
export async function fetchGrammarFacets(): Promise<GrammarFacet[]> {
  const rows: string[][] = [];

  for (let from = 0; from < FACET_MAX_ROWS; from += FACET_CHUNK) {
    const { data, error } = await supabase
      .from('problems')
      .select('grammar_paths')
      .not('grammar_paths', 'eq', '{}')
      .order('id')
      .range(from, from + FACET_CHUNK - 1);
    // 건수를 못 세도 목록은 봐야 한다 — 여기까지 모은 것만 돌려준다
    if (error) break;

    const page = (data ?? []) as unknown as { grammar_paths: string[] | null }[];
    for (const row of page) rows.push(row.grammar_paths ?? []);
    if (page.length < FACET_CHUNK) break;
  }

  const counts = tallyGrammarCounts(rows);
  return expandGrammarAncestors([...counts.keys()])
    .map((path) => ({ path, count: counts.get(path) ?? 0 }));
}
