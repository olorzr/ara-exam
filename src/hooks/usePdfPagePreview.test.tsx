import { describe, expect, it, vi, beforeEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';

const destroy = vi.fn();
const openPdfSource = vi.fn();
const pdfPagePreview = vi.fn();

vi.mock('@/lib/pdf/pdfPages', () => ({
  openPdfSource: (...args: unknown[]) => openPdfSource(...args),
  pdfPagePreview: (...args: unknown[]) => pdfPagePreview(...args),
}));

const { usePdfPagePreview } = await import('./usePdfPagePreview');

const file = new File(['%PDF-1.4'], 'scan.pdf', { type: 'application/pdf' });

beforeEach(() => {
  destroy.mockClear();
  openPdfSource.mockReset().mockResolvedValue({ pdf: { destroy }, numPages: 3 });
  pdfPagePreview.mockReset().mockResolvedValue('data:image/jpeg;base64,x');
});

describe('usePdfPagePreview', () => {
  it('닫혀 있으면 PDF 를 열지 않는다 — 창을 안 열었는데 파일을 복사할 이유가 없다', () => {
    renderHook(() => usePdfPagePreview(file, null));
    expect(openPdfSource).not.toHaveBeenCalled();
  });

  it('고른 쪽을 그려 준다', async () => {
    const { result } = renderHook(() => usePdfPagePreview(file, 2));
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.src).toBe('data:image/jpeg;base64,x'));
    expect(result.current.loading).toBe(false);
    expect(pdfPagePreview).toHaveBeenCalledWith({ pdf: { destroy }, numPages: 3 }, 2);
  });

  it('쪽을 넘겨도 문서를 다시 열지 않는다 — 열 때마다 파일 전체를 복사한다', async () => {
    const { result, rerender } = renderHook(
      ({ page }: { page: number }) => usePdfPagePreview(file, page),
      { initialProps: { page: 2 } },
    );
    await waitFor(() => expect(result.current.src).toBeTruthy());

    rerender({ page: 3 });
    await waitFor(() => expect(pdfPagePreview).toHaveBeenCalledTimes(2));
    expect(openPdfSource).toHaveBeenCalledTimes(1);
  });

  it('화면을 떠나면 열어 둔 문서를 닫는다', async () => {
    const { result, unmount } = renderHook(() => usePdfPagePreview(file, 1));
    await waitFor(() => expect(result.current.src).toBeTruthy());

    unmount();
    await waitFor(() => expect(destroy).toHaveBeenCalledTimes(1));
  });

  /**
   * 이 테스트가 고정하는 것(코덱스 리뷰): 그리는 데 실패했다고 **열어 둔 문서를 놓으면**
   * 정리가 그 문서를 못 찾아 `destroy` 를 영영 못 한다 — 실패를 되풀이할수록 쌓인다.
   */
  it('그리는 데만 실패해도 문서는 계속 들고 있다가 떠날 때 닫는다', async () => {
    pdfPagePreview.mockRejectedValue(new Error('render failed'));
    const { result, unmount } = renderHook(() => usePdfPagePreview(file, 1));
    await waitFor(() => expect(result.current.error).toBeTruthy());

    unmount();
    await waitFor(() => expect(destroy).toHaveBeenCalledTimes(1));
  });

  it('여는 데 실패하면 그 문서를 붙들지 않는다 — 다음 쪽이 같은 실패를 물려받는다', async () => {
    openPdfSource.mockRejectedValue(new Error('open failed'));
    const { result, rerender } = renderHook(
      ({ page }: { page: number }) => usePdfPagePreview(file, page),
      { initialProps: { page: 1 } },
    );
    await waitFor(() => expect(result.current.error).toBeTruthy());

    openPdfSource.mockResolvedValue({ pdf: { destroy }, numPages: 3 });
    await act(async () => { rerender({ page: 2 }); });
    await waitFor(() => expect(result.current.src).toBeTruthy());
    expect(openPdfSource).toHaveBeenCalledTimes(2);
  });
});
