'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import type { SignedImages } from '@/hooks/useSignedImageUrls';
import PagePreviewDialog from './PagePreviewDialog';

interface PrintPageStripProps {
  /** 묶음이 덮는 쪽 번호 */
  pages: number[];
  /** pages 와 **같은 순서**의 Storage 경로 (못 올린 쪽은 '') */
  paths: string[];
  images: SignedImages;
}

/**
 * 편집기 옆에 세로로 세워 두는 원본 쪽 이미지.
 *
 * 이게 없으면 잘못 읽은 글자를 알아챌 방법이 없다 — 기출 검수 화면의 원본 대조와 같은
 * 근거다. 다만 여기서는 좌표·상자가 없어 `PageImageWithBoxes` 대신 단순한 목록이다.
 *
 * 패널이 좁아 작은 글씨는 이대로 대조하기 어렵다 — 누르면 크게 본다(업로드 화면의 썸네일과
 * 같은 창). 여기서는 **이미 올려 둔 원본 이미지**를 그대로 쓰므로 다시 그리지 않는다.
 */
export default function PrintPageStrip({ pages, paths, images }: PrintPageStripProps) {
  const [preview, setPreview] = useState<number | null>(null);
  const previewPath = preview === null ? '' : (paths[pages.indexOf(preview)] ?? '');
  const previewUrl = previewPath ? images.urls.get(previewPath) : undefined;

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
        <h3 className="text-base font-bold text-gray-900">원본</h3>
        <span className="text-xs text-gray-500">{pages.length}쪽</span>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-3">
        {images.missing.length > 0 && (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
            <p>원본 이미지를 불러오지 못했어요.</p>
            <Button type="button" variant="outline" size="sm" className="mt-1.5" onClick={images.reload}>
              다시 시도
            </Button>
          </div>
        )}

        {pages.map((page, i) => {
          const path = paths[i] ?? '';
          const url = path ? images.urls.get(path) : undefined;
          return (
            <figure key={page} className="space-y-1">
              <figcaption className="text-xs font-medium text-gray-500">{page}쪽</figcaption>
              {url ? (
                <button
                  type="button"
                  onClick={() => setPreview(page)}
                  className="block w-full"
                  aria-label={`${page}쪽 크게 보기`}
                >
                  {/* 서명 URL 이라 만료된다 — next/image 최적화 캐시에 넣지 않는다 */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt={`${page}쪽 원본`} className="block w-full rounded border border-gray-200" />
                </button>
              ) : (
                <div className="flex h-32 items-center justify-center rounded border border-dashed border-gray-200 text-xs text-gray-400">
                  {images.loading ? '불러오는 중…' : '이미지 없음'}
                </div>
              )}
            </figure>
          );
        })}
      </div>

      <PagePreviewDialog
        page={preview}
        pages={pages}
        src={previewUrl ?? null}
        loading={images.loading && !previewUrl}
        onClose={() => setPreview(null)}
        onNavigate={setPreview}
      />
    </div>
  );
}
