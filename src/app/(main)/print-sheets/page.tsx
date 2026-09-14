'use client';

import Link from 'next/link';
import { FileScan, PlusCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { PrintScanCard } from '@/components/print-scan';
import OcrProgress from '@/components/problem-ocr/OcrProgress';
import { useAiEnabled } from '@/hooks/useAiEnabled';
import { usePrintScanOcr } from '@/hooks/usePrintScanOcr';
import { usePrintSheetList } from '@/hooks/usePrintSheetList';
import type { PrintBundleRow, PrintScanRow } from '@/types/print-scan';

/**
 * 학교 프린트 시험지 목록 (`/print-sheets`).
 *
 * 스캔 한 건 안에 프린트(묶음)가 여러 장 들어 있고, 프린트 한 장이 시험지 한 장이다.
 * 읽기가 실패했거나 아직 안 읽은 프린트는 여기서 다시 읽는다 — 올려 둔 원본 PDF 를 쓰므로
 * 파일을 다시 고를 필요가 없다.
 */
export default function PrintSheetsPage() {
  const ai = useAiEnabled();
  const list = usePrintSheetList();
  const ocr = usePrintScanOcr();

  /** 실패·대기 묶음을 다시 읽는다. 끝나면 목록을 다시 읽어 상태를 맞춘다 */
  const read = async (bundle: PrintBundleRow) => {
    const scan = list.scans.find((s) => s.id === bundle.scan_id);
    if (!scan) return;
    await ocr.rerunBundle(bundle, scan);
    await list.reload();
  };

  if (list.loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">🖨️ 학교 프린트 시험지</h1>
          <p className="mt-1 text-sm text-gray-500">
            아이들이 가져온 학교 프린트를 스캔해 올리면 빈칸 시험지로 만들 수 있어요.
          </p>
        </div>
        <Link href="/print-sheets/upload">
          <Button className="bg-primary hover:bg-primary-hover text-white">
            <PlusCircle className="mr-2 h-4 w-4" />
            새 스캔 올리기
          </Button>
        </Link>
      </div>

      {ocr.running && (
        <Card>
          <CardContent className="space-y-3 py-4">
            <OcrProgress progress={ocr.progress} label={ocr.progressLabel} warnings={[]} />
            <Button type="button" variant="outline" size="sm" onClick={ocr.cancel}>
              취소
            </Button>
          </CardContent>
        </Card>
      )}

      {list.scans.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-300">
          <FileScan className="mb-3 h-12 w-12" />
          <p className="text-sm">아직 올린 스캔이 없습니다.</p>
          <Link href="/print-sheets/upload" className="mt-4">
            <Button variant="outline" size="sm">첫 스캔 올리기</Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {list.scans.map((scan: PrintScanRow) => (
            <PrintScanCard
              key={scan.id}
              scan={scan}
              busy={ocr.running || list.busyId !== null}
              aiEnabled={ai.features.print_ocr}
              onRead={read}
              onCreateSheet={list.createSheet}
              onDeleteBundle={list.deleteBundle}
              onDeleteScan={list.deleteScan}
            />
          ))}
        </div>
      )}
    </div>
  );
}
