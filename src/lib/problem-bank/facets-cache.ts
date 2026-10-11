import type { ArchiveFacetsPayload } from './facets-payload';

/**
 * 아카이브 패싯 캐시 — 한 탭 안에서 같은 패싯을 몇 번이고 다시 읽지 않게 한다.
 *
 * 아카이브·문제지 조합·올라간 기출·작품 고르기 창이 같은 재료를 쓰는데, 예전에는 화면을 열 때마다
 * (StrictMode 에서는 두 번씩) 문항 표 전체를 다시 긁었다. 이제 한 요청을 나눠 쓰고 몇 분 동안 둔다.
 *
 * ⚠️ 이 파일은 **아무것도 import 하지 않는다**(타입만). 쓰기 함수(`mutations.ts`·`mutations-source.ts`)가
 *    무효화하려고 이것을 부르는데, `facets.ts` 를 부르게 하면 쓰기 모듈이 트리·집계 코드까지 끌고 온다.
 * ⚠️ 앱 밖에서 들어온 변경(적재 스크립트 `ingest-exam.js`, 다른 선생님의 수정)은 알 길이 없어
 *    **유효 시간**으로 따라잡는다. 이 탭에서 고친 것은 쓰기 함수가 그 자리에서 무효화한다.
 */

/** 패싯을 다시 묻지 않고 쓰는 시간 */
export const ARCHIVE_FACETS_TTL_MS = 5 * 60 * 1000;

interface CacheEntry {
  at: number;
  payload: Promise<ArchiveFacetsPayload>;
}

let entry: CacheEntry | null = null;

/**
 * 캐시된 패싯을 돌려주거나, 없거나 오래됐으면 새로 읽는다.
 *
 * ⚠️ **실패한 약속은 남기지 않는다** — 남기면 한 번 실패한 뒤 유효 시간 내내 같은 실패를 돌려준다.
 *    지운 뒤에 다른 요청이 새 항목을 넣었을 수 있으므로 **자기 항목일 때만** 지운다.
 * @param fetcher - 실제로 읽는 함수 (`facets.ts` 의 RPC 호출)
 * @param now - 지금 시각 (테스트용)
 * @returns 패싯 재료
 */
export function cachedArchiveFacets(
  fetcher: () => Promise<ArchiveFacetsPayload>,
  now: number = Date.now(),
): Promise<ArchiveFacetsPayload> {
  if (entry && now - entry.at < ARCHIVE_FACETS_TTL_MS) return entry.payload;
  // 콜백은 나중에(약속이 실패할 때) 돌므로 그때는 payload 가 이미 정해져 있다
  const payload: Promise<ArchiveFacetsPayload> = fetcher().catch((e: unknown) => {
    if (entry?.payload === payload) entry = null;
    throw e;
  });
  entry = { at: now, payload };
  return payload;
}

/**
 * 다음 조회가 새로 읽게 한다 — 문항·지문·출처를 바꾼 직후 부른다.
 *
 * 이미 받아 둔 화면의 트리는 그대로다(다음에 그 화면을 열거나 `reload()` 할 때 바뀐다).
 */
export function invalidateArchiveFacets(): void {
  entry = null;
}
