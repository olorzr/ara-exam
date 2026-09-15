'use client';

import { useEffect, useRef, useState } from 'react';
import { FileText, FileUp } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { readPdfTextLayer, readTextFile } from '@/lib/reference-texts/import';
import { pdfImportVerdict } from '@/lib/reference-texts/import-text';

/**
 * 파일에서 전문 가져오기 — `.txt` 와 **글자가 박힌** PDF.
 *
 * ⚠️ 스캔한 PDF(사진으로 찍힌 글)는 이 길로 한 글자도 못 읽는다. 그때 "못 읽었어요" 로
 *    끝내면 선생님은 파일이 잘못된 줄 알고 몇 번이고 다시 고른다 — 갈 길(학교 프린트
 *    시험지)을 함께 알려 준다(`pdfImportVerdict`).
 */

interface ReferenceTextImportProps {
  /** 지금 본문에 글이 있는가 — 덮어쓰기 전에 물어야 한다 */
  hasBody: boolean;
  onText: (text: string) => void;
}

/**
 * 가져오기 버튼 두 개를 그린다.
 * @param props - 본문 유무와 가져온 글을 받을 콜백
 * @returns 가져오기 줄
 */
export default function ReferenceTextImport({ hasBody, onText }: ReferenceTextImportProps) {
  const [busy, setBusy] = useState(false);
  const txtRef = useRef<HTMLInputElement | null>(null);
  const pdfRef = useRef<HTMLInputElement | null>(null);
  /**
   * 본문이 있는가 — **지금 값**.
   *
   * ⚠️ PDF 한 편을 읽는 데 몇 초가 걸리고, 그동안 입력칸은 살아 있다(코덱스 리뷰).
   *    닫아 둔 prop 을 보면 **읽기 시작할 때 비어 있었다**는 이유로 그 사이 친 글을
   *    **묻지도 않고 덮는다.** 그래서 넣는 시점의 값을 ref 로 다시 읽는다
   *    (ref 쓰기는 렌더가 아니라 효과에서 — `react-hooks/refs`).
   */
  const hasBodyRef = useRef(hasBody);
  useEffect(() => { hasBodyRef.current = hasBody; }, [hasBody]);

  /** 가져온 글을 넣는다. 이미 쓴 글이 있으면 먼저 묻는다 */
  const apply = (text: string) => {
    if (text.trim() === '') {
      toast.error('파일에서 글자를 찾지 못했어요.');
      return;
    }
    if (hasBodyRef.current && !window.confirm('붙여 넣은 본문을 파일 내용으로 바꿀까요?')) return;
    onText(text);
  };

  /** 고른 파일을 읽는다. 같은 파일을 다시 고를 수 있게 값을 비운다 */
  const pick = (input: HTMLInputElement | null, job: (file: File) => Promise<void>) => {
    const file = input?.files?.[0];
    if (input) input.value = '';
    if (!file) return;
    setBusy(true);
    job(file)
      .catch((e) => toast.error(e instanceof Error ? e.message : '파일을 읽지 못했어요.'))
      .finally(() => setBusy(false));
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        ref={txtRef}
        type="file"
        accept=".txt,text/plain"
        className="hidden"
        aria-label="텍스트 파일 고르기"
        onChange={() => pick(txtRef.current, async (file) => {
          apply(await readTextFile(file));
        })}
      />
      <input
        ref={pdfRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        aria-label="PDF 파일 고르기"
        onChange={() => pick(pdfRef.current, async (file) => {
          const layer = await readPdfTextLayer(file);
          const verdict = pdfImportVerdict(layer);
          toast[verdict.level](verdict.text);
          if (verdict.level !== 'error') apply(layer.text);
        })}
      />

      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={busy}
        onClick={() => txtRef.current?.click()}
      >
        <FileText className="h-3.5 w-3.5" />
        <span className="ml-1">텍스트 파일</span>
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={busy}
        onClick={() => pdfRef.current?.click()}
      >
        <FileUp className="h-3.5 w-3.5" />
        <span className="ml-1">PDF 에서 가져오기</span>
      </Button>
      {busy && <span className="text-xs text-primary">읽는 중…</span>}
      <span className="text-xs text-gray-400">
        스캔한 PDF(사진으로 찍힌 글)는 못 읽어요 — 학교 프린트 시험지로 올려 주세요.
      </span>
    </div>
  );
}
