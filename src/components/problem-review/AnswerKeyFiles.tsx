'use client';

import { FileText } from 'lucide-react';
import { useSignedImageUrls } from '@/hooks/useSignedImageUrls';

interface AnswerKeyFilesProps {
  /** `problem_sources.answer_key_paths` */
  paths: string[];
}

/**
 * 따로 올린 답지 보기.
 *
 * 정답이 이상할 때 **무엇을 보고 읽었는지** 확인할 길이 있어야 한다. 원본 PDF 안의
 * 정답표 쪽은 왼쪽 쪽 목록에 이미 나오지만, 따로 올린 답지는 그 목록에 없다
 * (일부러 다른 경로 가족을 쓴다 — 쪽 번호가 겹치면 원본 대조가 망가진다).
 */
export default function AnswerKeyFiles({ paths }: AnswerKeyFilesProps) {
  const signed = useSignedImageUrls(paths);
  if (paths.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm text-gray-500">답지</span>
      {paths.map((path, i) => {
        const url = signed.urls.get(path);
        if (!url) return null;
        const isPdf = path.toLowerCase().endsWith('.pdf');
        return (
          <a
            key={path}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-primary underline underline-offset-2"
          >
            {isPdf ? (
              <>
                <FileText className="h-3.5 w-3.5" />
                답지 PDF 열기
              </>
            ) : (
              // 서명 URL 이라 next/image 최적화 대상이 아니다
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={url}
                alt={`답지 ${i + 1}`}
                className="h-16 w-12 rounded border border-gray-200 object-cover object-top"
              />
            )}
          </a>
        );
      })}
      {!signed.loading && signed.missing.length > 0 && (
        <span className="text-xs text-amber-600">일부 답지를 열지 못했어요.</span>
      )}
    </div>
  );
}
