import { supabase } from './supabase';
import { EXTERNAL_LEVEL } from './constants';
import { normalizeCategoryName } from './category-name';
import type { CategoryLevel } from '@/types';
import type { WordEntry } from '@/components/words';

export interface CategoryMatchInput {
  level: CategoryLevel;
  /** 학년도. 외부지문에서만 사용하며 '' 는 미지정 */
  year: string;
  grade: string;
  publisher: string;
  semester: string;
  chapter: string;
  subChapter: string;
  schoolName: string;
}

export interface DuplicateWordsResult {
  inBatch: string[];
  existing: string[];
}

export interface InsertWordsResult {
  ok: boolean;
  insertedCount: number;
  skippedDuplicates: string[];
  errorCode?: string;
}

interface InsertWordsRpcRow {
  inserted_count: number;
  skipped_duplicates: string[] | null;
}

/**
 * categories 자연키 유니크 인덱스(idx_categories_natural_key)와 일치하는 충돌 컬럼.
 * ⚠️ sql/15_migration_external_year_grade.sql 의 인덱스 컬럼 목록과 **글자 그대로**
 * 일치해야 한다. 어긋나면 upsert 가 실패해 단어 저장이 전부 막힌다.
 */
const CATEGORY_NATURAL_KEY =
  'level,year,grade,publisher,semester,chapter,sub_chapter,school_name';

/**
 * 입력된 카테고리 메타데이터로 단원을 보장한다(있으면 재사용, 없으면 생성).
 * SELECT→INSERT 분리 구조는 동시 저장 시 중복 row 를 만들 수 있어, 자연키
 * 유니크 인덱스 기반 단일 upsert(ON CONFLICT)로 원자적으로 처리한다.
 * (사전 조건: sql/09_migration_categories_unique.sql 적용)
 * @returns 카테고리 ID, 실패 시 null
 */
export async function ensureCategoryId(input: CategoryMatchInput): Promise<string | null> {
  const isExternal = input.level === EXTERNAL_LEVEL;
  // user_id 는 categories 의 BEFORE INSERT 트리거가 auth.uid() 로 채운다.
  // 매칭에도 user_id 를 빼서 학원 내 모든 사용자가 같은 단원을 공유하도록 한다.
  const row = {
    level: input.level,
    // 년도는 외부지문 전용, 학교명도 마찬가지. 반대로 출판사/학기는 중등·고등 전용이다.
    // 학년(grade)은 이제 양쪽 모두 저장한다 — 예전엔 외부지문을 '' 로 강제해
    // levelGradeToDivision 이 항상 null 을 반환했고, ara-system 이 외부지문을
    // 전부 중등부로 등록하는 부작용이 있었다.
    year: isExternal ? input.year : '',
    grade: input.grade,
    // 이름 필드는 표준 표기로 정규화해 저장한다. 자연키 유니크 인덱스는 바이트 비교라
    // `천재(정호웅)` 과 `천재 (정호웅)` 을 다른 단원으로 보고 둘 다 만들어 버린다.
    // (level/grade/semester/year 는 Select 고정값이라 정규화 대상이 아니다.)
    publisher: isExternal ? '' : normalizeCategoryName(input.publisher),
    semester: isExternal ? '' : input.semester,
    chapter: normalizeCategoryName(input.chapter),
    sub_chapter: normalizeCategoryName(input.subChapter),
    school_name: isExternal ? normalizeCategoryName(input.schoolName) : '',
  };

  const { data: upserted, error: upsertErr } = await supabase
    .from('categories')
    .upsert(row, { onConflict: CATEGORY_NATURAL_KEY })
    .select('id')
    .single();

  if (upsertErr || !upserted) return null;
  return upserted.id;
}

/**
 * 업로드할 단어들에 대해 중복을 찾는다.
 * - 배치 내부에서 같은 이름이 2번 이상 등장한 단어
 * - 선택된 단원에 이미 저장된 단어와 이름이 겹치는 단어
 * @returns 중복 결과, 조회 에러 시 null
 */
export async function findDuplicateWords(
  categoryId: string,
  validWords: WordEntry[],
): Promise<DuplicateWordsResult | null> {
  const seen = new Set<string>();
  const batchDupes = new Set<string>();
  for (const w of validWords) {
    const name = w.word.trim();
    if (seen.has(name)) batchDupes.add(name);
    else seen.add(name);
  }

  const { data, error } = await supabase
    .from('words')
    .select('word')
    .eq('category_id', categoryId);

  if (error) return null;

  const existingSet = new Set((data ?? []).map((w) => w.word));
  const existingDupes = new Set<string>();
  for (const w of validWords) {
    const name = w.word.trim();
    if (existingSet.has(name)) existingDupes.add(name);
  }

  return {
    inBatch: [...batchDupes],
    existing: [...existingDupes],
  };
}

/**
 * 중복 단어(배치 내부 중복 + 기존 단어와 겹치는 단어)를 제거한 새 배열을 반환한다.
 * 배치 내부 중복은 첫 번째 등장만 남긴다.
 */
export function removeDuplicateWords(
  validWords: WordEntry[],
  existingDuplicates: string[],
): WordEntry[] {
  const existingSet = new Set(existingDuplicates);
  const seen = new Set<string>();
  const result: WordEntry[] = [];
  for (const w of validWords) {
    const name = w.word.trim();
    if (existingSet.has(name)) continue;
    if (seen.has(name)) continue;
    seen.add(name);
    result.push(w);
  }
  return result;
}

/**
 * 단어 목록을 지정된 단원에 저장한다. DB 함수 `insert_words_batch` 를 호출해
 * 카테고리 단위 advisory lock 안에서 순번을 부여하고 UNIQUE 제약으로 중복을
 * 방어한다. 프리체크 이후 다른 사용자가 먼저 추가한 단어는 자동 스킵되며
 * `skippedDuplicates` 로 반환된다.
 * @returns 저장 결과 (성공 여부, 삽입/스킵 건수, 에러 코드)
 */
export async function insertWordsToCategory(
  categoryId: string,
  validWords: WordEntry[],
): Promise<InsertWordsResult> {
  const payload = validWords.map((w) => ({
    word: w.word.trim(),
    meaning: w.meaning.trim(),
  }));

  const { data, error } = await supabase.rpc('insert_words_batch', {
    p_category_id: categoryId,
    p_words: payload,
  });

  if (error) {
    return {
      ok: false,
      insertedCount: 0,
      skippedDuplicates: [],
      errorCode: error.code,
    };
  }

  const rows = (data ?? []) as InsertWordsRpcRow[];
  const row = rows[0];
  return {
    ok: true,
    insertedCount: row?.inserted_count ?? 0,
    skippedDuplicates: row?.skipped_duplicates ?? [],
  };
}
