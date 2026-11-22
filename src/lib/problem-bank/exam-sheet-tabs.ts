/**
 * '기출 시험지' 화면 위 탭 — 세트로 보기 ↔ 목록으로 보기 (2026-11-22 원장님 "기출 세트랑 올라간 기출 하나로 버무리").
 *
 * 두 화면은 주소가 따로다(`/problems/sets`·`/problems/sources` — 옛 링크·북마크 그대로). 탭을 오가도 보던 조건이
 * 남게, 각 화면이 주소를 적을 때 그 조건을 여기 모듈 변수에 적어 두고 탭 링크가 반대편의 마지막 조건으로 간다.
 * 새로 고치면 비어 있다(저장소에 두지 않는다 — 조건은 주소가 정본이다).
 */

/** 보기 방식 */
export type ExamSheetView = 'sets' | 'sources';

/** 탭 차례와 주소·이름 */
export const EXAM_SHEET_TABS: readonly { view: ExamSheetView; path: string; label: string }[] = [
  { view: 'sets', path: '/problems/sets', label: '세트로 보기' },
  { view: 'sources', path: '/problems/sources', label: '목록으로 보기' },
];

/** 화면마다 마지막으로 적은 조건(`?…` 또는 '') */
const lastQuery: Record<ExamSheetView, string> = { sets: '', sources: '' };

/**
 * 화면이 주소에 적은 조건을 기억한다 — 각 화면의 주소 적기 효과에서 부른다.
 * @param view - 어느 화면
 * @param query - `?…` 로 시작하는 조건 글(없으면 '') — 그 밖의 모양은 버린다
 */
export function rememberExamSheetQuery(view: ExamSheetView, query: string): void {
  lastQuery[view] = query.startsWith('?') && query.length > 1 ? query : '';
}

/**
 * 탭 링크 주소 — 그 화면의 마지막 조건까지.
 * @param view - 어느 화면
 * @returns '/problems/sets?…' 같은 주소
 */
export function examSheetHref(view: ExamSheetView): string {
  const tab = EXAM_SHEET_TABS.find((t) => t.view === view);
  return `${tab?.path ?? '/problems/sets'}${lastQuery[view]}`;
}

/** 테스트용 — 기억을 비운다 */
export function resetExamSheetQueries(): void {
  lastQuery.sets = '';
  lastQuery.sources = '';
}
