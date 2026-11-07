import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

/**
 * 문제지 조합 화면 — 문제 은행과 책 만들기가 같은 화면을 쓰고, 평가문제집은 책 쪽에서만 읽는다(2026-11-05).
 * 조회 조건·패싯은 훅이 첫 필터에서 만들므로 여기서는 **어떤 첫 필터로 훅을 부르는가** 를 고정한다.
 */

const useProblemArchive = vi.fn();

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@/hooks/useProblemArchive', () => ({ useProblemArchive: (...a: unknown[]) => useProblemArchive(...a) }));
vi.mock('@/hooks/usePaperComposer', () => ({ usePaperComposer: () => ({ items: [], added: new Set(), rows: new Map(), settings: {} }) }));
vi.mock('@/hooks/usePaperBulkAdd', () => ({ usePaperBulkAdd: () => ({ selection: {}, bulkBusy: false }) }));
vi.mock('@/hooks/usePaperTypeMix', () => ({ usePaperTypeMix: () => ({ busy: false }) }));
vi.mock('@/hooks/useListDrag', () => ({ useListDrag: () => ({ handlers: {}, dragging: false }) }));
vi.mock('@/hooks/useSignedImageUrls', () => ({ useSignedImageUrls: () => ({ urls: new Map() }) }));
for (const path of [
  '@/components/problem-bank/ArchiveList', '@/components/problem-bank/ArchiveLoadError',
  '@/components/problem-bank/ArchivePager', '@/components/problem-bank/ArchiveSidePanel',
  '@/components/problem-bank/ProblemCard', '@/components/problem-bank/ProblemDetailDialog',
  '@/components/problem-bank/ProblemFilterBar', '@/components/problem-paper/PaperCanvasColumn',
  '@/components/problem-paper/PaperPickBar', '@/components/problem-paper/PassageAddButton',
  '@/components/problem-paper/TypeMixDialog',
]) vi.doMock(path, () => ({ default: () => null }));

const { default: PaperComposeScreen } = await import('./PaperComposeScreen');
const { EMPTY_FILTERS } = await import('@/lib/problem-bank/filters');

beforeEach(() => {
  useProblemArchive.mockReset();
  useProblemArchive.mockReturnValue({ filters: EMPTY_FILTERS, facets: {}, rows: [], total: 0, failed: null, loading: false });
});

describe('PaperComposeScreen', () => {
  it('문제 은행에서는 평가문제집을 안 읽고 안내도 없다', () => {
    render(<PaperComposeScreen />);
    expect(useProblemArchive.mock.calls[0][0]).toMatchObject({ with_workbook: false });
    expect(screen.getByRole('heading', { name: /문제지 조합/ })).toBeTruthy();
    expect(screen.queryByText(/평가문제집 문항은 여기서만/)).toBeNull();
  });

  it('책 만들기에서는 평가문제집까지 읽고 그 사실을 알린다', () => {
    render(<PaperComposeScreen withWorkbook />);
    expect(useProblemArchive.mock.calls[0][0]).toMatchObject({ with_workbook: true });
    expect(screen.getByRole('heading', { name: /문제지 만들기/ })).toBeTruthy();
    expect(screen.getByText(/평가문제집 문항은 여기서만/)).toBeTruthy();
  });

  it('두 화면 모두 정답 없는 문항을 처음부터 뺀다(원장 결정) — 그 칸이 빼기 줄에 보인다', () => {
    render(<PaperComposeScreen />);
    render(<PaperComposeScreen withWorkbook />);
    expect(useProblemArchive.mock.calls[0][0]).toMatchObject({ answered_only: true });
    expect(useProblemArchive.mock.calls.at(-1)?.[0]).toMatchObject({ answered_only: true, with_workbook: true });
    expect(screen.getAllByRole('checkbox', { name: '정답 없는 문항 빼기' })).toHaveLength(2);
  });
});
