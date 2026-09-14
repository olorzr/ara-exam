import { supabase } from '@/lib/supabase';
import { createSchoolMaterial } from '@/lib/category-master';
import { buildConceptSheetPayload, generateConceptTitle } from '@/lib/concept-sheet-form';
import { removeProblemFiles } from '@/lib/problem-bank/storage';
import type { PrintBundle, PrintBundleStatus, PrintOcrMeta } from '@/types/print-scan';
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

/**
 * 묶음의 상태·읽기 결과를 갱신한다.
 * @param id - 묶음 id
 * @param patch - 바꿀 값
 * @throws 저장 실패 시
 */
export async function updateBundle(
  id: string,
  patch: {
    status?: PrintBundleStatus;
    ocr_html?: string;
    ocr_meta?: PrintOcrMeta;
    page_paths?: string[];
  },
): Promise<void> {
  const { error } = await supabase.from('print_bundles').update(patch).eq('id', id);
  if (error) throw error;
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
    title: generateConceptTitle(category),
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
 * 프린트를 카테고리 마스터에도 등록해 둔다 (실패해도 무시).
 *
 * 개념지는 카테고리를 **텍스트로 복사**해 저장하므로 마스터가 없어도 저장·인쇄는 된다.
 * 다만 마스터에 없으면 개념지 편집기의 카테고리 트리에 그 프린트가 안 보여서,
 * 선생님이 카테고리 바를 열었을 때 **고른 자리가 비어 보인다**.
 * @param bundle - 묶음 (학교 id 를 모르면 아무것도 하지 않는다)
 */
export async function ensureSchoolMaterial(bundle: PrintBundle): Promise<void> {
  if (!bundle.school_id || !bundle.name) return;
  // 이미 있으면 UNIQUE(name, school_id, year, grade) 로 막힌다 — 그게 정상이라 삼킨다
  await createSchoolMaterial(bundle.name, bundle.school_id, bundle.year, bundle.grade)
    .catch(() => undefined);
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
