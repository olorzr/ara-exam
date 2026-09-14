'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogDescription, DialogTitle,
} from '@/components/ui/dialog';
import { neighborPages } from '@/lib/print-scan/page-preview';

interface PagePreviewDialogProps {
  /** 크게 볼 쪽. null 이면 창이 닫혀 있다 */
  page: number | null;
  /** 앞뒤로 넘길 수 있는 쪽 목록 (보이는 차례 그대로) */
  pages: readonly number[];
  src: string | null;
  loading: boolean;
  error?: string | null;
  onClose: () => void;
  onNavigate: (page: number) => void;
}

/**
 * 쪽 하나를 크게 보는 창.
 *
 * 썸네일은 가로 200px 남짓이라 "이 쪽이 어느 프린트의 몇 쪽인지" 를 분간할 수 없을 때가 있다.
 * 그렇다고 썸네일 판을 키우면 한 화면에 몇 장 안 들어와 묶는 일 자체가 번거로워진다 —
 * 판은 그대로 두고 **필요할 때만** 크게 본다.
 *
 * 그림을 만드는 일은 호출부가 한다(업로드 화면은 PDF 를 다시 그리고, 편집 화면은 이미
 * 올려 둔 원본 이미지를 그대로 쓴다). 여기는 보여 주고 앞뒤로 넘기기만 한다.
 */
export default function PagePreviewDialog({
  page, pages, src, loading, error, onClose, onNavigate,
}: PagePreviewDialogProps) {
  const { prev, next } = neighborPages(pages, page);

  return (
    <Dialog open={page !== null} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent
        className="sm:max-w-4xl"
        // 창 안에 포커스가 있으므로 화살표가 그대로 들어온다 — 한 장씩 넘겨 보는 일이 잦다
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft' && prev !== null) onNavigate(prev);
          if (e.key === 'ArrowRight' && next !== null) onNavigate(next);
        }}
      >
        <div className="flex items-center gap-2 pr-8">
          <DialogTitle className="flex-1">{page}쪽</DialogTitle>
          <Button
            type="button" variant="outline" size="sm"
            onClick={() => prev !== null && onNavigate(prev)}
            disabled={prev === null}
            aria-label="앞 쪽"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            type="button" variant="outline" size="sm"
            onClick={() => next !== null && onNavigate(next)}
            disabled={next === null}
            aria-label="다음 쪽"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <DialogDescription className="sr-only">
          ← → 키로 앞뒤 쪽을 볼 수 있어요.
        </DialogDescription>

        {error ? (
          <p className="py-10 text-center text-sm text-red-600">{error}</p>
        ) : src ? (
          // data URL·서명 URL 이라 next/image 최적화 캐시에 넣지 않는다
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt={`${page}쪽 크게 보기`}
            className="mx-auto max-h-[75vh] w-auto max-w-full rounded border border-gray-200 object-contain"
          />
        ) : (
          <div className="flex h-[60vh] items-center justify-center rounded border border-dashed border-gray-200 text-sm text-gray-400">
            {loading ? '불러오는 중…' : '이미지가 없어요.'}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
