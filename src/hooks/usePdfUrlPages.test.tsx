import { describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

const destroy = vi.fn();
const openPdfSource = vi.fn();
const pdfPagePreview = vi.fn(async (_doc: unknown, page: number) => `data:image/jpeg;page=${page}`);
vi.mock('@/lib/pdf/pdfPages', () => ({
  openPdfSource: (src: unknown) => openPdfSource(src),
  pdfPagePreview: (doc: unknown, page: number) => pdfPagePreview(doc, page),
}));

const { PDF_VIEW_MAX_PAGES, usePdfUrlPages } = await import('./usePdfUrlPages');

describe('usePdfUrlPages', () => {
  it('서명 URL 로 열어 쪽마다 그리고 문서를 닫는다', async () => {
    openPdfSource.mockReset().mockResolvedValue({ numPages: 2, pdf: { destroy } });
    destroy.mockClear();
    const hook = renderHook(() => usePdfUrlPages('https://signed/key.pdf'));
    expect(hook.result.current.loading).toBe(true);
    await waitFor(() => expect(hook.result.current.pages).toHaveLength(2));
    expect(openPdfSource).toHaveBeenCalledWith({ kind: 'url', url: 'https://signed/key.pdf' });
    expect(hook.result.current.total).toBe(2);
    await waitFor(() => expect(destroy).toHaveBeenCalled());
  });

  it(`${PDF_VIEW_MAX_PAGES}쪽까지만 그리고 전체 쪽 수는 알린다`, async () => {
    openPdfSource.mockReset().mockResolvedValue({ numPages: 40, pdf: { destroy } });
    const hook = renderHook(() => usePdfUrlPages('https://signed/long.pdf'));
    await waitFor(() => expect(hook.result.current.loading).toBe(false));
    expect(hook.result.current.pages).toHaveLength(PDF_VIEW_MAX_PAGES);
    expect(hook.result.current.total).toBe(40);
  });

  it('열지 못하면 오류를 알린다', async () => {
    openPdfSource.mockReset().mockRejectedValue(new Error('cors'));
    const hook = renderHook(() => usePdfUrlPages('https://signed/broken.pdf'));
    await waitFor(() => expect(hook.result.current.error).toBe('PDF 를 그리지 못했어요.'));
    expect(hook.result.current.pages).toEqual([]);
  });

  it('URL 이 없으면(서명 대기) 아무것도 하지 않는다', () => {
    openPdfSource.mockReset();
    const hook = renderHook(() => usePdfUrlPages(null));
    expect(hook.result.current.loading).toBe(false);
    expect(openPdfSource).not.toHaveBeenCalled();
  });
});
