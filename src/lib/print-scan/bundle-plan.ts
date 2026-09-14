import type { BuilderCategory } from '@/components/exam-builder';
import { normalizeCategoryName } from '@/lib/category-name';
import { EXTERNAL_LEVEL } from '@/lib/constants';
import { toStoredValue } from '@/lib/external-category';
import { planPageBatches, type PageBatch } from '@/lib/problem-ocr/batch-plan';
import { PRINT_BATCH_OVERLAP, PRINT_PAGES_PER_BATCH } from './constants';
import { pagesOfBundle, type BundleDraft, type PageAssignment } from './bundles';

/**
 * 묶음 초안으로 **무엇을 할 수 있는지** 판단하는 순수 함수들 —
 * 읽기를 시작해도 되는가(검증), ChatGPT 를 몇 번 쓰는가, 저장하면 어떤 모양인가.
 */

/** 묶음별 오류 문구 */
export interface BundleErrors {
  /** localId → 칸별 오류 */
  byId: Record<string, { name?: string; school?: string; pages?: string }>;
  /** 묶음과 무관한 오류 (묶음이 아예 없음 등) */
  general?: string;
}

/**
 * 읽기를 시작해도 되는지 검사한다.
 *
 * 학교·프린트명을 요구하는 것은 개념지 저장 규칙(`isCategoryIncomplete`)과 같다 —
 * 읽고 나서 저장이 막히면 ChatGPT 를 이미 쓴 뒤라 되돌릴 수 없다.
 * @param bundles - 묶음 초안들
 * @param map - 쪽 배정
 * @returns 오류 (없으면 빈 byId 와 general 없음)
 */
export function validateBundles(
  bundles: readonly BundleDraft[],
  map: PageAssignment,
): BundleErrors {
  const byId: BundleErrors['byId'] = {};
  for (const bundle of bundles) {
    const errors: { name?: string; school?: string; pages?: string } = {};
    if (!bundle.name.trim()) errors.name = '프린트 이름을 적어 주세요.';
    if (!bundle.schoolName.trim()) errors.school = '학교를 골라 주세요.';
    if (pagesOfBundle(map, bundle.localId).length === 0) {
      errors.pages = '이 묶음에 넣을 쪽을 골라 주세요.';
    }
    if (Object.keys(errors).length > 0) byId[bundle.localId] = errors;
  }

  if (bundles.length === 0) {
    return { byId, general: '묶음을 하나 이상 만들어 주세요.' };
  }
  if (map.size === 0) {
    return { byId, general: '읽을 쪽을 하나 이상 골라 주세요.' };
  }
  return { byId };
}

/**
 * 한 묶음을 몇 번에 나눠 읽는가.
 * @param map - 쪽 배정
 * @param localId - 묶음
 * @returns 묶음의 읽기 단위들
 */
export function bundleBatches(map: PageAssignment, localId: string): PageBatch[] {
  return planPageBatches(pagesOfBundle(map, localId), {
    size: PRINT_PAGES_PER_BATCH,
    overlap: PRINT_BATCH_OVERLAP,
  });
}

/**
 * 전체가 ChatGPT 를 몇 번 쓰는가 — 시작 전에 알려야 하는 값이다.
 * @param bundles - 묶음 초안들
 * @param map - 쪽 배정
 * @returns 읽기 횟수
 */
export function totalBatchCount(
  bundles: readonly BundleDraft[],
  map: PageAssignment,
): number {
  return bundles.reduce((sum, b) => sum + bundleBatches(map, b.localId).length, 0);
}

/**
 * 읽기 시작 전 확인 문구.
 *
 * 묶음 하나가 아니라 **읽기 한 번**이 ChatGPT 한 번이다 — 5쪽짜리 프린트는 두 번 쓴다.
 * @param input - 쪽 수·묶음 수·읽기 횟수
 * @returns 확인창에 띄울 글
 */
export function printRunConfirmMessage(input: {
  pageCount: number;
  bundleCount: number;
  batchCount: number;
}): string {
  return `${input.pageCount}쪽을 프린트 ${input.bundleCount}장으로 읽어요.\n`
    + `선생님 ChatGPT 를 약 ${input.batchCount}번 쓰고 몇 분 걸립니다.\n\n계속할까요?`;
}

/**
 * DB 에 넣을 묶음 행에서 **스캔 id 를 뺀 것**.
 *
 * id 는 클라이언트가 만든다(Storage 경로가 먼저 필요하다). 다만 `scan_id` 는 스캔을 만드는
 * 실행부(`runPrintScan`)가 그때 붙인다 — 화면이 미리 만들어 두면 실제로 저장되는 값과
 * 어긋날 수 있고, 어긋나면 묶음이 **없는 스캔을 가리킨 채** 목록에서 사라진다.
 */
export interface PrintBundleDraftRow {
  id: string;
  name: string;
  school_id: string | null;
  school_name: string;
  year: string;
  grade: string;
  include_handwriting: boolean;
  pages: number[];
  status: '대기';
}

/**
 * 초안을 저장 행으로 바꾼다.
 *
 * 이름은 `normalizeCategoryName` 을 거친다 — 트리 노드가 이름 문자열 완전 일치로 묶이는데
 * 표기 변형(`상현중 ` / `상현중`)이 섞이면 폴더가 둘로 갈라진다.
 * 년도·학년은 표시값('미지정') → 저장값('') 으로 바꾼다.
 * @param draft - 화면 초안
 * @param map - 쪽 배정
 * @param id - 이 묶음의 UUID
 * @returns 스캔 id 를 뺀 insert 행
 */
export function toBundleInsert(
  draft: BundleDraft,
  map: PageAssignment,
  id: string,
): PrintBundleDraftRow {
  return {
    id,
    name: normalizeCategoryName(draft.name),
    school_id: draft.schoolId || null,
    school_name: normalizeCategoryName(draft.schoolName),
    year: toStoredValue(draft.year),
    grade: toStoredValue(draft.grade),
    include_handwriting: draft.includeHandwriting,
    pages: pagesOfBundle(map, draft.localId),
    status: '대기',
  };
}

/**
 * 묶음이 만들 개념지의 카테고리.
 *
 * 프린트는 전부 **외부지문 및 프린트** 레벨이고, 프린트명이 `unit`(= categories.chapter) 이다.
 * 이 매핑을 바꾸면 이미 만든 시험지가 트리에서 다른 자리로 옮겨간다.
 * @param bundle - 묶음(저장된 값 기준 — 년도·학년은 '' 가 미지정)
 * @returns 개념지 카테고리
 */
export function bundleSheetCategory(bundle: {
  name: string;
  school_name: string;
  year: string;
  grade: string;
}): BuilderCategory {
  return {
    level: EXTERNAL_LEVEL,
    year: bundle.year,
    grade: bundle.grade,
    publisher: '',
    semester: '',
    unit: bundle.name,
    subunit: '',
    schoolName: bundle.school_name,
  };
}
