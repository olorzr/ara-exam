import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReferenceTextListItem } from '@/types/reference-text';
import { ALL_REFERENCE_TEXTS } from '@/lib/reference-texts/filters';

const ROWS: ReferenceTextListItem[] = [
  {
    id: 'w1', title: '저녁 항구', author: '함기석', kind: '작품', format: 'html', seq: 30, tags: [],
    source_key: null, char_count: 120,
    units: [{ grade: '중2', textbook: '천재(노미숙)', semester: '1학기', unit_path: ['1. 문학을 펼치면', '(1) 시의 목소리'] }],
    grammar_paths: [], note: '평가문제집 수록 부분', user_id: 'u', updated_by: null, created_at: '', updated_at: '',
  },
  {
    id: 'c1', title: '비유의 효과', author: '', kind: '개념', format: 'html', seq: 10, tags: [],
    source_key: null, char_count: 80, units: [],
    grammar_paths: [], note: '', user_id: 'u', updated_by: null, created_at: '', updated_at: '',
  },
];

const list = {
  rows: ROWS, empty: false, loading: false, busyId: null, search: '', axis: ALL_REFERENCE_TEXTS, kind: undefined,
  setSearch: vi.fn(), setAxis: vi.fn(), setKind: vi.fn(), reload: vi.fn(), remove: vi.fn(),
};
vi.mock('@/hooks/useReferenceTexts', () => ({ useReferenceTexts: () => list }));
vi.mock('@/hooks/useReferenceTextFacets', () => ({
  useReferenceTextFacets: () => ({ rows: [], unitTree: [], grammarTree: [], reload: vi.fn() }),
}));

const bodies = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock('@/lib/reference-texts/queries', () => ({ fetchReferenceBodies: bodies.fetch }));

const passages = vi.hoisted(() => ({ search: vi.fn() }));
vi.mock('@/lib/problem-bank/passage-search', () => ({
  searchPassages: passages.search,
  passagePickName: (row: { title: string }) => row.title,
}));
const details = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock('@/lib/problem-bank/detail-queries', () => ({ fetchPassagesByIds: details.fetch }));
vi.mock('@/lib/problem-bank/source-label', () => ({ sourceLabel: () => '2025 광희중 중2' }));

const { default: QuizSourcePickerDialog } = await import('./QuizSourcePickerDialog');

describe('QuizSourcePickerDialog', () => {
  beforeEach(() => {
    bodies.fetch.mockReset();
    passages.search.mockReset();
    passages.search.mockResolvedValue([]);
    details.fetch.mockReset();
  });

  it('작품 전문·개념 탭이 기본이고 갈래 배지·단원·판본 메모를 보여 준다', () => {
    render(<QuizSourcePickerDialog open onClose={vi.fn()} onPick={vi.fn()} />);
    expect(screen.getByRole('tab', { name: '작품 전문·개념' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByText('저녁 항구')).toBeTruthy();
    expect(screen.getByText('평가문제집 수록 부분')).toBeTruthy();
    expect(screen.getByText(/천재\(노미숙\)/)).toBeTruthy();
    // 갈래는 글자 배지로 — 색만으로 가르지 않는다
    expect(screen.getAllByText('개념').length).toBeGreaterThan(0);
    // 기출 탭은 열기 전까지 조회하지 않는다
    expect(passages.search).not.toHaveBeenCalled();
  });

  it('작품을 고르면 해설을 뺀 원문과 그 전문의 id 를 넘기고 창을 닫는다', async () => {
    bodies.fetch.mockResolvedValue(new Map([['w1', {
      format: 'html',
      body: '<p>바다에서 돌아온 배들이</p><blockquote data-callout="핵심 포인트" data-tone="point"><p>해설</p></blockquote>',
    }]]));
    const onPick = vi.fn();
    const onClose = vi.fn();
    render(<QuizSourcePickerDialog open onClose={onClose} onPick={onPick} />);
    fireEvent.click(screen.getByText('저녁 항구'));
    await waitFor(() => expect(onPick).toHaveBeenCalled());
    const picked = onPick.mock.calls[0][0];
    expect(picked.text).toBe('바다에서 돌아온 배들이');
    expect(picked.title).toBe('저녁 항구');
    expect(picked.meta).toMatchObject({ id: 'w1', source: 'text', textbook: '천재(노미숙)' });
    expect(onClose).toHaveBeenCalled();
  });

  it('본문을 못 찾으면 알리고 창을 닫지 않는다', async () => {
    bodies.fetch.mockResolvedValue(new Map());
    const onPick = vi.fn();
    const onClose = vi.fn();
    render(<QuizSourcePickerDialog open onClose={onClose} onPick={onPick} />);
    fireEvent.click(screen.getByText('비유의 효과'));
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(onPick).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('기출 지문 탭을 열면 그때 기출 지문을 조회한다', async () => {
    render(<QuizSourcePickerDialog open onClose={vi.fn()} onPick={vi.fn()} />);
    fireEvent.click(screen.getByRole('tab', { name: '기출 지문' }));
    await waitFor(() => expect(passages.search).toHaveBeenCalledWith(''));
  });

  it('⚠️ 한 탭에서 본문을 읽는 동안 다른 탭에서 고를 수 없다 — 먼저 고른 것이 나중 것을 덮으면 안 된다', async () => {
    let resolveBody: (value: Map<string, { body: string; format: 'text' }>) => void = () => {};
    bodies.fetch.mockReturnValue(new Promise((resolve) => { resolveBody = resolve; }));
    passages.search.mockResolvedValue([{ id: 'p1', title: '소나기', author: '황순원', page_no: 3, source: {} }]);
    const onPick = vi.fn();
    render(<QuizSourcePickerDialog open onClose={vi.fn()} onPick={onPick} />);

    fireEvent.click(screen.getByText('저녁 항구'));
    fireEvent.click(screen.getByRole('tab', { name: '기출 지문' }));
    const passageButton = (await screen.findByText('소나기')).closest('button') as HTMLButtonElement;
    expect(passageButton.disabled).toBe(true);
    fireEvent.click(passageButton);
    expect(details.fetch).not.toHaveBeenCalled();

    resolveBody(new Map([['w1', { body: '바다에서', format: 'text' }]]));
    await waitFor(() => expect(onPick).toHaveBeenCalledTimes(1));
    expect(onPick.mock.calls[0][0].meta.id).toBe('w1');
  });

  it('본문을 못 읽으면 잠금이 풀려 다른 탭에서 다시 고를 수 있다', async () => {
    bodies.fetch.mockRejectedValue(new Error('네트워크 오류'));
    passages.search.mockResolvedValue([{ id: 'p1', title: '소나기', author: '황순원', page_no: 3, source: {} }]);
    render(<QuizSourcePickerDialog open onClose={vi.fn()} onPick={vi.fn()} />);
    fireEvent.click(screen.getByText('저녁 항구'));
    expect(await screen.findByText('네트워크 오류')).toBeTruthy();
    fireEvent.click(screen.getByRole('tab', { name: '기출 지문' }));
    const passageButton = (await screen.findByText('소나기')).closest('button') as HTMLButtonElement;
    expect(passageButton.disabled).toBe(false);
  });
});
