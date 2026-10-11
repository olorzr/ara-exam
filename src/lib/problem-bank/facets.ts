import { supabase } from '@/lib/supabase';
import { expandGrammarAncestors } from './grammar-tree';
import { tallyWeightedGrammarCounts } from './grammar-counts';
import {
  collectWorkAuthors, collectWorkKinds, tallyWorkCounts, toWorkFacets,
  type PassageWorkRow, type WorkKind,
} from './work-counts';
import {
  MOCK_EXAM_SOURCE_TYPE, SCHOOL_EXAM_SOURCE_TYPE, schoolExamKey, type SchoolExamFacet,
} from './school-exam-tree';
import { collectSchoolsByLevel } from './school-level';
import type { SchoolLevel } from './source-form';
import { parseArchiveFacets, type ArchiveFacetsPayload, type SourceFacetRow } from './facets-payload';
import { cachedArchiveFacets } from './facets-cache';

/**
 * 아카이브 필터 선택지(패싯) 모으기.
 *
 * 재료는 `exam.archive_facets()`(sql/66) **한 번의 호출**로 받는다 — jsonb 하나라 PostgREST 1,000행
 * 상한과 무관하고, 한 탭 안에서는 `facets-cache.ts` 가 몇 분 동안 나눠 쓴다.
 *
 * ⚠️ 예전에는 문항 표의 한 열을 1,000행씩 **순서대로** 긁어 여기서 셌다(열마다 19~29번 왕복). 문항이
 *    29,000개가 되자 아카이브가 수 초씩 멈췄고, 안전판(20,000행)에 영역 열이 이미 걸려 있었다
 *    (작품 열도 18,810행으로 코앞이었다 — 걸리면 뒤쪽 문항이 트리·건수에서 **조용히** 빠진다, 2026-10-11).
 *    다시 표를 긁는 길을 만들지 말 것.
 * ⚠️ 서버는 DISTINCT·GROUP BY 개수만 한다. 세는 규칙(문법 조상 펴기·문학/문법/비문학 표결·지은이 다수결)은
 *    여기서 부르는 `grammar-counts.ts`·`work-counts.ts` 가 그대로 맡는다 — SQL 에 거울을 두지 않는다.
 */

/** RPC 를 부르고 응답을 검사한다 */
async function fetchArchiveFacets(): Promise<ArchiveFacetsPayload> {
  const { data, error } = await supabase.rpc('archive_facets');
  if (error) throw error;
  return parseArchiveFacets(data);
}

/**
 * 아카이브 패싯 재료 — 캐시가 있으면 그것, 없으면 한 번 읽는다.
 * @returns 출처 조합·영역·단원·문법 묶음·작품 묶음·지문 작품 표
 */
export function loadArchiveFacets(): Promise<ArchiveFacetsPayload> {
  return cachedArchiveFacets(fetchArchiveFacets);
}

/** 출처에서 모은 선택지 */
export interface SourceFacets {
  schools: string[];
  years: string[];
  grades: string[];
  /** 교과서(= exam.publishers.name 스냅샷) */
  textbooks: string[];
  /** 학기 ('1학기'·'2학기') */
  semesters: string[];
  /** 기출 트리를 만들 갈래 (학교가 있는 내신기출 + 모의고사, 중복 없음) */
  schoolExams: SchoolExamFacet[];
  /** 학교급 → 그 학교급 학년의 출처가 있는 학교들 (학교 칸을 좁힌다) */
  schoolsByLevel: Record<SchoolLevel, string[]>;
}

/** 아직 못 읽었을 때 쓰는 빈 선택지 */
export const EMPTY_SOURCE_FACETS: SourceFacets = {
  schools: [], years: [], grades: [], textbooks: [], semesters: [], schoolExams: [],
  schoolsByLevel: { 중등: [], 고등: [] },
};

/**
 * 출처 칸에서 실제로 존재하는 값들을 모은다.
 *
 * 기출 트리의 갈래도 **같은 재료**에서 뽑는다 — 서버가 7칸의 서로 다른 조합을 돌려주므로
 * 아래의 중복 제거(`uniq`·`collectSchoolExams`)가 그대로 맞다.
 * @returns 학교·학년도·학년·교과서·학기 목록과 기출 갈래
 */
export async function fetchSourceFacets(): Promise<SourceFacets> {
  const rows = (await loadArchiveFacets()).sources;
  const uniq = (values: string[]) => [...new Set(values.filter(Boolean))].sort();
  return {
    schools: uniq(rows.map((r) => r.school_name)),
    years: uniq(rows.map((r) => r.year)).reverse(),
    grades: uniq(rows.map((r) => r.grade)),
    textbooks: uniq(rows.map((r) => r.textbook)),
    semesters: uniq(rows.map((r) => r.semester)),
    schoolExams: collectSchoolExams(rows),
    schoolsByLevel: collectSchoolsByLevel(rows),
  };
}

/** 내신기출(학교가 있는 것)·모의고사 행에서 기출 트리 갈래를 중복 없이 모은다 */
function collectSchoolExams(rows: readonly SourceFacetRow[]): SchoolExamFacet[] {
  const seen = new Set<string>();
  const out: SchoolExamFacet[] = [];
  for (const row of rows) {
    const isSchool = row.source_type === SCHOOL_EXAM_SOURCE_TYPE && Boolean(row.school_name);
    if (!isSchool && row.source_type !== MOCK_EXAM_SOURCE_TYPE) continue;
    const facet: SchoolExamFacet = {
      source_type: row.source_type, school_name: row.school_name, year: row.year, grade: row.grade,
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
 * 경로들을 중복 없이 사전순으로 — 필터 선택지를 만든다.
 * @param paths - 서버가 돌려준 서로 다른 경로들
 * @returns 중복 없는 경로 목록 (한글 사전순)
 */
function sortPaths(paths: readonly string[][]): string[][] {
  const seen = new Set<string>();
  const out: string[][] = [];
  for (const path of paths) {
    const key = path.join(' > ');
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(path);
  }
  return out.sort((a, b) => a.join('>').localeCompare(b.join('>'), 'ko'));
}

/** 아카이브에 실제로 있는 작품 하나 */
export interface WorkFacet {
  /** `problems.work_titles` 의 한 원소 (표준 표기) */
  title: string;
  /** 지은이 — 지문에서 가져온다. 모르면 '' */
  author: string;
  /** 이 작품으로 태깅된 문항 수 */
  count: number;
  /** 문학인가 비문학인가 — 지문의 영역(`area_path`)으로 가린다. 모르면 'unknown' */
  kind: WorkKind;
}

/**
 * 아카이브에 쓰인 작품 목록.
 *
 * 개수를 함께 세는 이유: 트리에 '동백꽃 (12)' 로 보여야 어느 작품이 문제 은행에 두툼하게
 * 쌓였는지 한눈에 보인다.
 *
 * ⚠️ **작품명은 문항마다 여러 개다**(`work_titles`, sql/33). `(가)(나)` 지문의 문항은 두 작품
 *    아래에 함께 걸린다 — 파생 문자열(`work_title`)로 세면 `'먼 후일 · 독은 아름답다'` 라는
 *    **가짜 작품 하나**가 트리에 생기고 한 편만 골라서는 그 문항이 안 나온다.
 *
 * 지은이와 갈래(문학/비문학)는 `problems` 에 없다 — 지문(`passages.works`·`area_path`)에서
 * 같은 제목을 찾아 붙인다. 폴더를 지은이로 나누고 문학·비문학으로 가르기 때문이다.
 * 세는 규칙은 `work-counts.ts` 에 있다.
 * @returns 작품 목록 (제목 한글 사전순)
 */
export async function fetchWorkFacets(): Promise<WorkFacet[]> {
  const payload = await loadArchiveFacets();
  const counts = tallyWorkCounts(payload.work_titles);
  if (counts.size === 0) return [];
  // 지문 표는 (제목, 지은이, 영역) 하나씩이라 지은이 표·갈래 표가 같은 행을 함께 쓴다
  const rows: PassageWorkRow[] = payload.passage_works.map((v) => ({
    works: [{ label: '', title: v.title, author: v.author }],
    area_path: v.area_path,
    n: v.n,
  }));
  return toWorkFacets(counts, collectWorkAuthors(rows), collectWorkKinds(rows));
}

/**
 * 아카이브에 쓰인 영역 경로 목록.
 * @returns 중복 없는 경로 목록
 */
export const fetchAreaFacets = async (): Promise<string[][]> =>
  sortPaths((await loadArchiveFacets()).area_paths);

/**
 * 아카이브에 쓰인 교과서 단원 경로 목록.
 * @returns 중복 없는 경로 목록
 */
export const fetchUnitFacets = async (): Promise<string[][]> =>
  sortPaths((await loadArchiveFacets()).unit_paths);

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
 * 세는 규칙(조상 중복 제거)은 `tallyGrammarCounts` 에 있다. 개수를 함께 세는 이유는
 * 작품 패싯과 같다 — 트리에 '명사 (5)' 로 보여야 어디에 기출이 쌓였는지, 어디가
 * 아직 비었는지 한눈에 보인다.
 *
 * ⚠️ 선택지는 이것으로 만들지 **않는다.** 태깅된 경로만 모으므로 아무도 안 붙인 개념은
 *    영영 안 나온다 — 선택지·트리는 마스터(`GRAMMAR_ALL_PATHS`)에서 만들고 여기 건수를
 *    얹는다. 이 함수는 '얼마나 쌓였나' 만 답한다.
 * @returns 경로와 문항 수 (교재 목차 순서, 마스터에 없는 옛 경로는 뒤로)
 */
export async function fetchGrammarFacets(): Promise<GrammarFacet[]> {
  const counts = tallyWeightedGrammarCounts((await loadArchiveFacets()).grammar_paths);
  return expandGrammarAncestors([...counts.keys()])
    .map((path) => ({ path, count: counts.get(path) ?? 0 }));
}
