'use client';

import { useMemo } from 'react';
import { FileText } from 'lucide-react';
import { useSignedImageUrls } from '@/hooks/useSignedImageUrls';
import { sourcePagePaths } from '@/lib/problem-bank/exam-view-files';
import type { ProblemSource } from '@/types/problem-bank';

interface ExamOriginalTabProps {
  source: Pick<ProblemSource, 'id' | 'page_count' | 'file_path'>;
}

/**
 * 읽기 전용 시험 보기의 '원본' 탭 — 적재할 때 만든 쪽 이미지를 위에서 아래로, 그리고 원본 PDF 를 새 탭에서.
 *
 * 탭을 열 때만 마운트되므로 쪽 이미지 서명도 그때 한 번이다(한 시험지가 30쪽까지 간다).
 * PDF 를 화면 안에 끼우지 않는 까닭은 CSP(`frame-src` 없음)다 — 쪽 이미지가 같은 내용이다.
 */
export default function ExamOriginalTab({ source }: ExamOriginalTabProps) {
  const pagePaths = useMemo(() => sourcePagePaths(source), [source]);
  const paths = useMemo(
    () => (source.file_path ? [source.file_path, ...pagePaths] : pagePaths),
    [source.file_path, pagePaths],
  );
  const signed = useSignedImageUrls(paths);
  const pdfUrl = source.file_path ? signed.urls.get(source.file_path) : undefined;
  const missingPages = signed.missing.filter((p) => p !== source.file_path).length;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span className="text-gray-500">원본 {pagePaths.length}쪽</span>
        {pdfUrl && (
          <a
            href={pdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 font-semibold text-ink underline underline-offset-2"
          >
            <FileText className="h-4 w-4" aria-hidden="true" />
            원본 PDF 새 탭에서 열기
          </a>
        )}
        {!signed.loading && missingPages > 0 && (
          <span className="text-xs text-amber-700">
            {missingPages}쪽을 불러오지 못했어요.{' '}
            <button type="button" onClick={signed.reload} className="underline underline-offset-2">다시 불러오기</button>
          </span>
        )}
      </div>

      {pagePaths.length === 0 ? (
        <p className="py-12 text-center text-sm text-gray-500">쪽 이미지가 없어요. 원본 PDF 를 열어 보세요.</p>
      ) : (
        <ol className="space-y-3">
          {pagePaths.map((path, i) => {
            const url = signed.urls.get(path);
            return (
              <li key={path} className="rounded-lg border border-gray-200 bg-card p-2">
                <p className="mb-1 font-label text-xs font-bold text-gray-500">{i + 1} / {pagePaths.length}</p>
                {url ? (
                  // 서명 URL 이라 next/image 최적화 대상이 아니다
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={url} alt={`원본 ${i + 1}쪽`} loading="lazy" className="w-full" />
                ) : (
                  <div className="flex aspect-[1/1.414] items-center justify-center text-xs text-gray-400">
                    {signed.loading ? '불러오는 중…' : '이 쪽을 불러오지 못했어요.'}
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
