/**
 * '기출 시험지' 화면 위 탭 — 세트로 보기 ↔ 목록으로 보기 (2026-11-22 원장님 "기출 세트랑 올라간 기출 하나로 버무리").
 *
 * 두 화면은 주소가 따로다(`/problems/sets`·`/problems/sources` — 옛 링크·북마크 그대로). 탭은 반대편 화면의 **맨 주소**로 간다.
 * ⚠️ '반대편에서 보던 조건 이어 가기' 는 일부러 걷었다(코덱스 4~12R). 모듈 변수·sessionStorage 로 기억해 봤는데 자동 새로 고침,
 *    저장소 쓰기 실패, 뒤로 가기로 되살아난 옛 페이지(bfcache)가 라운드마다 옛 조건을 되살리거나 새 조건을 덮었다. 예전 두 메뉴도
 *    누르면 맨 주소였다 — 되살리려면 조건을 주소 하나(예: 한 화면 `?view=`)에 담는 쪽부터.
 */

/** 보기 방식 */
export type ExamSheetView = 'sets' | 'sources';

/** 탭 차례와 주소·이름 */
export const EXAM_SHEET_TABS: readonly { view: ExamSheetView; path: string; label: string }[] = [
  { view: 'sets', path: '/problems/sets', label: '세트로 보기' },
  { view: 'sources', path: '/problems/sources', label: '목록으로 보기' },
];
