import { supabase } from '@/lib/supabase';
import { escapeIlike } from '@/lib/problem-bank/queries';
import { searchPassages } from '@/lib/problem-bank/passage-search';
import { fetchRecentReferenceTexts, searchReferenceTexts } from '@/lib/reference-texts/queries';
import { REFERENCE_TEXT_PICK_LIMIT } from '@/lib/reference-texts/constants';
import { QUIZ_REFERENCE_CANDIDATE_LIMIT } from './constants';
import { passageHits, textHits } from './candidates';
import { sheetKind, sheetLabel, sheetSubtitle, type SheetLabelRow } from './labels';
import type { QuizReferenceKind, ReferenceCandidate } from './types';

/**
 * **직접 고르기** 창의 조회 (자동 매칭과 다른 길).
 *
 * 자동 매칭은 신호가 있어야 도는데, 선생님이 알고 있는 자료를 그냥 붙이고 싶을 때가 있다
 * (제목이 안 맞거나, 옛 표기로 저장돼 자동으로 안 걸리는 자료). 그 길이 여기다.
 *
 * ⚠️ 여기서도 `.or()` 를 쓰지 않는다 — 칸마다 따로 물어 id 로 합친다
 *    (`PassagePickerDialog` 와 같은 규약).
 */

/** 개념지 목록 컬럼. ⚠️ 한 줄로 둘 것 */
const SHEET_COLUMNS = 'id,title,year,grade,publisher,unit,subunit,school_name,print_bundle_id,updated_at';

type SheetRow = SheetLabelRow & { id: string; updated_at: string };

/**
 * 개념지 행 하나를 고르기 줄로.
 * @param row - 개념지 행
 * @returns 후보
 */
function toSheetCandidate(row: SheetRow): ReferenceCandidate {
  return {
    key: `${sheetKind(row)}:${row.id}`,
    kind: sheetKind(row),
    id: row.id,
    label: sheetLabel(row),
    subtitle: sheetSubtitle(row),
    updatedAt: row.updated_at,
  };
}

/**
 * 개념지·프린트를 찾는다. 둘은 한 표에 살고 `print_bundle_id` 로만 갈린다.
 * @param kind - 'sheet'(개념지) 또는 'print'(학교 프린트)
 * @param term - 검색어 (빈 값이면 최근 것)
 * @param limit - 최대 줄 수
 * @returns 후보 목록
 */
async function searchSheets(
  kind: 'sheet' | 'print', term: string, limit: number,
): Promise<ReferenceCandidate[]> {
  const base = () => {
    const query = supabase
      .from('concept_sheets')
      .select(SHEET_COLUMNS)
      .order('updated_at', { ascending: false })
      .limit(limit);
    return kind === 'print'
      ? query.not('print_bundle_id', 'is', null)
      : query.is('print_bundle_id', null);
  };

  const keyword = term.trim();
  if (keyword === '') {
    const { data, error } = await base();
    if (error) throw error;
    return ((data ?? []) as SheetRow[]).map(toSheetCandidate);
  }

  const pattern = `%${escapeIlike(keyword)}%`;
  // 제목이 맞은 것을 앞에 둔다 — 단원 이름으로 찾는 일은 그다음이다
  const [byTitle, byUnit] = await Promise.all([
    base().ilike('title', pattern),
    base().ilike('unit', pattern),
  ]);
  if (byTitle.error) throw byTitle.error;
  if (byUnit.error) throw byUnit.error;

  const merged = new Map<string, ReferenceCandidate>();
  for (const row of [...(byTitle.data ?? []), ...(byUnit.data ?? [])] as SheetRow[]) {
    const candidate = toSheetCandidate(row);
    if (!merged.has(candidate.key)) merged.set(candidate.key, candidate);
  }
  return [...merged.values()].slice(0, limit);
}

/**
 * 종류를 골라 자료를 찾는다 (직접 고르기 창).
 * @param kind - 자료 종류
 * @param term - 검색어 (빈 값이면 최근 것)
 * @param limit - 최대 줄 수
 * @returns 후보 목록
 * @throws 조회 실패 시
 */
export async function searchReferenceCandidates(
  kind: QuizReferenceKind,
  term: string,
  limit: number = QUIZ_REFERENCE_CANDIDATE_LIMIT,
): Promise<ReferenceCandidate[]> {
  if (kind === 'sheet' || kind === 'print') return searchSheets(kind, term, limit);

  if (kind === 'passage') {
    const rows = await searchPassages(term, limit);
    return passageHits(rows, '').map((entry) => entry.candidate);
  }

  const keyword = term.trim();
  if (keyword === '') {
    const rows = await fetchRecentReferenceTexts(Math.min(limit, REFERENCE_TEXT_PICK_LIMIT));
    return textHits(rows, 'title', '').map((entry) => entry.candidate);
  }

  const [byTitle, byAuthor] = await Promise.all([
    searchReferenceTexts(keyword, 'title', limit),
    searchReferenceTexts(keyword, 'author', limit),
  ]);
  const merged = new Map<string, ReferenceCandidate>();
  for (const entry of textHits([...byTitle, ...byAuthor], 'title', '')) {
    if (!merged.has(entry.candidate.key)) merged.set(entry.candidate.key, entry.candidate);
  }
  return [...merged.values()].slice(0, limit);
}
