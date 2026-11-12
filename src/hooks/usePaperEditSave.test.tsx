import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';

const updatePaper = vi.fn();
const requestGradeSync = vi.fn();
const toast = { error: vi.fn(), success: vi.fn(), warning: vi.fn(), info: vi.fn() };

vi.mock('sonner', () => ({ toast }));
vi.mock('@/lib/grade-sync-client', async (orig) => ({
  ...(await orig<typeof import('@/lib/grade-sync-client')>()),
  requestGradeSync: (...a: unknown[]) => requestGradeSync(...a),
}));
vi.mock('@/lib/problem-paper/paper-edit', async (orig) => ({
  ...(await orig<typeof import('@/lib/problem-paper/paper-edit')>()),
  updatePaper: (...a: unknown[]) => updatePaper(...a),
}));

const { usePaperEditSave, OMR_EDIT_CONFIRM } = await import('./usePaperEditSave');
const { PaperEditBlockedError, PaperEditConflictError } = await import('@/lib/problem-paper/paper-edit');
const { DEFAULT_PAPER_SETTINGS } = await import('@/lib/problem-paper/settings');

const paper = {
  items: [{ problemId: 'q1', passageId: null, itemId: 'i1' }, { problemId: 'q2', passageId: null }],
  title: '고친 제목',
  settings: { ...DEFAULT_PAPER_SETTINGS, columns: 1 as const },
  omrPlan: null,
};
const okResult = { updatedAt: 'v2', totalQuestions: 2, passageChanged: [] };

function setup(omr = false, over: Partial<typeof paper> = {}) {
  return renderHook(() => usePaperEditSave({ paperId: 'p1', expectUpdatedAt: 'v1', omr, paper: { ...paper, ...over } }));
}

beforeEach(() => {
  updatePaper.mockReset();
  requestGradeSync.mockReset();
  Object.values(toast).forEach((fn) => fn.mockReset());
  vi.spyOn(window, 'confirm').mockReturnValue(true);
});

describe('usePaperEditSave', () => {
  it('검사에 걸리면 보내지 않는다', async () => {
    const { result } = setup(false, { title: ' ' });
    let ok = true;
    await act(async () => { ok = await result.current.save(); });
    expect(ok).toBe(false);
    expect(updatePaper).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/제목/));
  });

  it('OMR 아닌 문제지 — 확인창 없이 항목·버전·설정을 보내고 성적은 건드리지 않는다', async () => {
    updatePaper.mockResolvedValue(okResult);
    const { result } = setup();
    let ok = false;
    await act(async () => { ok = await result.current.save(); });
    expect(ok).toBe(true);
    expect(window.confirm).not.toHaveBeenCalled();
    expect(updatePaper).toHaveBeenCalledWith({
      paperId: 'p1', expectUpdatedAt: 'v1', title: '고친 제목',
      entries: [{ item: 'i1' }, { problem: 'q2' }], settings: { columns: 1, showSource: true },
    });
    expect(requestGradeSync).not.toHaveBeenCalled();
  });

  it('OMR 문제지 — 확인창을 거절하면 보내지 않는다', async () => {
    vi.mocked(window.confirm).mockReturnValue(false);
    const { result } = setup(true);
    await act(async () => { await result.current.save(); });
    expect(window.confirm).toHaveBeenCalledWith(OMR_EDIT_CONFIRM);
    expect(updatePaper).not.toHaveBeenCalled();
  });

  it('OMR 문제지 — 저장 뒤 정답표 재등록을 기다리고 결과대로 알린다', async () => {
    updatePaper.mockResolvedValue(okResult);
    const { result } = setup(true);

    requestGradeSync.mockResolvedValueOnce({ ok: true, result: {} });
    await act(async () => { await result.current.save(); });
    // 방금 저장한 판을 싣는다 — 그사이 또 고쳤으면 라우트가 거절한다
    expect(requestGradeSync).toHaveBeenCalledWith('/api/sync-paper-to-grades', { paperId: 'p1', revision: 'v2' }, { keepalive: true });
    expect(toast.success).toHaveBeenCalledWith(expect.stringMatching(/정답표도 새로 등록/));

    requestGradeSync.mockResolvedValueOnce({ ok: true, result: { answerKeyFrozen: true } });
    await act(async () => { await result.current.save(); });
    expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/채점이 시작돼/), expect.anything());

    requestGradeSync.mockResolvedValueOnce({ ok: false, reason: 'exception' });
    await act(async () => { await result.current.save(); });
    expect(toast.warning).toHaveBeenCalledWith(expect.stringMatching(/반영하지 못했어요/), expect.anything());
  });

  it('지문 판이 다른 자리를 알린다', async () => {
    updatePaper.mockResolvedValue({ ...okResult, passageChanged: [3, 4] });
    const { result } = setup();
    await act(async () => { await result.current.save(); });
    expect(toast.info).toHaveBeenCalledWith(expect.stringMatching(/^3, 4번은/), expect.anything());
  });

  it('충돌·막힘은 상태로 남긴다', async () => {
    updatePaper.mockRejectedValueOnce(new PaperEditConflictError());
    const { result } = setup();
    await act(async () => { await result.current.save(); });
    expect(result.current.conflict).toBe(true);

    updatePaper.mockRejectedValueOnce(new PaperEditBlockedError('graded'));
    await act(async () => { await result.current.save(); });
    expect(result.current.blocked).toBe('graded');
  });
});
