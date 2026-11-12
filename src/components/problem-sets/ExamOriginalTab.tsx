'use client';

import { useMemo } from 'react';
import { useImageResign } from '@/hooks/useImageResign';
import { useSignedImageUrls } from '@/hooks/useSignedImageUrls';
import { sourcePagePaths } from '@/lib/problem-bank/exam-view-files';
import type { ProblemSource } from '@/types/problem-bank';
import SignedFileButton from './SignedFileButton';

interface ExamOriginalTabProps {
  source: Pick<ProblemSource, 'id' | 'page_count' | 'file_path'>;
}

/**
 * 읽기 전용 시험 보기의 '원본' 탭 — 적재할 때 만든 쪽 이미지를 위에서 아래로, 그리고 원본 PDF 를 새 탭에서.
 *
 * 탭을 열 때만 마운트되므로 쪽 이미지 서명도 그때 한 번이다(한 시험지가 30쪽까지 간다).
 * PDF 를 화면 안에 끼우지 않는 까닭은 CSP(`frame-src` 없음)다 — 쪽 이미지가 같은 내용이다.
 * ⚠️ 쪽 이미지는 지연 로딩이라 오래 열어 둔 뒤 내리면 만료된 주소로 깨진다 — 깨진 쪽만 다시 서명한다(`useImageResign`, 코덱스 2R).
 *    PDF 는 누를 때 서명한다(`SignedFileButton`).
 */
export default function ExamOriginalTab({ source }: ExamOriginalTabProps) {
  const pagePaths = useMemo(() => sourcePagePaths(source), [source]);
  const signed = useSignedImageUrls(pagePaths);
  const pages = useImageResign(signed.urls);
  /** 못 불러온 쪽 — 다시 서명해도 깨졌거나, 처음 서명이 끝났는데 주소가 없고 다시 받는 중도 아닌 쪽 */
  const failed = (path: string) => pages.broken.has(path)
    || (!signed.loading && !pages.urlOf(path) && !pages.pending.has(path));
  const failedCount = pagePaths.filter(failed).length;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span className="text-gray-500">원본 {pagePaths.length}쪽</span>
        {source.file_path && <SignedFileButton path={source.file_path}>원본 PDF 새 탭에서 열기</SignedFileButton>}
        {failedCount > 0 && (
          <span className="text-xs text-amber-700">
            {failedCount}쪽을 불러오지 못했어요. 그 쪽의 &lsquo;다시 불러오기&rsquo;를 눌러 주세요.
          </span>
        )}
      </div>

      {pagePaths.length === 0 ? (
        <p className="py-12 text-center text-sm text-gray-500">쪽 이미지가 없어요. 원본 PDF 를 열어 보세요.</p>
      ) : (
        <ol className="space-y-3">
          {pagePaths.map((path, i) => {
            const url = pages.urlOf(path);
            const broken = failed(path);
            return (
              <li key={path} className="rounded-lg border border-gray-200 bg-card p-2">
                <p className="mb-1 font-label text-xs font-bold text-gray-500">{i + 1} / {pagePaths.length}</p>
                {url && !pages.broken.has(path) ? (
                  // 서명 URL 이라 next/image 최적화 대상이 아니다
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={url}
                    alt={`원본 ${i + 1}쪽`}
                    loading="lazy"
                    className="w-full"
                    onError={() => pages.onError(path)}
                    onLoad={() => pages.onLoad(path)}
                  />
                ) : (
                  <div className="flex aspect-[1/1.414] flex-col items-center justify-center gap-2 text-xs text-gray-400">
                    {broken ? (
                      <>
                        <span>이 쪽을 불러오지 못했어요.</span>
                        <button
                          type="button"
                          onClick={() => pages.retry(path)}
                          className="font-semibold text-ink underline underline-offset-2"
                        >
                          다시 불러오기
                        </button>
                      </>
                    ) : '불러오는 중…'}
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
