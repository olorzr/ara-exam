import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProblemOrigin } from '@/lib/problem-report/queries';

const SOURCE = '24d7c451-ad55-5b4f-9a51-9e394c35491f';
const page = (n: number) => `sources/${SOURCE}/pages/${n}.jpg`;

const m = vi.hoisted(() => ({
  origin: vi.fn<(id: string) => Promise<unknown>>(),
  wanted: [] as string[][],
}));
vi.mock('@/lib/problem-report/queries', () => ({ fetchProblemOrigin: (id: string) => m.origin(id) }));
// 서명은 경로를 그대로 주소로 — 이 테스트는 어느 쪽을 그리는지 본다
vi.mock('@/hooks/useSignedImageUrls', () => ({
  useSignedImageUrls: (paths: string[]) => {
    m.wanted.push(paths);
    return { urls: new Map(paths.map((p) => [p, `https://signed/${p}`])), loading: false, missing: [], reload: vi.fn() };
  },
}));
vi.mock('@/lib/problem-bank/storage', () => ({ signProblemFile: async (p: string) => `https://signed/${p}?new` }));

const { default: ReportOriginalPage } = await import('./ReportOriginalPage');

async function flush() {
  await act(async () => { await Promise.resolve(); await Promise.resolve(); });
}
const origin = (over: Partial<ProblemOrigin> = {}): ProblemOrigin => ({
  sourceId: SOURCE, pageNo: 2, pageCount: 3, sourceType: '내신기출', ...over,
});

beforeEach(() => {
  m.origin.mockReset();
  m.wanted = [];
});

describe('ReportOriginalPage — 신고 창의 원본 시험지 쪽 (2026-11-22)', () => {
  it('문항이 실린 원본 쪽을 그리고, 앞뒤 쪽으로 넘겼다가 문항 쪽으로 돌아온다', async () => {
    m.origin.mockResolvedValue(origin());
    render(<ReportOriginalPage problemId="p1" />);
    expect(screen.getByText('원본 시험지를 불러오는 중…')).toBeTruthy();
    await flush();
    expect(m.origin).toHaveBeenCalledWith('p1');
    expect((screen.getByAltText('원본 2쪽') as HTMLImageElement).src).toBe(`https://signed/${page(2)}`);
    expect(screen.getByText('이 문항이 있는 쪽')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: '다음 쪽' }));
    expect(screen.getByAltText('원본 3쪽')).toBeTruthy();
    expect(screen.getByRole('button', { name: '다음 쪽' })).toHaveProperty('disabled', true);
    fireEvent.click(screen.getByRole('button', { name: '문항 쪽으로' }));
    expect(screen.getByAltText('원본 2쪽')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '앞 쪽' }));
    expect(screen.getByAltText('원본 1쪽')).toBeTruthy();
    expect(screen.getByRole('button', { name: '앞 쪽' })).toHaveProperty('disabled', true);
  });

  it('내신기출·모의고사는 시험지 전체 보기 링크를 새 탭으로 내고, 평가문제집은 안 낸다', async () => {
    m.origin.mockResolvedValue(origin());
    const { unmount } = render(<ReportOriginalPage problemId="p1" />);
    await flush();
    const link = screen.getByRole('link', { name: '시험지 전체 보기' });
    expect(link.getAttribute('href')).toBe(`/problems/sets/exam/${SOURCE}`);
    expect(link.getAttribute('target')).toBe('_blank');
    expect(screen.getByRole('button', { name: /크게 보기/ })).toBeTruthy();
    unmount();

    m.origin.mockResolvedValue(origin({ sourceType: '평가문제집' }));
    render(<ReportOriginalPage problemId="p2" />);
    await flush();
    expect(screen.queryByRole('link', { name: '시험지 전체 보기' })).toBeNull();
  });

  it('원본 문항이 지워진 항목이면 묻지 않고 그 사실을 알린다', () => {
    render(<ReportOriginalPage problemId={null} />);
    expect(m.origin).not.toHaveBeenCalled();
    expect(screen.getByText(/원본 시험지를 보여 줄 수 없어요/)).toBeTruthy();
  });

  it('문항을 못 찾으면(다시 올라왔다) 그 사실을, 조회가 실패하면 다시 불러오기를 낸다', async () => {
    m.origin.mockResolvedValueOnce(null);
    const { unmount } = render(<ReportOriginalPage problemId="p1" />);
    await flush();
    expect(screen.getByText(/원본 시험지를 보여 줄 수 없어요/)).toBeTruthy();
    unmount();

    m.origin.mockRejectedValueOnce(new Error('x')).mockResolvedValueOnce(origin());
    render(<ReportOriginalPage problemId="p1" />);
    await flush();
    expect(screen.getByText('원본 시험지를 불러오지 못했어요.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '다시 불러오기' }));
    await flush();
    expect(screen.getByAltText('원본 2쪽')).toBeTruthy();
  });

  it('만료된 주소로 깨지면 그 쪽만 다시 서명해 갈아 끼운다', async () => {
    m.origin.mockResolvedValue(origin());
    render(<ReportOriginalPage problemId="p1" />);
    await flush();
    fireEvent.error(screen.getByAltText('원본 2쪽'));
    await flush();
    expect((screen.getByAltText('원본 2쪽') as HTMLImageElement).src).toBe(`https://signed/${page(2)}?new`);
  });
});
