/**
 * '기출 시험지' 화면 위 탭 — 세트로 보기 ↔ 목록으로 보기 (2026-11-22 원장님 "기출 세트랑 올라간 기출 하나로 버무리").
 *
 * 두 화면은 주소가 따로다(`/problems/sets`·`/problems/sources` — 옛 링크·북마크 그대로). 탭을 오가도 보던 조건이
 * 남게, 각 화면이 주소를 적을 때 그 조건을 기억해 두고 탭 링크가 반대편의 마지막 조건으로 간다.
 * 기억은 그 탭의 `sessionStorage` 다 — 모듈 변수만 두면 새 배포 뒤 자동 새로 고침(`useBuildWatch`, 목록 화면은 허용
 * 목록에 있다)이 반대편 조건을 지운다(코덱스 4R). 저장소를 못 쓰면 모듈 변수로 물러선다. 조건의 정본은 여전히 주소다.
 */

/** 보기 방식 */
export type ExamSheetView = 'sets' | 'sources';

/** 탭 차례와 주소·이름 */
export const EXAM_SHEET_TABS: readonly { view: ExamSheetView; path: string; label: string }[] = [
  { view: 'sets', path: '/problems/sets', label: '세트로 보기' },
  { view: 'sources', path: '/problems/sources', label: '목록으로 보기' },
];

/** sessionStorage 열쇠 */
const STORAGE_KEY = 'ara-exam-sheet-query';

/** 이 페이지 수명 동안의 기억 — 여기서 적었으면 저장소보다 앞선다(저장소 쓰기가 막혀도 마지막 조건을 쓴다, 코덱스 5R) */
const memory: Record<ExamSheetView, string> = { sets: '', sources: '' };
const touched: Record<ExamSheetView, boolean> = { sets: false, sources: false };

/** `?…` 로 시작하는 조건만 받는다 */
const validQuery = (value: unknown): string =>
  (typeof value === 'string' && value.startsWith('?') && value.length > 1 ? value : '');

/** 저장소의 기억 — 못 읽거나 모양이 틀리면 빈 기억 */
function readStore(): Record<ExamSheetView, string> | null {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (raw === null) return { sets: '', sources: '' };
    const parsed: unknown = JSON.parse(raw);
    const obj = parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : {};
    return { sets: validQuery(obj.sets), sources: validQuery(obj.sources) };
  } catch {
    return null;
  }
}

/**
 * 화면이 주소에 적은 조건을 기억한다 — 각 화면의 주소 적기 효과에서 부른다.
 * @param view - 어느 화면
 * @param query - `?…` 로 시작하는 조건 글(없으면 '') — 그 밖의 모양은 버린다
 */
export function rememberExamSheetQuery(view: ExamSheetView, query: string): void {
  const next = validQuery(query);
  memory[view] = next;
  touched[view] = true;
  const stored = readStore();
  if (!stored) return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ ...stored, [view]: next }));
  } catch {
    // 저장소가 막혔으면 모듈 변수만 — 새로 고치면 빈다
  }
}

/**
 * 그 화면의 맨 주소.
 * @param view - 어느 화면
 * @returns '/problems/sets' 같은 주소
 */
export function examSheetPath(view: ExamSheetView): string {
  return EXAM_SHEET_TABS.find((t) => t.view === view)?.path ?? '/problems/sets';
}

/**
 * 탭 링크 주소 — 그 화면의 마지막 조건까지.
 * @param view - 어느 화면
 * @returns '/problems/sets?…' 같은 주소
 */
export function examSheetHref(view: ExamSheetView): string {
  if (touched[view]) return `${examSheetPath(view)}${memory[view]}`;
  const stored = readStore();
  return `${examSheetPath(view)}${stored ? stored[view] : ''}`;
}

/** 테스트용 — 기억을 비운다 */
export function resetExamSheetQueries(): void {
  memory.sets = '';
  memory.sources = '';
  touched.sets = false;
  touched.sources = false;
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // 저장소가 없는 환경
  }
}
