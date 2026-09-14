import { supabase } from '@/lib/supabase';
import type { PrintBundle, PrintScan, PrintScanRow } from '@/types/print-scan';

/**
 * 학교 프린트 목록·상세 조회.
 *
 * 묶음은 스캔에 딸린 몇 행뿐이라 **한 번에 묻어 온다**(FK 임베딩). 시험지 연결만
 * 따로 읽는데, 개념지 쪽에서 거는 편이 인덱스(`idx_concept_sheets_print_bundle`)를 탄다.
 */

/** 한 번에 보여 줄 스캔 수. 넘으면 오래된 것부터 안 보인다 — 지금 규모(주 몇 건)에는 넉넉하다 */
const SCAN_LIMIT = 100;

/** 개념지에서 읽어 오는 연결 정보 */
interface SheetLink {
  id: string;
  print_bundle_id: string;
  marks: unknown[] | null;
}

/**
 * 스캔 목록과 그 묶음들 (최신순).
 * @returns 목록 행들
 * @throws 조회 실패 시 (조용히 빈 목록을 주면 "왜 안 보이지" 가 된다)
 */
export async function fetchScansWithBundles(): Promise<PrintScanRow[]> {
  const { data, error } = await supabase
    .from('print_scans')
    .select('*, print_bundles(*)')
    .order('created_at', { ascending: false })
    .limit(SCAN_LIMIT);
  if (error) throw error;

  const scans = (data ?? []) as (PrintScan & { print_bundles: PrintBundle[] })[];
  const bundleIds = scans.flatMap((s) => (s.print_bundles ?? []).map((b) => b.id));
  const sheets = await fetchSheetLinks(bundleIds);

  return scans.map((scan) => ({
    ...scan,
    bundles: [...(scan.print_bundles ?? [])]
      // 만든 순서 = 선생님이 묶은 순서다. 쪽 번호로 다시 세우면 화면에서 자리가 바뀐다
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .map((bundle) => {
        const sheet = sheets.get(bundle.id);
        return {
          ...bundle,
          sheetId: sheet?.id ?? null,
          markCount: Array.isArray(sheet?.marks) ? sheet.marks.length : 0,
        };
      }),
  }));
}

/** 묶음 id → 그 묶음의 시험지 */
async function fetchSheetLinks(bundleIds: string[]): Promise<Map<string, SheetLink>> {
  const out = new Map<string, SheetLink>();
  if (bundleIds.length === 0) return out;

  const { data } = await supabase
    .from('concept_sheets')
    .select('id, print_bundle_id, marks')
    .in('print_bundle_id', bundleIds);

  for (const row of (data ?? []) as SheetLink[]) {
    if (row.print_bundle_id) out.set(row.print_bundle_id, row);
  }
  return out;
}

/**
 * 묶음 하나와 그 스캔 (시험지 화면의 원본 쪽 패널에 쓴다).
 * @param bundleId - 묶음 id
 * @returns 묶음·스캔. 없으면 null
 * @throws 조회 실패 시
 */
export async function fetchBundle(
  bundleId: string,
): Promise<{ bundle: PrintBundle; scan: PrintScan | null } | null> {
  const { data, error } = await supabase
    .from('print_bundles')
    .select('*, print_scans(*)')
    .eq('id', bundleId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const { print_scans: scan, ...bundle } = data as PrintBundle & { print_scans: PrintScan | null };
  return { bundle: bundle as PrintBundle, scan: scan ?? null };
}
