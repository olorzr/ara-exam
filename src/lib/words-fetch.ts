import { supabase } from './supabase';
import type { Word } from '@/types';

/** PostgREST 한 번에 받아올 행 수. 기본 상한이 1,000이라 그보다 크게 잡아도 소용없다. */
const WORDS_CHUNK = 1000;

/**
 * 한 시험이 담을 수 있는 단어 수의 상한.
 *
 * ⚠️ **올리려면 아래 넷을 함께 고쳐야 한다**(코덱스 리뷰 P1) — 지금은 전부 1,000 에 묶여 있다:
 *   1. `exam/view` 의 `exam_words` 조회(페이지 없음)
 *   2. `sync-to-grades` 의 `exam_words` 조회(페이지 없음)
 *   3. ara-system 인테이크의 `totalQuestions는 1~1000` 검증
 *   4. 여기
 * 하나만 올리면 1,001개짜리 시험이 **만들어지기는 하는데** 인쇄물은 앞 1,000개만 나오고
 * 성적 등록은 거절돼, 선생님은 그 사실을 시험 날에야 안다.
 */
export const MAX_EXAM_WORDS = 1000;

export interface WordsPage {
  words: Word[];
  /**
   * 고른 카테고리의 단어가 상한을 **넘는다**. 이 경우 `words` 는 앞 `MAX_EXAM_WORDS` 개뿐이고,
   * 호출부는 **시험을 만들지 못하게 막아야 한다** — 잘린 채로 만들면 조용히 깨진다.
   */
  overLimit: boolean;
}

/**
 * 선택한 카테고리들의 단어를 **전부** 읽는다.
 *
 * ⚠️ `.range()` 없이 한 번에 청하면 PostgREST 기본 상한(1,000행)에서 **조용히 잘린다** —
 *   단어가 1,000개를 넘는 카테고리 조합은 시험이 잘린 채로 만들어지고 화면에는 아무 표시가 없다.
 *
 * ⚠️ 정렬에 `id` 를 **반드시** 붙인다. 카테고리마다 `order_index` 가 0,1,2… 로 다시 시작해
 *   여러 카테고리를 고르면 동률이 무더기로 생기는데, 동률의 순서는 정해져 있지 않아
 *   쪽을 나눠 받으면 **같은 행이 두 번 오거나 아예 안 온다**. `id` 가 총순서를 만들어 준다.
 *
 * @throws 조회에 실패하면 던진다 — 빈 목록으로 물러서면 "카테고리에 단어가 없다" 로 잘못 읽힌다.
 */
export async function fetchWordsByCategories(categoryIds: string[]): Promise<WordsPage> {
  if (categoryIds.length === 0) return { words: [], overLimit: false };

  const words: Word[] = [];
  // 상한 + 1 까지 받아 본다 — 한 개만 더 있어도 '넘쳤다' 를 확실히 알 수 있다.
  for (let from = 0; from <= MAX_EXAM_WORDS; from += WORDS_CHUNK) {
    const { data, error } = await supabase
      .from('words')
      .select('*')
      .in('category_id', categoryIds)
      .order('order_index')
      .order('id')
      .range(from, from + WORDS_CHUNK - 1);
    if (error) throw error;

    const page = (data ?? []) as Word[];
    words.push(...page);
    if (page.length < WORDS_CHUNK) break;
  }

  if (words.length > MAX_EXAM_WORDS) {
    return { words: words.slice(0, MAX_EXAM_WORDS), overLimit: true };
  }
  return { words, overLimit: false };
}
