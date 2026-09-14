/**
 * 묶음(= 프린트 한 장) 초안과 쪽 배정 (순수 함수).
 *
 * 화면(업로드 페이지)에서 떼어 둔 이유: 쪽 배정은 값만 다루는 일인데 화면에 두면
 * supabase 없이는 검증할 수 없다. `problem-bank/source-form.ts` 와 같은 규약이다.
 * 이 초안으로 **무엇을 하는지**(검증·묶음 수·저장 모양)는 [bundle-plan.ts](./bundle-plan.ts) 가 맡는다.
 *
 * ⚠️ **학교·학년도·학년·학기·시험은 여기 없다** — 스캔 하나에 한 번만 고르고
 *    ([scan-meta.ts](./scan-meta.ts)) 저장할 때 묶음마다 복사한다. 프린트마다 묻던 시절의
 *    '앞 묶음에서 물려받기' 도 그래서 사라졌다.
 */

/** 묶음 하나에 딸 수 있는 색 (썸네일 테두리·칩) */
export const BUNDLE_COLORS = [
  'sky', 'emerald', 'amber', 'violet', 'rose', 'teal',
] as const;

export type BundleColor = (typeof BUNDLE_COLORS)[number];

/**
 * 묶음 순서에 따른 색. 묶음이 6개를 넘으면 색이 돈다 —
 * 색은 '어느 묶음인지' 를 돕는 보조 표시일 뿐이고 번호가 본체다(색만으로 정보를 주지 않는다).
 * @param index - 0-based 묶음 순서
 * @returns 색 이름
 */
export function bundleColor(index: number): BundleColor {
  return BUNDLE_COLORS[index % BUNDLE_COLORS.length];
}

/** 화면이 들고 있는 묶음 입력값 (아직 저장 전) */
export interface BundleDraft {
  /** 화면 안에서만 쓰는 임시 id — 저장할 때 진짜 UUID 로 바뀐다 */
  localId: string;
  /**
   * 프린트별 이름. **비울 수 있다** — 저장되는 이름은 `composePrintName` 이
   * 스캔 제목 뒤에 이것을 붙여 만든다(비우면 스캔 제목이 곧 프린트 이름이다).
   */
  name: string;
  includeHandwriting: boolean;
  /** 프린트에 적힌 '단어 — 뜻' 을 단어로도 등록할 것인가 */
  registerWords: boolean;
}

/** 쪽 → 묶음 localId. 없는 쪽은 **건너뛴다**(기출과 달리 기본이 '안 읽음' 이다) */
export type PageAssignment = ReadonlyMap<number, string>;

/**
 * 새 묶음 초안 — 빈 이름에 두 스위치 모두 꺼짐.
 *
 * 물려받을 것이 없다: 학교·학년도·학년은 스캔 단위로 올라갔고(`scan-meta.ts`), 프린트별
 * 이름은 프린트마다 다르다. 손글씨·단어 등록은 켜면 ChatGPT 를 더 쓰는 쪽이라 기본이 꺼짐이다.
 * @param localId - 화면용 임시 id
 * @returns 새 초안
 */
export function newBundleDraft(localId: string): BundleDraft {
  return { localId, name: '', includeHandwriting: false, registerWords: false };
}

/**
 * 쪽 하나를 묶음에 넣거나 뺀다.
 * @param map - 지금 배정
 * @param page - 쪽 번호
 * @param localId - 넣을 묶음. null 이면 뺀다(= 건너뛰는 쪽)
 * @returns 새 배정
 */
export function assignPage(
  map: PageAssignment,
  page: number,
  localId: string | null,
): PageAssignment {
  const next = new Map(map);
  if (localId === null) next.delete(page);
  else next.set(page, localId);
  return next;
}

/**
 * 여러 쪽을 한 묶음에 넣는다 (보이는 창 전체 지정).
 * @param map - 지금 배정
 * @param pages - 쪽 번호들
 * @param localId - 넣을 묶음. null 이면 전부 뺀다
 * @returns 새 배정
 */
export function assignPages(
  map: PageAssignment,
  pages: readonly number[],
  localId: string | null,
): PageAssignment {
  const next = new Map(map);
  for (const page of pages) {
    if (localId === null) next.delete(page);
    else next.set(page, localId);
  }
  return next;
}

/**
 * 묶음이 사라질 때 그 묶음에 배정된 쪽을 전부 푼다.
 * @param map - 지금 배정
 * @param localId - 사라지는 묶음
 * @returns 새 배정
 */
export function unassignBundle(map: PageAssignment, localId: string): PageAssignment {
  const next = new Map(map);
  for (const [page, id] of map) {
    if (id === localId) next.delete(page);
  }
  return next;
}

/**
 * 한 묶음이 덮는 쪽 (오름차순).
 *
 * ⚠️ 반드시 정렬해서 돌려준다 — 이 순서가 곧 **읽는 순서이자 시험지에 실리는 순서**다.
 * @param map - 배정
 * @param localId - 묶음
 * @returns 쪽 번호 오름차순
 */
export function pagesOfBundle(map: PageAssignment, localId: string): number[] {
  const out: number[] = [];
  for (const [page, id] of map) {
    if (id === localId) out.push(page);
  }
  return out.sort((a, b) => a - b);
}

/**
 * 어느 묶음에든 배정된 쪽 (오름차순, 중복 없음). 쪽 이미지를 올릴 대상이다.
 * @param map - 배정
 * @returns 쪽 번호 오름차순
 */
export function assignedPages(map: PageAssignment): number[] {
  return [...map.keys()].sort((a, b) => a - b);
}
