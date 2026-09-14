'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  BundleForm, BundleList, PagePreviewDialog, PrintPageGrid, ScanMetaForm,
} from '@/components/print-scan';
import OcrProgress from '@/components/problem-ocr/OcrProgress';
import { useAiEnabled } from '@/hooks/useAiEnabled';
import { usePdfPagePreview } from '@/hooks/usePdfPagePreview';
import { usePrintScanOcr } from '@/hooks/usePrintScanOcr';
import { usePrintScanPages } from '@/hooks/usePrintScanPages';
import { getSelectableSchools } from '@/lib/category-master';
import { kstYear } from '@/lib/kst-year';
import { assignedPages } from '@/lib/print-scan/bundles';
import {
  printRunConfirmMessage, toBundleInsert, totalBatchCount, validateBundles,
} from '@/lib/print-scan/bundle-plan';
import { pageRange } from '@/lib/print-scan/page-preview';
import {
  applyScanMetaPatch, initialScanMeta, validateScanMeta, type ScanMetaValues,
} from '@/lib/print-scan/scan-meta';
import { OCR_CONFIRM_BATCH_THRESHOLD } from '@/lib/problem-ocr/constants';
import type { SelectableSchool } from '@/types';

/**
 * 학교 프린트 스캔 올리기 (`/print-sheets/upload`).
 *
 * 스캔 PDF 하나에 아이들이 가져온 프린트가 여러 장 섞여 있다 —
 * 쪽을 **프린트별로 묶고**, 묶음마다 따로 읽어 시험지 한 장씩을 만든다.
 *
 * 묻는 차례가 곧 좁혀 가는 차례다: **① 이 스캔이 어느 학교·학년·시험 것인가**(한 번만) →
 * **② 쪽을 프린트별로 묶기** → **③ 읽기**. 학교를 고르기 전에는 ②·③ 이 열리지 않는다.
 * 저장되는 프린트 이름은 **스캔 제목 + 프린트별 이름**이다(`composePrintName`).
 */
export default function PrintScanUploadPage() {
  const router = useRouter();
  const ai = useAiEnabled();
  const ocr = usePrintScanOcr();

  const [file, setFile] = useState<File | null>(null);
  const [meta, setMeta] = useState(() => initialScanMeta(String(kstYear())));
  const [schools, setSchools] = useState<SelectableSchool[]>([]);
  /** 크게 보고 있는 쪽 (null 이면 창이 닫혀 있다) */
  const [previewPage, setPreviewPage] = useState<number | null>(null);
  const scan = usePrintScanPages(file);
  const preview = usePdfPagePreview(file, previewPage);

  useEffect(() => {
    let alive = true;
    getSelectableSchools()
      .then((rows) => { if (alive) setSchools(rows); })
      .catch(() => toast.error('학교 목록을 불러오지 못했어요.'));
    return () => { alive = false; };
  }, []);

  const changeMeta = useCallback((patch: Partial<ScanMetaValues>) => {
    setMeta((s) => applyScanMetaPatch(s, patch));
  }, []);

  const active = scan.bundles.find((b) => b.localId === scan.activeId) ?? null;
  const errors = validateBundles(scan.bundles, scan.assignments, meta.values.title);
  const metaErrors = validateScanMeta(meta.values);
  const batchCount = totalBatchCount(scan.bundles, scan.assignments);
  const pageCount = assignedPages(scan.assignments).length;
  const busy = ocr.running;
  // 학교를 고르기 전에는 프린트를 설정할 수 없다 — 이름도 카테고리도 그 값에서 나온다
  const ready = scan.pageCount > 0 && Boolean(meta.values.schoolId);

  const start = async () => {
    if (!file) return;
    if (!scan.ready) {
      toast.error('PDF 를 여는 중이에요. 잠시 뒤에 다시 눌러 주세요.');
      return;
    }
    // 화면이 이미 막고 있지만, 여기서도 확인한다 — 학교 id 없이 저장하면 시험지는
    // 만들어지는데 카테고리 트리에서만 사라진다
    if (metaErrors.school) {
      toast.error(metaErrors.school);
      return;
    }
    if (Object.keys(errors.byId).length > 0 || errors.general) {
      toast.error(errors.general ?? '프린트 정보에 빠진 것이 있어요.');
      return;
    }

    // 읽기 한 번이 선생님 ChatGPT 한 번이다 — 무심코 20쪽을 고르면 7번이 나간다
    if (batchCount >= OCR_CONFIRM_BATCH_THRESHOLD) {
      const ok = window.confirm(printRunConfirmMessage({
        pageCount, bundleCount: scan.bundles.length, batchCount,
      }));
      if (!ok) return;
    }

    const result = await ocr.startScan({
      file,
      title: meta.values.title,
      pageCount: scan.pageCount,
      // 스캔 id 는 `runPrintScan` 이 만들어 붙인다 — 화면이 미리 정하지 않는다
      bundles: scan.bundles.map(
        (b) => toBundleInsert(b, scan.assignments, crypto.randomUUID(), meta.values),
      ),
    });

    // 실패해도 행은 남는다 — 목록에서 다시 읽을 수 있다
    if (result) router.push('/print-sheets');
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">🖨️ 학교 프린트 올리기</h1>
        <p className="mt-1 text-sm text-gray-500">
          스캔한 PDF 를 올리고 쪽을 프린트별로 묶으면, 선생님 컴퓨터의 ChatGPT 가 읽어
          빈칸 시험지로 만듭니다.
        </p>
      </div>

      {!ai.features.print_ocr && (
        <Card>
          <CardContent className="py-8 text-center text-sm text-gray-500">
            AI 읽기가 아직 열리지 않았어요.{' '}
            <a href="/settings/ai" className="text-primary underline underline-offset-2">
              AI 연결 설정
            </a>
            에서 상태를 확인해 주세요.
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">1. 스캔 PDF 와 학교 정보</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <Input
            type="file"
            accept="application/pdf,.pdf"
            disabled={busy}
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null);
              // 새 PDF 를 고르면 열려 있던 크게 보기는 옛 파일의 쪽이다 — 닫는다
              setPreviewPage(null);
            }}
            aria-label="스캔한 PDF"
          />

          <ScanMetaForm
            state={meta}
            schools={schools}
            disabled={busy}
            onChange={changeMeta}
          />

          {scan.pageCount > 0 && !meta.values.schoolId && (
            <p className="text-sm text-gray-500">학교를 고르면 다음 단계가 열려요.</p>
          )}
          {scan.error && <p className="text-sm text-red-600">{scan.error}</p>}
        </CardContent>
      </Card>

      {ready && (
        <Card>
          <CardHeader><CardTitle className="text-base">2. 쪽을 프린트별로 묶기</CardTitle></CardHeader>
          <CardContent>
            <div className="grid gap-5 lg:grid-cols-[minmax(0,7fr)_minmax(0,4fr)]">
              <PrintPageGrid
                pageCount={scan.pageCount}
                from={scan.from}
                windowSize={scan.windowSize}
                thumbnails={scan.thumbnails}
                bundles={scan.bundles}
                assignments={scan.assignments}
                activeId={scan.activeId}
                loading={scan.loading}
                onTogglePage={scan.togglePage}
                onAssignWindow={scan.assignWindow}
                onShowFrom={scan.showFrom}
                onPreview={setPreviewPage}
              />

              <div className="space-y-4">
                <BundleList
                  bundles={scan.bundles}
                  assignments={scan.assignments}
                  activeId={scan.activeId}
                  invalidIds={Object.keys(errors.byId)}
                  disabled={busy}
                  onSelect={scan.setActive}
                  onAdd={scan.addBundle}
                  onRemove={scan.removeBundle}
                />

                {active && (
                  <div className="rounded-lg border border-gray-200 p-3">
                    <BundleForm
                      bundle={active}
                      scanTitle={meta.values.title}
                      errors={errors.byId[active.localId]}
                      pageCount={scan.pagesOf(active.localId).length}
                      disabled={busy}
                      onChange={(patch) => scan.updateBundle(active.localId, patch)}
                    />
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {ready && (
        <Card>
          <CardHeader><CardTitle className="text-base">3. 읽기</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-gray-600">
              프린트 {scan.bundles.length}장 · 고른 쪽 {pageCount}쪽 ·
              {' '}ChatGPT 약 {batchCount}번
            </p>

            <OcrProgress progress={ocr.progress} label={ocr.progressLabel} warnings={ocr.warnings} />

            <div className="flex items-center gap-2">
              <Button
                type="button"
                onClick={start}
                disabled={busy || !ai.features.print_ocr || !scan.ready}
              >
                {busy ? '읽는 중…' : '읽기 시작'}
              </Button>
              {ocr.running && (
                <Button type="button" variant="outline" onClick={ocr.cancel}>취소</Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <PagePreviewDialog
        page={previewPage}
        pages={pageRange(scan.pageCount)}
        src={preview.src}
        loading={preview.loading}
        error={preview.error}
        onClose={() => setPreviewPage(null)}
        onNavigate={setPreviewPage}
      />
    </div>
  );
}
