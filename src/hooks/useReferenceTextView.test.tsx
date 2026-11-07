import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

const api = vi.hoisted(() => ({ text: vi.fn(), attachments: vi.fn() }));
vi.mock('@/lib/reference-texts/queries', () => ({
  fetchReferenceText: api.text,
  fetchReferenceAttachments: api.attachments,
}));

const { useReferenceTextView } = await import('./useReferenceTextView');

beforeEach(() => {
  api.text.mockReset();
  api.attachments.mockReset();
});

describe('useReferenceTextView', () => {
  it('본문과 붙은 글을 함께 읽는다', async () => {
    api.text.mockResolvedValue({ id: 'w1' });
    api.attachments.mockResolvedValue([{ id: 't1' }]);
    const { result } = renderHook(() => useReferenceTextView('w1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.row).toEqual({ id: 'w1' });
    expect(result.current.attachments).toEqual([{ id: 't1' }]);
    expect(result.current.attachFailed).toBe(false);
  });

  it('붙은 글만 실패하면 본문은 보이고 실패만 알린다 — 제재 정리 때문에 작품을 막지 않는다', async () => {
    api.text.mockResolvedValue({ id: 'w1' });
    api.attachments.mockRejectedValue(new Error('x'));
    const { result } = renderHook(() => useReferenceTextView('w1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.row).toEqual({ id: 'w1' });
    expect(result.current.failed).toBe(false);
    expect(result.current.attachments).toEqual([]);
    expect(result.current.attachFailed).toBe(true);
  });

  it('붙은 글이 늦어도 본문은 먼저 그린다 — 붙은 글은 오는 대로 얹는다(코덱스 2R)', async () => {
    let release: (v: unknown[]) => void = () => {};
    api.text.mockResolvedValue({ id: 'w1' });
    api.attachments.mockReturnValue(new Promise((resolve) => { release = resolve; }));
    const { result } = renderHook(() => useReferenceTextView('w1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.row).toEqual({ id: 'w1' });
    expect(result.current.attachments).toEqual([]);
    expect(result.current.attachLoading).toBe(true);
    release([{ id: 't1' }]);
    await waitFor(() => expect(result.current.attachments).toEqual([{ id: 't1' }]));
    expect(result.current.attachLoading).toBe(false);
  });

  it('본문이 실패하면 화면 전체가 실패다', async () => {
    api.text.mockRejectedValue(new Error('x'));
    api.attachments.mockResolvedValue([]);
    const { result } = renderHook(() => useReferenceTextView('w1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.failed).toBe(true);
    expect(result.current.row).toBeNull();
  });
});
