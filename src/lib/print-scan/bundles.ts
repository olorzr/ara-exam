import { UNSPECIFIED_OPTION } from '@/lib/external-category';

/**
 * 묶음(= 프린트 한 장) 초안과 쪽 배정 (순수 함수).
 *
 * 화면(업로드 페이지)에서 떼어 둔 이유: 쪽 배정은 값만 다루는 일인데 화면에 두면
 * supabase 없이는 검증할 수 없다. `problem-bank/source-form.ts` 와 같은 규약이다.
 * 이 초안으로 **무엇을 하는지**(검증·묶음 수·저장 모양)는 [bundle-plan.ts](./bundle-plan.ts) 가 맡는다.
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
  /** 프린트명 */
  name: string;
  /** 고른 학교 마스터 id ('' 면 아직 안 고름) */
  schoolId: string;
  schoolName: string;
  /** 학년도 **표시값** ('미지정' 일 수 있다) */
  year: string;
  /** 학년 **표시값** ('미지정' 일 수 있다) */
  grade: string;
  includeHandwriting: boolean;
}

/** 쪽 → 묶음 localId. 없는 쪽은 **건너뛴다**(기출과 달리 기본이 '안 읽음' 이다) */
export type PageAssignment = ReadonlyMap<number, string>;

/**
 * 새 묶음 초안.
 *
 * 앞 묶음의 **학교·년도·학년을 물려받는다** — 한 번에 가져온 프린트는 대개 같은 학교
 * 같은 학년 것이라 매번 다시 고르게 하면 같은 값을 대여섯 번 입력하게 된다.
 * 프린트명과 손글씨 여부는 물려받지 않는다(프린트마다 다르고, 손글씨는 기본 꺼짐이 안전하다).
 *
 * @param localId - 화면용 임시 id
 * @param previous - 바로 앞 묶음 (없으면 null)
 * @param defaultYear - 앞 묶음이 없을 때 쓸 학년도 표시값
 * @returns 새 초안
 */
export function newBundleDraft(
  localId: string,
  previous: BundleDraft | null,
  defaultYear: string,
): BundleDraft {
  return {
    localId,
    name: '',
    schoolId: previous?.schoolId ?? '',
    schoolName: previous?.schoolName ?? '',
    year: previous?.year ?? defaultYear,
    grade: previous?.grade ?? UNSPECIFIED_OPTION,
    includeHandwriting: false,
  };
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
