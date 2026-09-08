'use client';

import { useCallback, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAiEnabled } from '@/hooks/useAiEnabled';
import { usePdfPages } from '@/hooks/usePdfPages';
import { useProblemOcr } from '@/hooks/useProblemOcr';
import { useSourceMasters } from '@/hooks/useSourceMasters';
import { insertSource } from '@/lib/problem-bank/save';
import { uploadProblemFile } from '@/lib/problem-bank/storage';
import { sourcePdfPath } from '@/lib/problem-bank/storage-paths';
import {
  applySourcePatch, toSourcePayload, validateSourceForm,
  type SourceFormErrors, type SourceFormValues,
} from '@/lib/problem-bank/source-form';
import { planPageBatches } from '@/lib/problem-ocr/batch-plan';
import {
  answerKeyBatchCount, answerKeySummary, type AnswerKeyInput,
} from '@/lib/problem-ocr/answer-key-input';
import { uploadAnswerKey } from '@/lib/problem-ocr/answer-key-upload';
import { OCR_CONFIRM_BATCH_THRESHOLD } from '@/lib/problem-ocr/constants';
import { kstYear } from '@/lib/kst-year';
import SourceMetaForm from '@/components/problem-ocr/SourceMetaForm';
import SourceFilePickers from '@/components/problem-ocr/SourceFilePickers';
import PdfPageSelect from '@/components/problem-ocr/PdfPageSelect';
import OcrProgress from '@/components/problem-ocr/OcrProgress';

const EMPTY_FORM: SourceFormValues = {
  source_type: '내신기출', level: '중등', title: '', school_name: '', school_id: '',
  textbook: '', year: String(kstYear()), grade: '', semester: '', exam_type: '', publisher: '',
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

  const [file, setFile] = useState<File | null>(null);
  /** 따로 올린 답지 (PDF 하나 또는 사진 여러 장) */
  const [answerKey, setAnswerKey] = useState<AnswerKeyInput | null>(null);
  /**
   * 답지 PDF 의 쪽 수를 세는 중.
   *
   * ⚠️ 이때 읽기를 시작하면 `answerKey` 가 아직 null 이라 **답지가 조용히 빠진다** —
   *    정답이 안 채워진 이유를 아무도 알 수 없다(코덱스 리뷰 P2).
   */
  const [answerKeyPending, setAnswerKeyPending] = useState(false);
  /**
   * 폼 값과 '제목을 아직 손대지 않았는가'를 **한 덩어리로** 들고 있는다.
   * 따로 두면 값 갱신 함수 안에서 다른 state 를 만지게 되는데, 그 갱신 함수는
   * 순수해야 한다(React 가 두 번 부를 수 있다). `applySourcePatch` 가 둘을 함께 돌려준다.
   */
  const [form, setForm] = useState({ values: EMPTY_FORM, titleAuto: true });
  const [errors, setErrors] = useState<SourceFormErrors>({});
  const [uploading, setUploading] = useState(false);

  const values = form.values;
  const pdf = usePdfPages(file);

  const onChange = useCallback((patch: Partial<SourceFormValues>) => {
    setForm((f) => applySourcePatch(f.values, patch, f.titleAuto));
    setErrors({});
  }, []);

  // 마스터(학교·교과서·영역·단원)와 내신 범위 힌트는 훅 하나가 맡는다
  const masters = useSourceMasters(values, useCallback(
    (textbook: string) => onChange({ textbook }),
    [onChange],
  ));

  const problemPages = useMemo(() => pdf.pagesWithRole('problem'), [pdf]);
  const answerPages = useMemo(() => pdf.pagesWithRole('answer'), [pdf]);
  const batchCount = useMemo(() => planPageBatches(problemPages).length, [problemPages]);
  // 정답표 묶음 = 원본 안 정답표 쪽 + 따로 올린 답지. 둘 다 ChatGPT 를 쓴다
  const answerBatches = useMemo(
    () => answerKeyBatchCount(answerPages, answerKey),
    [answerPages, answerKey],
  );

  const handleStart = async () => {
    if (!file) return;
    // 새 파일이 아직 안 열렸으면 옛 쪽 선택으로 시작될 수 있다
    if (!pdf.ready) {
      toast.error('PDF 를 여는 중이에요. 잠시 뒤에 다시 눌러 주세요.');
      return;
    }

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
    if (answerKeyPending) {
      toast.error('답지를 여는 중이에요. 잠시 뒤에 다시 눌러 주세요.');
      return;
    }

    // 묶음 하나 = 선생님 ChatGPT 한 번. 무심코 30쪽을 누르면 15번이 나간다
    if (batchCount >= OCR_CONFIRM_BATCH_THRESHOLD) {
      const ok = window.confirm(
        `${problemPages.length}쪽을 ${batchCount}묶음으로 읽어요.\n`
        + `선생님 ChatGPT 를 약 ${batchCount + answerBatches}번 쓰고 몇 분 걸립니다.\n\n계속할까요?`,
      );
      if (!ok) return;
    }

    setUploading(true);
    const sourceId = crypto.randomUUID();
    const payload = toSourcePayload(values);

    try {
      const filePath = sourcePdfPath(sourceId);
      await uploadProblemFile(filePath, file, 'application/pdf');
      // 답지를 먼저 올려 둔다 — 출처 행에 경로를 함께 남겨야 검수에서 다시 볼 수 있다
      const answerKeyPaths = answerKey ? await uploadAnswerKey(sourceId, answerKey) : [];
      await insertSource(sourceId, payload, {
        file_path: filePath,
        page_count: pdf.pageCount,
        status: '추출중',
        answer_key_paths: answerKeyPaths,
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
      answerKey,
      areaTree: masters.areaTree,
      unitTree: masters.unitTree,
      // '안 보는 시험'의 잠긴 옛 범위는 힌트에서 이미 비워져 온다
      scopeUnits: masters.scope?.units ?? [],
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
          <SourceMetaForm
            values={values}
            errors={errors}
            schools={masters.schools}
            textbooks={masters.textbooks}
            scope={masters.scope}
            onChange={onChange}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">2. PDF 고르기</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <SourceFilePickers
            file={file}
            onFile={setFile}
            answerKey={answerKey}
            onAnswerKey={setAnswerKey}
            onPending={setAnswerKeyPending}
            disabled={busy}
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
              onRoleForLast={pdf.setRoleForLast}
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
              문제 {problemPages.length}쪽 · 정답표 {answerPages.length}쪽
              {answerKey && ` · ${answerKeySummary(answerKey)}`} ·{' '}
              {batchCount}묶음 (ChatGPT 약 {batchCount + answerBatches}번)
            </p>

            <OcrProgress progress={ocr.progress} label={ocr.progressLabel} warnings={ocr.warnings} />

            <div className="flex items-center gap-2">
              <Button
                type="button"
                onClick={handleStart}
                disabled={busy || !ai.enabled || !pdf.ready || answerKeyPending}
              >
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
