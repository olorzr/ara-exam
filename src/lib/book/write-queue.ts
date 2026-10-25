/**
 * 책 쓰기 줄 — **책 한 권마다** 모듈에 하나씩 둔다(화면·훅 인스턴스와 무관).
 *
 * 2026-10-26 책 화면이 표지 만들기(`/books/covers/[id]`)와 내지 만들기(`/books/inner/[id]`) 두 경로로 갈리면서 같은 책을
 * 서로 다른 `useBook` 인스턴스가 연다. 줄을 인스턴스 안(ref)에 두면, 설정 저장이 도는 사이 다른 화면으로 넘어갔을 때
 * 새 화면이 **저장 전 행**을 읽고, 그 옛 설정 jsonb 를 통째로 보내 방금 저장한 값을 되돌린다(코덱스 1R). 그래서
 * ① 쓰기는 이 줄에 서서 보낸 차례대로 DB 에 닿고 ② 책을 새로 읽는 화면은 그 책의 줄이 빌 때까지 기다린 뒤 읽는다.
 *
 * 줄은 둘이다 — 책 칸(제목·설정·표지·쪽 수·다 만든 표시)과 장 바꾸기. 따로 돌아 서로를 기다리지 않는다(예전과 같다).
 */

/** 줄 종류 */
export type BookWriteLane = 'fields' | 'chapters';

/** 책 id·줄 → 줄 끝(결코 거절되지 않는 약속) */
const tails = new Map<string, Promise<void>>();

const laneKey = (bookId: string, lane: BookWriteLane) => `${lane}:${bookId}`;

/**
 * 그 책의 줄 끝에 일을 세운다 — 앞선 일이 끝나야(성공이든 실패든) 시작한다.
 * @param bookId - 책 id
 * @param lane - 줄
 * @param work - 할 일
 * @returns 그 일의 결과(실패하면 거절 — 줄은 실패와 무관하게 이어진다)
 */
export function enqueueBookWrite<T>(bookId: string, lane: BookWriteLane, work: () => Promise<T>): Promise<T> {
  const key = laneKey(bookId, lane);
  const run = (tails.get(key) ?? Promise.resolve()).then(work);
  const tail = run.then(() => undefined, () => undefined);
  tails.set(key, tail);
  void tail.then(() => { if (tails.get(key) === tail) tails.delete(key); });
  return run;
}

/**
 * 그 책의 두 줄이 지금 세워진 일까지 다 끝나기를 기다린다 — 책을 읽기 전에 부른다.
 * @param bookId - 책 id
 * @returns 끝나면 풀리는 약속(거절되지 않는다)
 */
export function bookWritesSettled(bookId: string): Promise<void> {
  const pending = (['fields', 'chapters'] as const).map((lane) => tails.get(laneKey(bookId, lane)) ?? Promise.resolve());
  return Promise.all(pending).then(() => undefined);
}

/**
 * 모든 책의 줄이 지금 세워진 일까지 다 끝나기를 기다린다 — 책 **목록**을 읽기 전에 부른다. 다 만든 표시를 누르자마자 다른
 * 목록(다 만든 책 ↔ 만드는 중)으로 넘어가면 그 목록이 저장 전 상태를 읽어, 저장이 끝난 뒤에도 그 책이 빠지거나 남는다(코덱스 2R).
 * @returns 끝나면 풀리는 약속(거절되지 않는다)
 */
export function allBookWritesSettled(): Promise<void> {
  return Promise.all([...tails.values()]).then(() => undefined);
}
