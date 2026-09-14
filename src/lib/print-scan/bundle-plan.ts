import type { BuilderCategory } from '@/components/exam-builder';
import type { CategoryMatchInput } from '@/lib/words-save';
import { normalizeCategoryName } from '@/lib/category-name';
import { EXTERNAL_LEVEL } from '@/lib/constants';
import { toStoredValue } from '@/lib/external-category';
import { planPageBatches, type PageBatch } from '@/lib/problem-ocr/batch-plan';
import { PRINT_BATCH_OVERLAP, PRINT_PAGES_PER_BATCH } from './constants';
import { pagesOfBundle, type BundleDraft, type PageAssignment } from './bundles';
import { composePrintName, type ScanMetaValues } from './scan-meta';

/**
 * 묶음 초안으로 **무엇을 할 수 있는지** 판단하는 순수 함수들 —
 * 읽기를 시작해도 되는가(검증), ChatGPT 를 몇 번 쓰는가, 저장하면 어떤 모양인가.
 */

/** 묶음별 오류 문구 */
export interface BundleErrors {
  /** localId → 칸별 오류 */
  byId: Record<string, { name?: string; pages?: string }>;
  /** 묶음과 무관한 오류 (묶음이 아예 없음 등) */
  general?: string;
}

/**
 * 읽기를 시작해도 되는지 검사한다.
 *
 * 프린트명을 요구하는 것은 개념지 저장 규칙(`isCategoryIncomplete`)과 같다 —
 * 읽고 나서 저장이 막히면 ChatGPT 를 이미 쓴 뒤라 되돌릴 수 없다. 학교는 여기서 안 본다:
 * 스캔 단위 값이라 `validateScanMeta` 가 맡고, 화면도 학교를 고르기 전에는 이 단계를 안 연다.
 *
 * ⚠️ 검사하는 것은 프린트별 이름이 아니라 **저장될 이름**(스캔 제목 + 프린트별 이름)이다.
 *    프린트별 이름은 비워도 되지만(한 장짜리 스캔) 합친 이름이 비면 안 되고,
 *    한 스캔 안에서 **겹쳐서도 안 된다** — 겹치면 `school_materials` 의
 *    UNIQUE(name, school_id, year, grade) 에 막혀 두 번째 프린트가 카테고리 트리에서
 *    첫 번째와 한 자리를 쓰고, 시험지 제목도 똑같아져 어느 것이 어느 것인지 알 수 없다.
 * @param bundles - 묶음 초안들
 * @param map - 쪽 배정
 * @param scanTitle - 스캔 제목 (이름의 앞부분)
 * @returns 오류 (없으면 빈 byId 와 general 없음)
 */
export function validateBundles(
  bundles: readonly BundleDraft[],
  map: PageAssignment,
  scanTitle: string,
): BundleErrors {
  const byId: BundleErrors['byId'] = {};
  const seen = new Set<string>();

  for (const bundle of bundles) {
    const errors: { name?: string; pages?: string } = {};
    const name = composePrintName(scanTitle, bundle.name);
    if (!name) {
      errors.name = '프린트 이름을 적어 주세요.';
    } else if (seen.has(name)) {
      // 뒤에 온 쪽을 짚는다 — 먼저 적은 것을 고치라고 하면 방금 친 것이 지워진다
      errors.name = '같은 이름의 프린트가 있어요. 프린트 이름을 다르게 적어 주세요.';
    } else {
      seen.add(name);
    }
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
  semester: string;
  exam_type: string;
  include_handwriting: boolean;
  register_words: boolean;
  pages: number[];
  status: '대기';
}

/**
 * 초안을 저장 행으로 바꾼다.
 *
 * 분류(학교·학년도·학년·학기·시험)는 **스캔에서 온다** — 화면은 한 번만 물었고 여기서
 * 묶음마다 복사한다. DB 가 묶음 단위인 까닭은 읽는 쪽(카테고리 트리·rename 트리거·목록 줄)이
 * 전부 묶음 행을 보기 때문이다(sql/29 헤더 참고).
 *
 * 이름은 `composePrintName` 이 만들고 `normalizeCategoryName` 을 거친다 — 트리 노드가 이름
 * 문자열 완전 일치로 묶이는데 표기 변형(`상현중 ` / `상현중`)이 섞이면 폴더가 둘로 갈라진다.
 * 년도·학년·학기·시험은 표시값('미지정') → 저장값('') 으로 바꾼다.
 * @param draft - 화면 초안 (이름·손글씨·단어 등록)
 * @param map - 쪽 배정
 * @param id - 이 묶음의 UUID
 * @param scan - 스캔 단위로 고른 값
 * @returns 스캔 id 를 뺀 insert 행
 */
export function toBundleInsert(
  draft: BundleDraft,
  map: PageAssignment,
  id: string,
  scan: ScanMetaValues,
): PrintBundleDraftRow {
  return {
    id,
    name: composePrintName(scan.title, draft.name),
    school_id: scan.schoolId || null,
    school_name: normalizeCategoryName(scan.schoolName),
    year: toStoredValue(scan.year),
    grade: toStoredValue(scan.grade),
    semester: toStoredValue(scan.semester),
    exam_type: toStoredValue(scan.examType),
    include_handwriting: draft.includeHandwriting,
    register_words: draft.registerWords,
    pages: pagesOfBundle(map, draft.localId),
    status: '대기',
  };
}

/**
 * 묶음이 만들 개념지의 카테고리.
 *
 * 프린트는 전부 **외부지문 및 프린트** 레벨이고, 프린트명이 `unit`(= categories.chapter) 이다.
 * 이 매핑을 바꾸면 이미 만든 시험지가 트리에서 다른 자리로 옮겨간다.
 *
 * ⚠️ 묶음의 `semester` 를 여기 **넣지 않는다**(sql/29 로 생긴 뒤에도 `''` 그대로다).
 *    외부지문 계층은 `학교 > 년도 > 학년 > 프린트` 이고 학기는 그 자연키에 없다 —
 *    넣으면 이미 만든 시험지가 트리에서 다른 자리로 옮겨가고, ara-system 성적의
 *    시리즈 이름(외부지문은 학년만 쓴다)도 갈라진다. 학기·시험은 묶음 행에만 남는다.
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

/**
 * 묶음의 단어가 들어갈 카테고리.
 *
 * ⚠️ **`bundleSheetCategory` 에서 변환해 만든다 — 따로 적지 않는다.** 카테고리 모양이 셋이라
 *    (`BuilderCategory` 는 unit/subunit, `CategoryMatchInput` 은 chapter/subChapter,
 *    자연키는 sub_chapter/school_name) 형제 함수로 두면 언젠가 한쪽만 고쳐진다.
 *    그러면 시험지와 단어가 **다른 카테고리**에 들어가 트리에서 서로를 못 찾는다.
 * @param bundle - 묶음(저장된 값 기준 — 년도·학년은 '' 가 미지정)
 * @returns `ensureCategoryId` 에 넘길 카테고리
 */
export function bundleWordsCategory(bundle: {
  name: string;
  school_name: string;
  year: string;
  grade: string;
}): CategoryMatchInput {
  const sheet = bundleSheetCategory(bundle);
  return {
    level: sheet.level,
    year: sheet.year,
    grade: sheet.grade,
    publisher: sheet.publisher,
    semester: sheet.semester,
    chapter: sheet.unit,
    subChapter: sheet.subunit,
    schoolName: sheet.schoolName,
  };
}
