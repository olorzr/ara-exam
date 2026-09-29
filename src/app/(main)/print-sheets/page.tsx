'use client';

import { useState } from 'react';
import Link from 'next/link';
import { FileScan, PenLine, PlusCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { OwnerScopeTabs } from '@/components/ui/owner-scope-tabs';
import { PrintScanCard } from '@/components/print-scan';
import OcrProgress from '@/components/problem-ocr/OcrProgress';
import { useAiEnabled } from '@/hooks/useAiEnabled';
import { useCreatorNames } from '@/hooks/useCreatorNames';
import { usePrintScanOcr } from '@/hooks/usePrintScanOcr';
import { usePrintSheetList } from '@/hooks/usePrintSheetList';
import { usePrintWordsRegister } from '@/hooks/usePrintWordsRegister';
import type { OwnerScope } from '@/lib/owner-scope';
import type { PrintBundleRow, PrintScanRow } from '@/types/print-scan';

/**
 * 학교 프린트 시험지 목록 (`/print-sheets`).
 *
 * 스캔 한 건 안에 프린트(묶음)가 여러 장 들어 있고, 프린트 한 장이 시험지 한 장이다.
 * 읽기가 실패했거나 아직 안 읽은 프린트는 여기서 다시 읽는다 — 올려 둔 원본 PDF 를 쓰므로
 * 파일을 다시 고를 필요가 없다. 스캔 없이 **직접 입력**해서 만들 수도 있다(`/print-sheets/new`).
 *
 * 내가 올린 것과 다른 선생님이 올린 것을 탭으로 가른다 — 들어올 때마다 내 것부터 연다.
 */
export default function PrintSheetsPage() {
  const ai = useAiEnabled();
  const [scope, setScope] = useState<OwnerScope>('mine');
  const list = usePrintSheetList(scope);
  // 다른 선생님 탭에서만 누가 올렸는지 적는다
  const names = useCreatorNames(scope === 'others' ? list.scans.map((s) => s.user_id) : []);
  const ocr = usePrintScanOcr();
  const words = usePrintWordsRegister();

  /** 실패·대기 묶음을 다시 읽는다. 끝나면 목록을 다시 읽어 상태를 맞춘다 */
  const read = async (bundle: PrintBundleRow) => {
    const scan = list.scans.find((s) => s.id === bundle.scan_id);
    if (!scan) return;
    await ocr.rerunBundle(bundle, scan);
    await list.reload();
  };

  /** 읽어 둔 원문으로 단어만 등록한다. 끝나면 목록을 다시 읽어 칩을 갱신한다 */
  const registerWords = async (bundle: PrintBundleRow) => {
    await words.run(bundle);
    await list.reload();
  };

  // ⚠️ AI 작업 둘을 **한 잠금으로 묶는다** — 따로 두면 읽는 도중에 단어 등록을 눌러
  //    같은 브릿지로 두 생성이 겹친다
  const busy = ocr.running || words.running || list.busyId !== null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">🖨️ 학교 프린트 시험지</h1>
          <p className="mt-1 text-sm text-gray-500">
            아이들이 가져온 학교 프린트를 스캔해 올리거나 직접 입력하면 빈칸 시험지로 만들 수 있어요.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/print-sheets/new">
            <Button variant="outline">
              <PenLine className="mr-2 h-4 w-4" />
              직접 입력하기
            </Button>
          </Link>
          <Link href="/print-sheets/upload">
            <Button className="bg-primary hover:bg-primary-hover text-white">
              <PlusCircle className="mr-2 h-4 w-4" />
              새 스캔 올리기
            </Button>
          </Link>
        </div>
      </div>

      {ocr.running && (
        <Card>
          <CardContent className="space-y-3 py-4">
            <OcrProgress progress={ocr.progress} label={ocr.progressLabel} warnings={ocr.warnings} />
            <Button type="button" variant="outline" size="sm" onClick={ocr.cancel}>
              취소
            </Button>
          </CardContent>
        </Card>
      )}

      {/*
        단어 등록도 **몇십 초 걸리는 AI 작업**이다. 도는 동안 목록 버튼이 전부 잠기므로,
        무엇을 하고 있는지와 멈추는 길을 함께 보여 준다(코덱스 리뷰 P2).
        진행률 막대를 쓰지 않는 까닭: 한 번의 생성이라 셀 단계가 없다 — 0% 막대는 멈춘 것처럼 보인다.
      */}
      {words.running && (
        <Card>
          <CardContent className="flex flex-wrap items-center gap-3 py-4">
            <div className="h-4 w-4 shrink-0 animate-spin rounded-full border-b-2 border-primary" />
            <span className="flex-1 text-sm text-gray-600">
              {words.runningName && `${words.runningName} · `}단어 등록 중… 몇십 초 걸려요.
            </span>
            <Button type="button" variant="outline" size="sm" onClick={words.cancel}>
              취소
            </Button>
          </CardContent>
        </Card>
      )}

      <OwnerScopeTabs value={scope} onChange={setScope}>
        {list.loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : list.scans.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <FileScan className="mb-3 h-12 w-12 text-gray-300" />
            <p className="text-sm">
              {scope === 'mine' ? '아직 올린 프린트가 없습니다.' : '다른 선생님이 올린 프린트가 없습니다.'}
            </p>
            {scope === 'mine' && (
              <div className="mt-4 flex gap-2">
                <Link href="/print-sheets/new">
                  <Button variant="outline" size="sm">직접 입력하기</Button>
                </Link>
                <Link href="/print-sheets/upload">
                  <Button variant="outline" size="sm">첫 스캔 올리기</Button>
                </Link>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {list.scans.map((scan: PrintScanRow) => (
              <PrintScanCard
                key={scan.id}
                scan={scan}
                busy={busy}
                aiEnabled={ai.features.print_ocr}
                onRead={read}
                onCreateSheet={list.createSheet}
                onRegisterWords={registerWords}
                onDeleteBundle={list.deleteBundle}
                onDeleteScan={list.deleteScan}
                creatorName={names.get(scan.user_id)}
              />
            ))}
          </div>
        )}
      </OwnerScopeTabs>
    </div>
  );
}
