'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAiEnabled } from '@/hooks/useAiEnabled';
import { usePdfPages } from '@/hooks/usePdfPages';
import { useProblemOcr } from '@/hooks/useProblemOcr';
import { getSchools } from '@/lib/category-master';
import { fetchAreaSets, fetchAreaTree, pickAreaSetForGrade } from '@/lib/problem-bank/area-master';
import type { AreaTreeNode } from '@/lib/problem-bank/area-tree';
import { insertSource } from '@/lib/problem-bank/save';
import { uploadProblemFile } from '@/lib/problem-bank/storage';
import { sourcePdfPath } from '@/lib/problem-bank/storage-paths';
import {
  toSourcePayload, validateSourceForm, type SourceFormErrors, type SourceFormValues,
} from '@/lib/problem-bank/source-form';
import { planPageBatches } from '@/lib/problem-ocr/batch-plan';
import { OCR_CONFIRM_BATCH_THRESHOLD } from '@/lib/problem-ocr/constants';
import { kstYear } from '@/lib/kst-year';
import SourceMetaForm from '@/components/problem-ocr/SourceMetaForm';
import PdfPageSelect from '@/components/problem-ocr/PdfPageSelect';
import OcrProgress from '@/components/problem-ocr/OcrProgress';

const EMPTY_FORM: SourceFormValues = {
  source_type: '내신기출', title: '', school_name: '', year: String(kstYear()),
  grade: '', semester: '', exam_type: '', publisher: '',
};

/**
 * 기출 업로드 (`/problems/upload`).
 *
 * PDF → 쪽 역할 지정 → ChatGPT 로 읽기 → 검수 화면으로.
 * AI 는 **선생님 컴퓨터**에서 돌아간다. 묶음 하나가 ChatGPT 한 번이라
 * 시작 전에 몇 번 쓰는지 먼저 알린다.
 */
export default function ProblemUploadPage() {
  const router = useRouter();
  const ai = useAiEnabled();
  const ocr = useProblemOcr();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [values, setValues] = useState<SourceFormValues>(EMPTY_FORM);
  const [errors, setErrors] = useState<SourceFormErrors>({});
  const [schools, setSchools] = useState<string[]>([]);
  const [areaTree, setAreaTree] = useState<AreaTreeNode[]>([]);
  const [uploading, setUploading] = useState(false);

  const pdf = usePdfPages(file);

  useEffect(() => {
    getSchools().then((rows) => setSchools(rows.map((s) => s.name))).catch(() => setSchools([]));
  }, []);

  // 영역 마스터는 못 읽어도(정책 미적용 환경) 화면을 막지 않는다 — 자유 입력으로 떨어진다
  useEffect(() => {
    let alive = true;
    fetchAreaSets().then(async (sets) => {
      const setId = pickAreaSetForGrade(sets, values.grade);
      const tree = setId ? await fetchAreaTree(setId) : [];
      if (alive) setAreaTree(tree);
    });
    return () => { alive = false; };
  }, [values.grade]);

  const problemPages = useMemo(() => pdf.pagesWithRole('problem'), [pdf]);
  const answerPages = useMemo(() => pdf.pagesWithRole('answer'), [pdf]);
  const batchCount = useMemo(() => planPageBatches(problemPages).length, [problemPages]);

  const onChange = useCallback((patch: Partial<SourceFormValues>) => {
    setValues((v) => ({ ...v, ...patch }));
    setErrors({});
  }, []);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files?.[0] ?? null;
    if (picked && picked.type !== 'application/pdf') {
      toast.error('PDF 파일만 올릴 수 있어요.');
      return;
    }
    setFile(picked);
  };

  const handleStart = async () => {
    if (!file) return;

    const nextErrors = validateSourceForm(values);
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      toast.error('빠진 항목이 있어요.');
      return;
    }
    if (problemPages.length === 0) {
      toast.error('읽을 문제 쪽을 하나 이상 골라 주세요.');
      return;
    }

    // 묶음 하나 = 선생님 ChatGPT 한 번. 무심코 30쪽을 누르면 15번이 나간다
    if (batchCount >= OCR_CONFIRM_BATCH_THRESHOLD) {
      const ok = window.confirm(
        `${problemPages.length}쪽을 ${batchCount}묶음으로 읽어요.\n`
        + `선생님 ChatGPT 를 약 ${batchCount + (answerPages.length > 0 ? 1 : 0)}번 쓰고 몇 분 걸립니다.\n\n계속할까요?`,
      );
      if (!ok) return;
    }

    setUploading(true);
    const sourceId = crypto.randomUUID();
    const payload = toSourcePayload(values);

    try {
      const filePath = sourcePdfPath(sourceId);
      await uploadProblemFile(filePath, file, 'application/pdf');
      await insertSource(sourceId, payload, {
        file_path: filePath,
        page_count: pdf.pageCount,
        status: '추출중',
      });
    } catch (e) {
      setUploading(false);
      toast.error(e instanceof Error ? e.message : '업로드하지 못했어요.');
      return;
    }
    setUploading(false);

    const ok = await ocr.start({
      sourceId,
      file,
      meta: payload,
      problemPages,
      answerPages,
      areaTree,
    });

    // 실패해도 출처 행은 남는다 — 검수 화면에서 상태를 보고 다시 돌릴 수 있다
    router.push(`/problems/sources/${sourceId}`);
    if (!ok) toast.info('읽지 못한 부분은 검수 화면에서 다시 시도할 수 있어요.');
  };

  const busy = uploading || ocr.running;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">📤 기출 업로드</h1>
        <p className="mt-1 text-sm text-gray-500">
          학교 기출·모의고사·문제집 PDF 를 올리면 선생님 컴퓨터의 ChatGPT 가 읽어 문항으로 옮깁니다.
        </p>
      </div>

      {!ai.enabled && (
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
        <CardHeader><CardTitle className="text-base">1. 출처 정보</CardTitle></CardHeader>
        <CardContent>
          <SourceMetaForm values={values} errors={errors} schools={schools} onChange={onChange} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">2. PDF 고르기</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={busy}
            className="flex w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-300 p-8 text-gray-500 transition hover:border-primary hover:text-primary disabled:opacity-50"
          >
            <Upload className="h-8 w-8" />
            <span className="text-sm">{file ? file.name : 'PDF 파일을 고르세요'}</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf,.pdf"
            className="hidden"
            onChange={handleFile}
          />

          {pdf.error && <p className="text-sm text-red-600">{pdf.error}</p>}

          {pdf.pageCount > 0 && (
            <PdfPageSelect
              pageCount={pdf.pageCount}
              from={pdf.from}
              windowSize={pdf.windowSize}
              thumbnails={pdf.thumbnails}
              roles={pdf.roles}
              loading={pdf.loading}
              onRole={pdf.setRole}
              onRoleForWindow={pdf.setRoleForWindow}
              onShowFrom={pdf.showFrom}
            />
          )}
        </CardContent>
      </Card>

      {pdf.pageCount > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">3. 읽기</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-gray-600">
              문제 {problemPages.length}쪽 · 정답표 {answerPages.length}쪽 ·{' '}
              {batchCount}묶음 (ChatGPT 약 {batchCount + (answerPages.length > 0 ? 1 : 0)}번)
            </p>

            <OcrProgress progress={ocr.progress} label={ocr.progressLabel} warnings={ocr.warnings} />

            <div className="flex items-center gap-2">
              <Button type="button" onClick={handleStart} disabled={busy || !ai.enabled}>
                {busy ? '읽는 중…' : '읽기 시작'}
              </Button>
              {ocr.running && (
                <Button type="button" variant="outline" onClick={ocr.cancel}>
                  취소
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
