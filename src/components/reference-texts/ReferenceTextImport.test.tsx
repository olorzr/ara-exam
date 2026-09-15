import { describe, expect, it, vi, beforeEach } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';

const readPdfTextLayer = vi.fn();
const readTextFile = vi.fn();
const toastError = vi.fn();

vi.mock('@/lib/reference-texts/import', () => ({
  readPdfTextLayer: (...args: unknown[]) => readPdfTextLayer(...args),
  readTextFile: (...args: unknown[]) => readTextFile(...args),
}));
vi.mock('sonner', () => ({
  toast: {
    error: (...args: unknown[]) => toastError(...args),
    warning: vi.fn(),
    success: vi.fn(),
  },
}));

const { default: ReferenceTextImport } = await import('./ReferenceTextImport');

/** 손으로 풀 수 있는 약속 — 읽는 동안 사람이 글을 치는 상황을 만든다 */
function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((res) => { resolve = res; });
  return { promise, resolve };
}

const pdf = new File(['%PDF-1.4'], '봄봄.pdf', { type: 'application/pdf' });

/** 숨은 파일 입력칸에 파일을 넣고 change 를 일으킨다 */
function choose(label: string, file: File) {
  const input = screen.getByLabelText(label) as HTMLInputElement;
  Object.defineProperty(input, 'files', { value: [file], configurable: true });
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

beforeEach(() => {
  readPdfTextLayer.mockReset();
  readTextFile.mockReset();
  toastError.mockReset();
  vi.spyOn(window, 'confirm').mockReturnValue(true);
});

describe('ReferenceTextImport', () => {
  it('본문이 비어 있으면 묻지 않고 넣는다', async () => {
    readPdfTextLayer.mockResolvedValue({ text: '읽어 온 글', pageCount: 2, pagesWithText: 2 });
    const onText = vi.fn();
    render(<ReferenceTextImport hasBody={false} onText={onText} />);

    await act(async () => { choose('PDF 파일 고르기', pdf); });
    await waitFor(() => expect(onText).toHaveBeenCalledWith('읽어 온 글'));
    expect(window.confirm).not.toHaveBeenCalled();
  });

  it('⚠️ 읽는 동안 사람이 친 글은 묻지 않고 덮지 않는다 — PDF 한 편은 몇 초가 걸린다', async () => {
    const reading = deferred<{ text: string; pageCount: number; pagesWithText: number }>();
    readPdfTextLayer.mockReturnValue(reading.promise);
    const onText = vi.fn();

    // 시작할 때는 본문이 비어 있었다
    const { rerender } = render(<ReferenceTextImport hasBody={false} onText={onText} />);
    await act(async () => { choose('PDF 파일 고르기', pdf); });

    // 읽는 사이 사람이 글을 쳤다
    rerender(<ReferenceTextImport hasBody onText={onText} />);

    await act(async () => {
      reading.resolve({ text: '읽어 온 글', pageCount: 1, pagesWithText: 1 });
    });
    await waitFor(() => expect(onText).toHaveBeenCalled());
    // 시작 시점 값을 닫아 두면 여기서 확인창 없이 덮는다
    expect(window.confirm).toHaveBeenCalled();
  });

  it('글자를 한 자도 못 찾으면 넣지 않고 알린다', async () => {
    readPdfTextLayer.mockResolvedValue({ text: '', pageCount: 3, pagesWithText: 0 });
    const onText = vi.fn();
    render(<ReferenceTextImport hasBody={false} onText={onText} />);

    await act(async () => { choose('PDF 파일 고르기', pdf); });
    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(onText).not.toHaveBeenCalled();
  });
});
