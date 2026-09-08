'use client';

import { useRef } from 'react';
import { toast } from 'sonner';
import { FileCheck2, Upload } from 'lucide-react';
import { pdfPageCount } from '@/lib/pdf/pdfPages';
import {
  answerKeySummary, pickAnswerKeyFiles, type AnswerKeyInput,
} from '@/lib/problem-ocr/answer-key-input';

interface SourceFilePickersProps {
  file: File | null;
  onFile: (file: File | null) => void;
  answerKey: AnswerKeyInput | null;
  onAnswerKey: (input: AnswerKeyInput | null) => void;
  /** 답지 PDF 쪽 수를 세는 중인지 알린다 — 그동안 읽기를 시작하면 답지가 빠진다 */
  onPending: (pending: boolean) => void;
  disabled?: boolean;
}

/**
 * 시험지 PDF 와 (선택) 답지를 고르는 두 칸.
 *
 * 답지는 **따로 오는 일이 흔하다** — 별지 PDF 로 받거나 휴대폰으로 찍어 온다.
 * 같은 PDF 안에 붙어 있으면 여기 말고 아래 쪽 선택에서 '정답표' 로 지정하면 된다.
 */
export default function SourceFilePickers({
  file, onFile, answerKey, onAnswerKey, onPending, disabled,
}: SourceFilePickersProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const answerInputRef = useRef<HTMLInputElement>(null);
  /**
   * 지금 유효한 답지 선택의 세대.
   *
   * ⚠️ PDF 쪽 수는 문서를 열어 봐야 안다. 큰 PDF 를 고른 뒤 곧바로 사진으로 바꾸면
   *    **두 요청이 다 살아 있고**, 먼저 시작한 PDF 가 나중에 끝나며 새 선택을 덮어쓴다
   *    (usePdfPages 가 같은 이유로 쓰는 규약, 코덱스 리뷰 P2).
   */
  const answerGenRef = useRef(0);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files?.[0] ?? null;
    if (picked && picked.type !== 'application/pdf') {
      toast.error('PDF 파일만 올릴 수 있어요.');
      return;
    }
    onFile(picked);
  };

  const handleAnswerKey = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = [...(e.target.files ?? [])];
    // 같은 파일을 다시 고를 수 있게 값을 비운다(취소했다가 되고르는 흐름)
    e.target.value = '';
    if (picked.length === 0) return;

    const result = pickAnswerKeyFiles(picked);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    // 새 선택이 들어왔다 — 앞서 시작한 쪽 수 세기는 이 순간부터 무효다
    const gen = ++answerGenRef.current;

    if (result.kind === 'images') {
      onPending(false);
      onAnswerKey({ kind: 'images', files: result.files });
      return;
    }

    // 쪽 수는 문서를 열어 봐야 안다 — setState 는 반드시 .then 안에서만 한다
    onPending(true);
    pdfPageCount({ kind: 'file', file: result.file })
      .then((pageCount) => {
        if (answerGenRef.current !== gen) return;
        onAnswerKey({ kind: 'pdf', file: result.file, pageCount });
      })
      .catch(() => {
        if (answerGenRef.current === gen) toast.error('답지 PDF 를 열지 못했어요.');
      })
      .finally(() => {
        if (answerGenRef.current === gen) onPending(false);
      });
  };

  /** 고른 답지를 버린다. 진행 중인 쪽 수 세기도 함께 무효로 만든다 */
  const clearAnswerKey = () => {
    answerGenRef.current += 1;
    onPending(false);
    onAnswerKey(null);
  };

  const answerNames = answerKey
    ? (answerKey.kind === 'pdf' ? [answerKey.file.name] : answerKey.files.map((f) => f.name))
    : [];

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={disabled}
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

      <div className="space-y-2">
        <button
          type="button"
          onClick={() => answerInputRef.current?.click()}
          disabled={disabled}
          className="flex w-full flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-gray-200 p-5 text-gray-400 transition hover:border-primary hover:text-primary disabled:opacity-50"
        >
          <FileCheck2 className="h-6 w-6" />
          <span className="text-sm">
            {answerKey ? answerKeySummary(answerKey) : '답지 (선택) — PDF 하나 또는 사진 여러 장'}
          </span>
          <span className="text-xs text-gray-400">
            같은 PDF 안에 붙어 있으면 아래에서 그 쪽을 &lsquo;정답표&rsquo;로 지정하세요
          </span>
        </button>
        <input
          ref={answerInputRef}
          type="file"
          multiple
          accept="application/pdf,image/jpeg,image/png,.pdf,.jpg,.jpeg,.png"
          className="hidden"
          onChange={handleAnswerKey}
        />

        {answerKey && (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 px-1 text-xs text-gray-500">
            <span className="truncate">{answerNames.join(', ')}</span>
            <button
              type="button"
              className="text-primary underline underline-offset-2"
              onClick={clearAnswerKey}
              disabled={disabled}
            >
              지우기
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
