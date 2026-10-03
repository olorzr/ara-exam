import { supabase } from '@/lib/supabase';
import type { ReferenceUnit } from '@/types/reference-text';
import { REFERENCE_FACET_CHUNK, REFERENCE_FACET_MAX_ROWS } from './constants';
import { isReferenceUnit } from './units';

/**
 * 작품 전문 왼쪽 패널의 재료 — 모든 전문의 **분류 칸만** 읽는다.
 *
 * 세 트리(교과서 · 단원 / 작품 / 문법)가 이 한 번의 조회에서 나온다. 본문은 읽지 않는다
 * (전문 한 편이 수만 자다). 목록 조회와 따로 두는 까닭: 목록은 축·검색어로 걸러지고
 * 상한(200)에서 잘리지만, 트리는 **언제나 전체**를 보여 줘야 고를 수 있다.
 */

/** 트리를 만드는 데 필요한 칸 */
export interface ReferenceFacetRow {
  id: string;
  title: string;
  author: string;
  units: ReferenceUnit[];
  grammar_paths: string[];
}

/**
 * 읽어 온 한 줄을 좁힌다 — JSON 칸이라 `as` 대신 런타임에 확인한다.
 * @param raw - PostgREST 가 준 한 줄
 * @returns 트리 재료 한 줄. id 가 없으면 null
 */
function toFacetRow(raw: Record<string, unknown>): ReferenceFacetRow | null {
  if (typeof raw.id !== 'string') return null;
  return {
    id: raw.id,
    title: typeof raw.title === 'string' ? raw.title : '',
    author: typeof raw.author === 'string' ? raw.author : '',
    units: Array.isArray(raw.units) ? raw.units.filter(isReferenceUnit) : [],
    grammar_paths: Array.isArray(raw.grammar_paths)
      ? raw.grammar_paths.filter((p): p is string => typeof p === 'string')
      : [],
  };
}

/**
 * 모든 전문의 분류 칸.
 *
 * ⚠️ 1,000줄씩 끝까지 읽는다 — PostgREST 기본 상한에서 말없이 잘리면 트리에서 작품이
 *    조용히 사라진다(문제 은행 `facets.ts` 와 같은 규약).
 * ⚠️ 중간에 실패하면 **여기까지 모은 것만** 돌려준다 — 트리가 덜 차도 목록은 봐야 한다.
 *    **첫 쪽부터** 실패하면 던진다: 빈 목록을 돌려주면 '전문이 하나도 없다' 와 구별이 안 돼,
 *    다시 읽다 실패한 순간 멀쩡하던 트리가 통째로 비어 버린다(훅이 잡아 이전 트리를 남긴다).
 * @returns 전문별 분류 칸
 * @throws 첫 쪽부터 읽지 못했을 때
 */
export async function fetchReferenceTextFacets(): Promise<ReferenceFacetRow[]> {
  const rows: ReferenceFacetRow[] = [];
  for (let from = 0; from < REFERENCE_FACET_MAX_ROWS; from += REFERENCE_FACET_CHUNK) {
    const { data, error } = await supabase
      .from('reference_texts')
      .select('id,title,author,units,grammar_paths')
      .order('id')
      .range(from, from + REFERENCE_FACET_CHUNK - 1);
    if (error) {
      if (from === 0) throw error;
      break;
    }
    const page: Record<string, unknown>[] = data ?? [];
    for (const raw of page) {
      const row = toFacetRow(raw);
      if (row) rows.push(row);
    }
    if (page.length < REFERENCE_FACET_CHUNK) break;
  }
  return rows;
}
