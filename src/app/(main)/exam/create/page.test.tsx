import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';

/**
 * 단어 시험지 생성 — 고른 카테고리와 출제 단어 (2026-10-15 리뷰 3번).
 *
 * 카테고리 트리는 누르면 그 id 를 토글하는 단추로 바꾸고, 단어 조회는 손으로 풀 수 있는 약속이다.
 * 실제 RPC 는 부르지 않는다 — 넘어가는 인자만 본다.
 */

const m = vi.hoisted(() => ({ fetch: vi.fn(), rpc: vi.fn() }));

vi.mock('@/lib/auth-context', () => {
  const user = { id: 'user' };
  return { useAuth: () => ({ user }) };
});
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: () => {
      const q: Record<string, unknown> = {};
      q.select = () => q;
      q.order = () => q;
      q.then = (yes: (r: unknown) => unknown) => Promise.resolve({ data: [] }).then(yes);
      return q;
    },
    rpc: (...a: unknown[]) => m.rpc(...a),
  },
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@/lib/grade-sync-client', () => ({ fireGradeSync: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/lib/words-fetch', () => ({
  MAX_EXAM_WORDS: 1000,
  fetchWordsByCategories: (...a: unknown[]) => m.fetch(...a),
}));
vi.mock('@/components/words', () => ({
  CategoryTree: ({ onToggle }: { onToggle: (id: string) => void }) => (
    <>
      <button type="button" onClick={() => onToggle('A')}>pick A</button>
      <button type="button" onClick={() => onToggle('B')}>pick B</button>
    </>
  ),
}));
vi.mock('@/components/exam/NaesinScopeLoader', () => ({ default: () => null }));

const { default: ExamCreatePage } = await import('./page');

type Page = { words: { id: string; word: string; meaning: string; category_id: string }[]; overLimit: boolean };

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

/** 카테고리 하나의 합성 단어 다섯 개 */
const wordsOf = (cat: string) => Array.from({ length: 5 }, (_, i) => ({
  id: `${cat.toLowerCase()}${i}`, word: `${cat}${i}`, meaning: `뜻${i}`, category_id: cat,
}));
const pageOf = (...cats: string[]): Page => ({ words: cats.flatMap(wordsOf), overLimit: false });

const createButton = () => screen.getByRole('button', {
  name: /시험지 생성|단어 불러오는 중|생성 중/,
}) as HTMLButtonElement;
const rpcArgs = () => m.rpc.mock.calls[0][1] as { p_category_ids: string[]; p_word_ids: string[] };

beforeEach(() => {
  m.fetch.mockReset();
  m.rpc.mockReset().mockResolvedValue({ data: 'created', error: null });
});

/** 화면을 그리고 제목을 채운다 */
function setup() {
  render(<ExamCreatePage />);
  fireEvent.change(screen.getByPlaceholderText('예: 중2 비상 Lesson 1 단어시험'), { target: { value: '합성 시험' } });
}

describe('단어 시험지 생성 — 선택을 바꾸는 사이', () => {
  it('⚠️ A 를 읽은 뒤 B 를 더한 직후에는 만들 수 없고, 다 읽으면 A+B 로 만든다', async () => {
    const both = deferred<Page>();
    m.fetch.mockResolvedValueOnce(pageOf('A')).mockReturnValueOnce(both.promise);
    setup();
    fireEvent.click(screen.getByText('pick A'));
    await waitFor(() => expect(createButton().disabled).toBe(false));

    fireEvent.click(screen.getByText('pick B'));
    expect(createButton().disabled).toBe(true);
    expect(screen.getByText('단어 불러오는 중…')).toBeTruthy();
    fireEvent.click(createButton());
    expect(m.rpc).not.toHaveBeenCalled();

    await act(async () => { both.resolve(pageOf('A', 'B')); });
    await waitFor(() => expect(createButton().disabled).toBe(false));
    fireEvent.click(createButton());
    await waitFor(() => expect(m.rpc).toHaveBeenCalledTimes(1));
    expect(rpcArgs().p_category_ids).toEqual(['A', 'B']);
    expect([...rpcArgs().p_word_ids].sort()).toEqual(pageOf('A', 'B').words.map((w) => w.id).sort());
  });

  it('⚠️ A 를 뺀 직후에는 A 단어로 만들지 않는다', async () => {
    const onlyB = deferred<Page>();
    m.fetch.mockResolvedValueOnce(pageOf('A')).mockResolvedValueOnce(pageOf('A', 'B'))
      .mockReturnValueOnce(onlyB.promise);
    setup();
    fireEvent.click(screen.getByText('pick A'));
    await waitFor(() => expect(createButton().disabled).toBe(false));
    fireEvent.click(screen.getByText('pick B'));
    await waitFor(() => expect(screen.getByText('10문항')).toBeTruthy());

    fireEvent.click(screen.getByText('pick A'));
    expect(createButton().disabled).toBe(true);
    fireEvent.click(createButton());
    expect(m.rpc).not.toHaveBeenCalled();

    await act(async () => { onlyB.resolve(pageOf('B')); });
    await waitFor(() => expect(createButton().disabled).toBe(false));
    fireEvent.click(createButton());
    await waitFor(() => expect(m.rpc).toHaveBeenCalledTimes(1));
    expect(rpcArgs().p_category_ids).toEqual(['B']);
    expect(rpcArgs().p_word_ids.every((id) => id.startsWith('b'))).toBe(true);
  });

  it('⚠️ 늦게 온 옛 선택의 응답이 최신 선택의 단어를 덮지 않는다', async () => {
    const slowA = deferred<Page>();
    m.fetch.mockReturnValueOnce(slowA.promise).mockResolvedValueOnce(pageOf('A', 'B'));
    setup();
    fireEvent.click(screen.getByText('pick A'));
    fireEvent.click(screen.getByText('pick B'));
    await waitFor(() => expect(screen.getByText('10문항')).toBeTruthy());

    await act(async () => { slowA.resolve(pageOf('A')); });
    expect(screen.getByText('10문항')).toBeTruthy();
    fireEvent.click(createButton());
    await waitFor(() => expect(m.rpc).toHaveBeenCalledTimes(1));
    expect(rpcArgs().p_word_ids).toHaveLength(10);
  });

  it('전부 해제하면 바로 0문항이 되고 만들 수 없다', async () => {
    m.fetch.mockResolvedValueOnce(pageOf('A'));
    setup();
    fireEvent.click(screen.getByText('pick A'));
    await waitFor(() => expect(createButton().disabled).toBe(false));

    fireEvent.click(screen.getByText('pick A'));
    expect(screen.getByText('0문항')).toBeTruthy();
    expect(createButton().disabled).toBe(true);
  });

  it('⚠️ 최신 조회가 실패하면 옛 단어로 만들지 않고, 다시 시도로 되살린다', async () => {
    m.fetch.mockResolvedValueOnce(pageOf('A')).mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce(pageOf('A', 'B'));
    setup();
    fireEvent.click(screen.getByText('pick A'));
    await waitFor(() => expect(createButton().disabled).toBe(false));
    fireEvent.click(screen.getByText('pick B'));

    await screen.findByText('단어를 불러오지 못했어요.');
    expect(createButton().disabled).toBe(true);
    expect(screen.getByText('0문항')).toBeTruthy();

    fireEvent.click(screen.getByText('다시 시도'));
    await waitFor(() => expect(createButton().disabled).toBe(false));
    expect(screen.getByText('10문항')).toBeTruthy();
  });

  it('⚠️ 늦게 온 옛 선택의 상한 초과 판정이 새 선택을 막지 않는다', async () => {
    const slowA = deferred<Page>();
    m.fetch.mockReturnValueOnce(slowA.promise).mockResolvedValueOnce(pageOf('A', 'B'));
    setup();
    fireEvent.click(screen.getByText('pick A'));
    fireEvent.click(screen.getByText('pick B'));
    await waitFor(() => expect(createButton().disabled).toBe(false));

    await act(async () => { slowA.resolve({ words: wordsOf('A'), overLimit: true }); });
    fireEvent.click(createButton());
    await waitFor(() => expect(m.rpc).toHaveBeenCalledTimes(1));
  });

  it('⚠️ 같은 선택으로 돌아와 다시 읽기가 실패하면 옛 결과로 만들지 않는다 (코덱스 1R)', async () => {
    m.fetch.mockResolvedValueOnce(pageOf('A')).mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce(pageOf('A'));
    setup();
    fireEvent.click(screen.getByText('pick A'));
    await waitFor(() => expect(createButton().disabled).toBe(false));

    fireEvent.click(screen.getByText('pick A'));
    fireEvent.click(screen.getByText('pick A'));
    expect(createButton().disabled).toBe(true);

    await screen.findByText('단어를 불러오지 못했어요.');
    expect(createButton().disabled).toBe(true);
    fireEvent.click(createButton());
    expect(m.rpc).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText('다시 시도'));
    await waitFor(() => expect(createButton().disabled).toBe(false));
  });

  it('지금 선택이 상한을 넘으면 만들지 않는다', async () => {
    m.fetch.mockResolvedValueOnce({ words: wordsOf('A'), overLimit: true });
    setup();
    fireEvent.click(screen.getByText('pick A'));
    await waitFor(() => expect(createButton().disabled).toBe(false));
    fireEvent.click(createButton());
    await act(async () => { await Promise.resolve(); });
    expect(m.rpc).not.toHaveBeenCalled();
  });
});
