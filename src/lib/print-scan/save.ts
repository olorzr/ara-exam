import { supabase } from '@/lib/supabase';
import { createSchoolMaterial, ensureSchoolMirror } from '@/lib/category-master';
import { buildConceptSheetPayload } from '@/lib/concept-sheet-form';
import { removeProblemFiles } from '@/lib/problem-bank/storage';
import type {
  PrintBundle, PrintBundleStatus, PrintOcrMeta, PrintQaItem, PrintQaMeta, PrintWordsMeta,
} from '@/types/print-scan';
import { bundleSheetCategory, type PrintBundleDraftRow } from './bundle-plan';
import { printScanPdfPath } from './storage-paths';

/**
 * 학교 프린트 스캔·묶음 쓰기.
 *
 * id 는 **클라이언트가 만든다**(`crypto.randomUUID`) — 저장 전에 id 를 알아야
 * Storage 경로(`print-scans/{id}/…`)를 정하고 파일을 올릴 수 있다.
 *
 * ⚠️ `user_id` 를 보내지 않는다 — DB 트리거가 `auth.uid()` 로 채우고 UPDATE 에서 잠근다.
 */

/** 저장 직전의 묶음 행 — 초안에 스캔 id 가 붙은 모양 */
type PrintBundleRow = PrintBundleDraftRow & { scan_id: string };

/** 이미 있는 행이라 넣지 않았다는 뜻의 PostgreSQL 코드 */
const UNIQUE_VIOLATION = '23505';

/**
 * 스캔 행을 만든다.
 * @param id - 클라이언트가 만든 UUID
 * @param row - 제목·원본 경로·쪽 수
 * @throws 저장 실패 시
 */
export async function insertScan(
  id: string,
  row: { title: string; file_path: string; page_count: number },
): Promise<void> {
  const { error } = await supabase.from('print_scans').insert({ id, ...row });
  if (error) throw error;
}

/**
 * 묶음들을 한 번에 만든다.
 *
 * ⚠️ **AI 를 부르기 전에** 넣는다. 읽다가 실패하거나 브라우저가 닫혀도 목록에 남아 있어야
 *    '다시 읽기' 로 이어갈 수 있다 — 안 그러면 올린 PDF 가 아무 흔적 없이 사라진다.
 * @param rows - 묶음 행들 (status '대기')
 * @throws 저장 실패 시
 */
export async function insertBundles(rows: PrintBundleRow[]): Promise<void> {
  if (rows.length === 0) return;
  const { error } = await supabase.from('print_bundles').insert(rows);
  if (error) throw error;
}

/** 읽어 온 뒤 다른 탭·다른 선생님이 그 묶음을 먼저 저장했다 — 덮지 않고 멈춘다 */
export class BundleConflictError extends Error {
  constructor() {
    super('다른 탭이나 다른 선생님이 이 프린트를 먼저 저장했어요. 고친 내용은 화면에 남아 있어요.');
    this.name = 'BundleConflictError';
  }
}

/** 고치려던 묶음이 없다 — 다른 탭에서 지웠거나 고칠 권한이 없다 */
export class BundleMissingError extends Error {
  constructor() {
    super('이 프린트를 찾지 못했어요. 다른 탭에서 지웠거나 고칠 권한이 없어요. 고친 내용은 화면에 남아 있어요.');
    this.name = 'BundleMissingError';
  }
}

/** 묶음 갱신의 선택 */
export interface UpdateBundleOptions {
  /**
   * 읽어 왔을 때의 `updated_at` — 주면 **그대로일 때만** 고친다(낙관적 동시성).
   * 문답(`qa_items`·`qa_meta`)처럼 사람이 고친 것을 통째로 보내는 쓰기가 쓴다.
   */
  expectUpdatedAt?: string | null;
}

/**
 * 묶음의 상태·읽기 결과를 갱신한다.
 *
 * ⚠️ PostgREST 의 UPDATE 는 **0행이어도 error 가 null** 이다(2026-10-15 리뷰 7번). 고친 행을
 *    돌려받아 비어 있으면 던진다 — 안 그러면 다른 탭에서 지운 묶음에 '저장했어요' 가 뜨고
 *    미저장 표시가 사라진다(`deleteBundle` 과 같은 규약).
 * ⚠️ `expectUpdatedAt` 을 주면 버전이 같을 때만 고친다(리뷰 2번). 0행이면 한 번 더 읽어
 *    **충돌**(행은 있다)과 **없음**을 가른다 — 사람에게 할 말과 다시 할 일이 다르다.
 *
 * 버전은 `print_bundles_updated_at` 트리거(sql/26)가 쓰기마다 올린다. 조건 없는 쓰기(읽기 상태·
 * 결과, 단어 영수증)도 버전을 올리므로, 그 사이 문답을 열어 둔 탭의 다음 저장은 조용히 덮지 않고
 * **충돌**로 멈춘다. 반대로 문답 저장은 문답 칸만 보내므로 읽기 결과·영수증을 덮지 않는다.
 * @param id - 묶음 id
 * @param patch - 바꿀 값
 * @param options - 버전 조건
 * @returns 새 `updated_at`
 * @throws BundleConflictError - 버전이 달라 고치지 않았을 때
 * @throws BundleMissingError - 묶음이 없을 때(지워졌거나 권한 없음)
 * @throws 그 밖의 저장 실패 시
 */
export async function updateBundle(
  id: string,
  patch: {
    status?: PrintBundleStatus;
    ocr_html?: string;
    ocr_meta?: PrintOcrMeta;
    /** 단어 등록 영수증. `ocr_meta` 와 따로 둔다 — 다시 읽기가 ocr_meta 를 통째로 덮어쓴다 */
    words_meta?: PrintWordsMeta;
    /** 문답 목록. `words_meta` 와 같은 까닭으로 `ocr_meta` 와 따로 둔다 */
    qa_items?: PrintQaItem[];
    /** 문답 나누기 영수증 */
    qa_meta?: PrintQaMeta;
    page_paths?: string[];
  },
  options: UpdateBundleOptions = {},
): Promise<{ updated_at: string }> {
  let request = supabase.from('print_bundles').update(patch).eq('id', id);
  if (options.expectUpdatedAt) request = request.eq('updated_at', options.expectUpdatedAt);
  const { data, error } = await request.select('updated_at').maybeSingle();
  if (error) throw error;
  if (data) return { updated_at: data.updated_at as string };
  if (!options.expectUpdatedAt) throw new BundleMissingError();

  // 0행 — 버전이 달라서인지, 행이 없어서인지 가른다
  const { data: still, error: readError } = await supabase
    .from('print_bundles').select('id').eq('id', id).maybeSingle();
  if (readError) throw readError;
  throw still ? new BundleConflictError() : new BundleMissingError();
}

/**
 * 묶음으로 개념지(= 시험지)를 만든다.
 *
 * 묶음당 하나다 — DB 의 부분 유니크 인덱스가 이를 보장하고, 이미 있으면 그 id 를 돌려준다
 * (다시 읽기가 두 번째 시험지를 만들면 선생님이 마킹해 둔 쪽을 잃는다).
 * @param bundle - 묶음
 * @param html - 정화까지 끝난 본문
 * @returns 개념지 id
 * @throws 저장 실패 시
 */
export async function createSheetForBundle(bundle: PrintBundle, html: string): Promise<string> {
  const existing = await fetchSheetIdForBundle(bundle.id);
  if (existing) return existing;

  const category = bundleSheetCategory(bundle);
  const payload = buildConceptSheetPayload({
    // 제목은 **프린트 이름 그대로**다. 그 이름이 이미 '2026 상현중 중2 1학기 중간 봄봄 학습지'
    // 라서, 학교·년도·학년을 다시 앞에 붙이는 `generateConceptTitle` 을 쓰면 같은 말이
    // 두 번 나온다. 제목은 편집기에서 고칠 수 있다
    title: bundle.name,
    category,
    html,
    // 빈칸은 선생님이(또는 AI 추천이) 고른다 — 읽자마자 마킹하지 않는다
    marks: [],
  });

  const { data, error } = await supabase
    .from('concept_sheets')
    .insert({ ...payload, print_bundle_id: bundle.id })
    .select('id')
    .single();

  if (error || !data) {
    // 유니크 위반이면 그 사이 다른 탭이 먼저 만든 것이다 — 그쪽을 쓴다
    if (error?.code === UNIQUE_VIOLATION) {
      const raced = await fetchSheetIdForBundle(bundle.id);
      if (raced) return raced;
    }
    throw error ?? new Error('시험지를 만들지 못했어요.');
  }
  return data.id as string;
}

/**
 * 묶음의 시험지 id 를 찾는다.
 * @param bundleId - 묶음 id
 * @returns 개념지 id. 없으면 null
 */
export async function fetchSheetIdForBundle(bundleId: string): Promise<string | null> {
  const { data } = await supabase
    .from('concept_sheets')
    .select('id')
    .eq('print_bundle_id', bundleId)
    .maybeSingle();
  return (data?.id as string | undefined) ?? null;
}

/**
 * 프린트를 카테고리 마스터에도 등록해 둔다.
 *
 * 개념지는 카테고리를 **텍스트로 복사**해 저장하므로 마스터가 없어도 저장·인쇄는 된다.
 * 다만 마스터에 없으면 개념지 편집기의 카테고리 트리에 그 프린트가 안 보여서,
 * 선생님이 카테고리 바를 열었을 때 **고른 자리가 비어 보인다**.
 *
 * 학교 거울을 **먼저** 만든다 — `school_materials.school_id` 는 `exam.schools(id)` 를 가리키는
 * 하드 FK 라, 관리자 마스터에서 고른 학교가 거울에 없으면 등록이 FK 위반으로 막힌다.
 *
 * ⚠️ **모든 오류를 삼키지 않는다.** 예전에는 `.catch(() => undefined)` 가 전부를 먹어서,
 *    거울이 없어 프린트가 트리에 안 올라가도 화면에 아무 말이 없었다(이 결함을 조용하게 만든
 *    장치가 바로 그것이다). 이미 있는 경우(UNIQUE 위반)만 정상으로 치고 나머지는 경고로 올린다.
 * @param bundle - 묶음 (학교 id 를 모르면 아무것도 하지 않는다)
 * @param onWarning - 사람에게 보일 경고를 받는 곳 (없으면 조용히 지나간다)
 */
export async function ensureSchoolMaterial(
  bundle: PrintBundle,
  onWarning?: (message: string) => void,
): Promise<void> {
  if (!bundle.school_id || !bundle.name) return;

  const mirror = await ensureSchoolMirror({ id: bundle.school_id, name: bundle.school_name });
  if (mirror.warning) onWarning?.(mirror.warning);
  if (!mirror.id) return;

  const { error } = await createSchoolMaterial(bundle.name, mirror.id, bundle.year, bundle.grade);
  // 이미 있으면 UNIQUE(name, school_id, year, grade) 로 막힌다 — 그게 정상이라 삼킨다
  if (error && error.code !== UNIQUE_VIOLATION) {
    onWarning?.(`프린트 '${bundle.name}' 을(를) 카테고리 마스터에 등록하지 못했어요: ${error.message}`);
  }
}

/**
 * 스캔을 지운다 (묶음·시험지는 DB 가 CASCADE 로 함께 지운다).
 *
 * ⚠️ `supabase.delete()` 는 **0행을 지워도 error 가 null** 이다. 지운 행을 돌려받아
 *    비어 있으면 던진다 — 안 그러면 "성공 토스트가 뜨는데 목록에는 그대로" 가 된다.
 * @param scan - 지울 스캔 (파일 정리를 위해 경로가 필요하다)
 * @throws 지우지 못했을 때
 */
export async function deleteScan(scan: { id: string; file_path: string }): Promise<void> {
  const { data, error } = await supabase
    .from('print_scans')
    .delete()
    .eq('id', scan.id)
    .select('id');
  if (error) throw error;
  if (!data || data.length === 0) {
    throw new Error('이미 지워졌거나 지울 권한이 없어요. 새로고침 후 다시 확인해 주세요.');
  }

  // 파일은 지워도 안전하다 — 기출과 달리 **인쇄물이 이 이미지를 쓰지 않는다**
  // (시험지 본문은 글이다). 실패해도 무시한다: 고아 파일이 남을 뿐이다
  await removeProblemFiles([scan.file_path || printScanPdfPath(scan.id)]);
}

/**
 * 묶음 하나를 지운다 (그 묶음의 시험지도 CASCADE 로 함께 지워진다).
 * @param bundleId - 묶음 id
 * @throws 지우지 못했을 때
 */
export async function deleteBundle(bundleId: string): Promise<void> {
  const { data, error } = await supabase
    .from('print_bundles')
    .delete()
    .eq('id', bundleId)
    .select('id');
  if (error) throw error;
  if (!data || data.length === 0) {
    throw new Error('이미 지워졌거나 지울 권한이 없어요. 새로고침 후 다시 확인해 주세요.');
  }
}
