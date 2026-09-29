import { supabase } from '@/lib/supabase';
import { fetchBundle } from './queries';
import { createSheetForBundle, ensureSchoolMaterial, insertScan } from './save';
import type { ScanMetaValues } from './scan-meta';
import { toTypedBundleInsert, toTypedScanInsert, validateTypedSheet } from './typed';

/**
 * 직접 입력 시험지를 만든다 — 빈 시험지까지 만들고 그 묶음 id 를 돌려준다.
 *
 * 차례: 스캔 행 → 묶음 행 → 빈 시험지(`concept_sheets`) → 카테고리 트리 등록.
 * 화면은 돌려받은 묶음의 편집 화면(`/print-sheets/{id}`)으로 가서 바로 친다.
 *
 * ⚠️ 묶음을 못 만들면 **방금 만든 스캔을 지운다** — 묶음 없는 빈 카드가 목록에 남는다.
 * ⚠️ 시험지를 못 만들어도 묶음은 남긴다. 목록 줄의 '시험지 만들기' 가 그 자리를 다시
 *    채운다(`createSheetForBundle` 은 이미 있으면 그 id 를 돌려준다).
 * @param meta - 학교·학년·시험 (표시값)
 * @param label - 프린트 이름
 * @param onWarning - 카테고리 트리 등록 경고를 받을 곳
 * @returns 묶음 id
 * @throws 입력이 모자라거나 저장에 실패했을 때
 */
export async function createTypedPrintSheet(
  meta: ScanMetaValues,
  label: string,
  onWarning?: (message: string) => void,
): Promise<string> {
  const errors = validateTypedSheet(meta, label);
  const problem = errors.school ?? errors.name;
  if (problem) throw new Error(problem);

  const scanId = crypto.randomUUID();
  const bundleId = crypto.randomUUID();
  await insertScan(scanId, toTypedScanInsert(meta, label));

  const { error } = await supabase
    .from('print_bundles')
    .insert(toTypedBundleInsert(meta, label, { id: bundleId, scanId }));
  if (error) {
    await supabase.from('print_scans').delete().eq('id', scanId);
    throw error;
  }

  const found = await fetchBundle(bundleId);
  if (!found) throw new Error('만든 프린트를 다시 읽지 못했어요. 목록에서 확인해 주세요.');
  await createSheetForBundle(found.bundle, '');
  await ensureSchoolMaterial(found.bundle, onWarning);
  return bundleId;
}
