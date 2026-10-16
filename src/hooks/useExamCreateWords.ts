'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { fetchWordsByCategories, MAX_EXAM_WORDS } from '@/lib/words-fetch';
import type { Word } from '@/types';

/**
 * 다 읽은 단어 — **어느 선택으로 읽은 것인가**와 한 덩어리다(2026-10-15 리뷰 3번).
 *
 * ⚠️ 예전에는 `words`·`overLimit` 를 따로 두고 선택을 바꿔도 옛 값이 남아, 새 선택을 읽는 동안
 *    '시험지 생성' 을 누르면 **고른 카테고리와 실제 출제 단어가 어긋났다**(B 를 더했는데 A 단어만,
 *    A 를 뺐는데 A 단어가 출제). 서버(`create_exam_with_words`)는 카테고리를 단어에서 다시 계산할
 *    뿐 사람의 최신 선택을 되살려 주지 않는다. 그래서 결과를 선택 열쇠에 묶고, 지금 선택과 같은
 *    열쇠의 성공 결과가 있을 때만 생성할 수 있다. 늦게 온 옛 성공·실패는 효과 정리가 버린다.
 */
interface FetchedWords {
  /** 정렬한 카테고리 id 를 `|` 로 이은 선택 열쇠 */
  key: string;
  words: Word[];
  overLimit: boolean;
}

/** 지금 선택의 결과가 없을 때 내주는 목록 — 렌더마다 새 배열을 만들지 않는다 */
const NO_WORDS: Word[] = [];

/**
 * 선택 → 순서와 무관한 열쇠.
 * @param ids - 고른 카테고리 id
 * @returns `'a|b'` (없으면 `''`)
 */
function selectionKeyOf(ids: readonly string[]): string {
  return [...new Set(ids)].sort().join('|');
}

/**
 * 단어 시험지 생성 화면이 고른 카테고리의 단어를 읽는다.
 * @param selectedCatIds - 지금 고른 카테고리 id (순서 무관)
 * @returns 지금 선택의 결과(`current`, 없으면 null)와 파생 값·다시 시도
 */
export function useExamCreateWords(selectedCatIds: readonly string[]) {
  const [fetched, setFetched] = useState<FetchedWords | null>(null);
  /** 실패한 조회의 선택 열쇠 — 지금 열쇠와 같을 때만 '실패' 다 */
  const [failedKey, setFailedKey] = useState<string | null>(null);
  /** '다시 시도' 세대 */
  const [attempt, setAttempt] = useState(0);

  const selectionKey = useMemo(() => selectionKeyOf(selectedCatIds), [selectedCatIds]);
  /** 지금 선택의 성공 결과 — 빈 선택이면 늘 null(즉시 무효) */
  const current = selectionKey !== '' && fetched?.key === selectionKey ? fetched : null;
  const wordsFailed = selectionKey !== '' && !current && failedKey === selectionKey;
  const wordsLoading = selectionKey !== '' && !current && !wordsFailed;
  const words = current?.words ?? NO_WORDS;
  // 고른 카테고리의 단어가 상한을 넘었다 — 잘린 채로 만들면 인쇄물과 성적이 조용히 어긋난다.
  // ⚠️ 상한 판정도 **그 선택의 결과**에서 나온다 — 늦게 온 옛 판정이 새 선택을 막거나 풀면 안 된다
  const overLimit = current?.overLimit ?? false;

  useEffect(() => {
    if (!selectionKey) return undefined;
    // ⚠️ 선택이 또 바뀌면(정리) 이 조회의 성공·실패를 **둘 다** 버린다
    let alive = true;
    // ⚠️ 여기서 `.range()` 없이 한 번에 청하면 1,000행에서 조용히 잘린다(fetchWordsByCategories 주석).
    fetchWordsByCategories(selectionKey.split('|'))
      .then(({ words: rows, overLimit: over }) => {
        if (!alive) return;
        setFetched({ key: selectionKey, words: rows, overLimit: over });
        if (over) {
          toast.error(`단어가 ${MAX_EXAM_WORDS}개를 넘어 시험을 만들 수 없어요. 카테고리를 나눠서 만들어주세요`);
        }
      })
      .catch(() => {
        if (!alive) return;
        // 빈 목록으로 두면 '이 카테고리에 단어가 없다' 로 잘못 읽힌다 — 실패를 밝힌다.
        setFailedKey(selectionKey);
        toast.error('단어를 불러오지 못했어요. 잠시 후 다시 시도해주세요');
      });
    return () => {
      alive = false;
      // 이 선택을 떠나면 그 결과·실패를 **둘 다** 접는다(코덱스 1R). 결과를 남겨 두면 같은 선택으로
      // 돌아왔을 때 옛 결과가 곧바로 '지금 선택의 결과' 가 되고, 그때 다시 읽기가 실패해도 옛 단어로
      // 만들 수 있다(그 사이 더한 단어가 빠진다). 실패를 남겨 두면 다시 읽는 동안 옛 실패가 뜬다
      setFetched((prev) => (prev?.key === selectionKey ? null : prev));
      setFailedKey((key) => (key === selectionKey ? null : key));
    };
  }, [selectionKey, attempt]);


  /** 실패한 단어 조회를 다시 묻는다 */
  const retryWords = useCallback(() => setAttempt((n) => n + 1), []);

  return { current, words, overLimit, wordsLoading, wordsFailed, selectionKey, retryWords };
}
