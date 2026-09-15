import { supabase } from '@/lib/supabase';
import { PASSAGE_PICK_LIMIT } from '@/lib/passage-quiz/constants';
import type { Passage } from '@/types/problem-bank';
import { escapeIlike } from './queries';
import type { SourceLabelInput } from './source-label';

/**
 * 아카이브에 쌓인 **지문 고르기** 조회.
 *
 * ⚠️ 목록에서 `html` 을 읽지 않는다 — 지문 본문은 무거워 서른 줄만 받아도 응답이 커진다.
 *    고른 뒤에 `fetchPassagesByIds` 로 그 하나만 넓게 읽는다(`detail-queries.ts` 와 같은 규약).
 * ⚠️ `.or()` 를 쓰지 않는다 — 백슬래시·괄호 이스케이프가 인용을 통과하며 풀린다
 *    (`queries.ts` 의 검색과 같은 이유). 제목·지은이를 따로 물어 합친다.
 */

/** 고르기 목록의 한 줄 */
export interface PassagePickRow {
  id: string;
  label: string;
  title: string;
  author: string;
  page_no: number;
  source: SourceLabelInput;
}

const COLUMNS = 'id, label, title, author, page_no, '
  + 'source:problem_sources!inner(source_type, title, school_name, year, grade, exam_type, publisher)';

/** 글로 인쇄하는 지문만 — 이미지 지문은 평문으로 옮길 수 없다 */
function baseQuery(limit: number) {
  return supabase
    .from('passages')
    .select(COLUMNS)
    .eq('render_mode', 'text')
    .neq('html', '')
    .order('created_at', { ascending: false })
    .order('id')
    .limit(limit);
}

/**
 * 지문을 찾는다. 검색어가 없으면 최근에 올린 것부터 보여 준다.
 * @param term - 작품명·지은이 검색어 (빈 값이면 최근 목록)
 * @param limit - 최대 줄 수
 * @returns 고르기 목록 (없으면 빈 배열)
 */
export async function searchPassages(
  term: string,
  limit: number = PASSAGE_PICK_LIMIT,
): Promise<PassagePickRow[]> {
  const keyword = term.trim();
  if (keyword === '') {
    const { data, error } = await baseQuery(limit);
    if (error) throw error;
    return (data ?? []) as unknown as PassagePickRow[];
  }

  const pattern = `%${escapeIlike(keyword)}%`;
  const [byTitle, byAuthor] = await Promise.all([
    baseQuery(limit).ilike('title', pattern),
    baseQuery(limit).ilike('author', pattern),
  ]);
  if (byTitle.error) throw byTitle.error;
  if (byAuthor.error) throw byAuthor.error;

  // 제목이 맞은 것을 앞에 둔다 — 작품명으로 찾는 일이 대부분이다
  const merged = new Map<string, PassagePickRow>();
  for (const row of [...(byTitle.data ?? []), ...(byAuthor.data ?? [])]) {
    const pick = row as unknown as PassagePickRow;
    if (!merged.has(pick.id)) merged.set(pick.id, pick);
  }
  return [...merged.values()].slice(0, limit);
}

/**
 * 고른 지문의 표시 이름. 제목이 없는 지문도 무엇인지 알아볼 수 있어야 한다.
 * @param row - 지문 줄 (또는 지문 원본)
 * @returns 화면에 쓸 이름
 */
export function passagePickName(row: Pick<Passage, 'title' | 'label'>): string {
  return row.title.trim() || row.label.trim() || '제목 없는 지문';
}
