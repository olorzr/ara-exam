import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';

const ID = '24d7c451-ad55-5b4f-9a51-9e394c35491f';
const PAGE1 = `sources/${ID}/pages/1.jpg`;
const PAGE2 = `sources/${ID}/pages/2.jpg`;

/** 처음 서명 — 2쪽은 서명부터 실패한다 */
vi.mock('@/hooks/useSignedImageUrls', () => ({
  useSignedImageUrls: () => ({
    urls: new Map([[`sources/${ID}/pages/1.jpg`, 'https://signed/p1?token=old']]),
    loading: false, missing: [`sources/${ID}/pages/2.jpg`], reload: vi.fn(),
  }),
}));

const signProblemFile = vi.fn<(path: string) => Promise<string | null>>();
vi.mock('@/lib/problem-bank/storage', () => ({ signProblemFile: (path: string) => signProblemFile(path) }));

const { default: ExamOriginalTab } = await import('./ExamOriginalTab');

/** 약속이 풀리고 상태가 반영되기를 기다린다 */
async function flush() {
  await act(async () => { await Promise.resolve(); await Promise.resolve(); });
}

describe('ExamOriginalTab', () => {
  it('지연 로딩 쪽이 만료된 주소로 깨지면 그 쪽만 다시 서명해 갈아 끼우고, 또 깨지면 다시 불러오기를 내민다', async () => {
    signProblemFile.mockReset().mockResolvedValue('https://signed/p1?token=new');
    render(<ExamOriginalTab source={{ id: ID, page_count: 2, file_path: '' }} />);
    const img = screen.getByAltText('원본 1쪽') as HTMLImageElement;
    expect(img.getAttribute('loading')).toBe('lazy');
    expect(img.src).toBe('https://signed/p1?token=old');

    fireEvent.error(img);
    await flush();
    expect(signProblemFile).toHaveBeenCalledWith(PAGE1);
    expect((screen.getByAltText('원본 1쪽') as HTMLImageElement).src).toBe('https://signed/p1?token=new');

    // 새 주소도 깨지면 끝없이 다시 서명하지 않고 단추를 내민다
    fireEvent.error(screen.getByAltText('원본 1쪽'));
    await flush();
    expect(signProblemFile).toHaveBeenCalledTimes(1);
    expect(screen.queryByAltText('원본 1쪽')).toBeNull();
    expect(screen.getAllByText('다시 불러오기')).toHaveLength(2);
  });

  it('서명부터 실패한 쪽도 다시 불러오기로 새 주소를 받아 그린다', async () => {
    signProblemFile.mockReset().mockResolvedValue('https://signed/p2?token=new');
    render(<ExamOriginalTab source={{ id: ID, page_count: 2, file_path: '' }} />);
    expect(screen.getByText('1쪽을 불러오지 못했어요. 그 쪽의 ‘다시 불러오기’를 눌러 주세요.')).toBeTruthy();
    fireEvent.click(screen.getByText('다시 불러오기'));
    await flush();
    expect(signProblemFile).toHaveBeenCalledWith(PAGE2);
    expect((screen.getByAltText('원본 2쪽') as HTMLImageElement).src).toBe('https://signed/p2?token=new');
    fireEvent.load(screen.getByAltText('원본 2쪽'));
    expect(screen.queryByText('다시 불러오기')).toBeNull();
  });

  it('원본 PDF 는 서명 주소를 박은 링크가 아니라 누를 때 여는 단추다', () => {
    render(<ExamOriginalTab source={{ id: ID, page_count: 0, file_path: `sources/${ID}/original.pdf` }} />);
    expect(screen.getByRole('button', { name: '원본 PDF 새 탭에서 열기' })).toBeTruthy();
    expect(screen.queryByRole('link')).toBeNull();
  });
});
