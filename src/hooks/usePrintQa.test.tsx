import { describe, expect, it, vi, beforeEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { PrintBundle, PrintQaItem } from '@/types/print-scan';

const runPrintQaSplit = vi.fn();
const runPrintQaAnswers = vi.fn();
const updateBundle = vi.fn();
const ocrStillEnabled = vi.fn();
const toastSuccess = vi.fn();
const toastWarning = vi.fn();
const toastError = vi.fn();
const toastInfo = vi.fn();

// 순수 함수(번호·대상 고르기·영수증)는 **진짜를 쓴다** — 훅이 그것들과 맞물려 도는지가 관심사다
vi.mock('@/lib/print-qa', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/print-qa')>()),
  runPrintQaSplit: (...args: unknown[]) => runPrintQaSplit(...args),
  runPrintQaAnswers: (...args: unknown[]) => runPrintQaAnswers(...args),
}));
vi.mock('@/lib/print-scan/save', () => ({
  updateBundle: (...args: unknown[]) => updateBundle(...args),
}));
vi.mock('./useProblemOcr', () => ({
  ocrStillEnabled: (...args: unknown[]) => ocrStillEnabled(...args),
}));
vi.mock('@/lib/ai/localPort', () => ({ getCodexPort: () => 8899 }));
vi.mock('@/lib/ai/localModelPref', () => ({ getCodexModelPref: () => ({ model: null, effort: null }) }));
vi.mock('@/lib/ai/ocrPref', () => ({
  resolveOcrPrefFromBridge: async () => ({ model: 'gpt-5.6-terra', effort: 'high' }),
}));
vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccess(...args),
    warning: (...args: unknown[]) => toastWarning(...args),
    error: (...args: unknown[]) => toastError(...args),
    info: (...args: unknown[]) => toastInfo(...args),
  },
}));

const { usePrintQa } = await import('./usePrintQa');

const item = (over: Partial<PrintQaItem> = {}): PrintQaItem => ({
  id: 'a', label: '1', lead: '', question: '물음', answer: '', answerSource: 'none',
  studentAnswer: '', evidence: '', evidenceSource: null, verified: true, leadApproved: false, ...over,
});

const bundle = (over: Partial<PrintBundle> = {}): PrintBundle => ({
  id: 'b1', scan_id: 's1', name: '2026 광희중 동백꽃', school_id: null,
  school_name: '광희중학교', year: '2026', grade: '중2', semester: '2학기', exam_type: '중간',
  include_handwriting: false, register_words: false, pages: [1], page_paths: [''],
  ocr_html: '<p>1. 물음 답: 가</p>', ocr_meta: {}, words_meta: {},
  qa_items: [], qa_meta: {}, status: '읽기완료', user_id: 'u', updated_by: null,
  created_at: '', updated_at: '', ...over,
});

beforeEach(() => {
  runPrintQaSplit.mockReset();
  runPrintQaAnswers.mockReset();
  updateBundle.mockReset().mockResolvedValue(undefined);
  ocrStillEnabled.mockReset().mockResolvedValue(true);
  [toastSuccess, toastWarning, toastError, toastInfo].forEach((t) => t.mockReset());
});

describe('usePrintQa — 나누기', () => {
  it('나누면 저장하고 기본 대상(답 없음·손글씨)을 골라 둔다', async () => {
    runPrintQaSplit.mockResolvedValue({
      items: [
        item({ id: 'x-0', answerSource: 'printed', answer: '가' }),
        item({ id: 'x-1', answerSource: 'none' }),
      ],
      work: { title: '동백꽃', author: '김유정' },
      warnings: [],
      dropped: { malformed: 0, duplicate: 0, answerNotInText: 0 },
    });

    const { result } = renderHook(() => usePrintQa(bundle()));
    await act(async () => { await result.current.split(); });

    expect(result.current.items).toHaveLength(2);
    expect([...result.current.picked]).toEqual(['x-1']);
    expect(result.current.dirty).toBe(false);
    const [, patch] = updateBundle.mock.calls[0] as [string, { qa_meta: { work: unknown } }];
    expect(patch.qa_meta.work).toEqual({ title: '동백꽃', author: '김유정' });
  });

  it('나눈 뒤에는 원문과 어긋나지 않는다 — 그 원문의 해시를 함께 적는다', async () => {
    runPrintQaSplit.mockResolvedValue({
      items: [item()], work: { title: '', author: '' }, warnings: [],
      dropped: { malformed: 0, duplicate: 0, answerNotInText: 0 },
    });
    const { result } = renderHook(() => usePrintQa(bundle()));
    await act(async () => { await result.current.split(); });
    expect(result.current.stale).toBe(false);
  });

  it('⚠️ 옛 원문으로 나눠 둔 문답은 지우지 않고 알린다 — 손본 답이 거기 들어 있다', () => {
    const { result } = renderHook(() => usePrintQa(bundle({
      qa_items: [item()], qa_meta: { sourceHash: 'deadbeef' },
    })));
    expect(result.current.items).toHaveLength(1);
    expect(result.current.stale).toBe(true);
  });

  it('킬스위치가 꺼져 있으면 시작하지 않는다 (fail-closed)', async () => {
    ocrStillEnabled.mockResolvedValue(false);
    const { result } = renderHook(() => usePrintQa(bundle()));
    await act(async () => { await result.current.split(); });
    expect(runPrintQaSplit).not.toHaveBeenCalled();
    expect(toastError).toHaveBeenCalled();
  });

  it('⚠️ 킬스위치 확인에도 취소 신호를 보낸다 — 멈추면 편집이 잠긴 채 남는다 (코덱스 2R)', async () => {
    ocrStillEnabled.mockResolvedValue(true);
    runPrintQaSplit.mockResolvedValue({
      items: [], work: { title: '', author: '' }, warnings: [],
      dropped: { malformed: 0, duplicate: 0, answerNotInText: 0 },
    });
    const { result } = renderHook(() => usePrintQa(bundle()));
    await act(async () => { await result.current.split(); });
    expect(ocrStillEnabled).toHaveBeenCalledWith('print_qa', expect.any(AbortSignal));
  });
});

describe('usePrintQa — 모범답안', () => {
  it('골라 둔 문항에만 붙이고 그때 쓴 자료 이름을 굳혀 둔다', async () => {
    runPrintQaAnswers.mockResolvedValue({
      answers: [{ no: 1, answer: '모범답안', evidence: '근거', source: '개념지 · 동백꽃' }],
      dropped: { malformed: 0, unknownNo: 0, duplicate: 0 },
      withoutEvidence: 0,
    });
    const { result } = renderHook(() => usePrintQa(bundle({
      qa_items: [item({ id: 'a' }), item({ id: 'b', answerSource: 'printed', answer: '가' })],
    })));

    await act(async () => {
      await result.current.generateAnswers([{ label: '개념지 · 동백꽃', plain: '자료' }]);
    });

    expect(result.current.items[0]).toMatchObject({ answer: '모범답안', answerSource: 'ai' });
    expect(result.current.items[1].answerSource).toBe('printed');
    expect(result.current.meta.references).toEqual(['개념지 · 동백꽃']);
  });

  it('고른 문항이 없으면 부르지 않는다', async () => {
    const { result } = renderHook(() => usePrintQa(bundle({
      qa_items: [item({ answerSource: 'printed', answer: '가' })],
    })));
    await act(async () => { await result.current.generateAnswers([]); });
    expect(runPrintQaAnswers).not.toHaveBeenCalled();
    expect(toastWarning).toHaveBeenCalled();
  });
});

describe('usePrintQa — 잠금 (코덱스 리뷰)', () => {
  it('⚠️ AI 가 도는 동안 저장이 끼어들지 않는다 — 늦게 도착하면 AI 결과를 옛 문항으로 덮는다', async () => {
    let release!: () => void;
    runPrintQaAnswers.mockReturnValue(new Promise((resolve) => {
      release = () => resolve({
        answers: [{ no: 1, answer: 'AI 답', evidence: '', source: null }],
        dropped: { malformed: 0, unknownNo: 0, duplicate: 0 },
        withoutEvidence: 1,
      });
    }));

    const { result } = renderHook(() => usePrintQa(bundle({ qa_items: [item({ id: 'a' })] })));
    let running!: Promise<number>;
    act(() => { running = result.current.generateAnswers([]); });

    // 도는 중에 부른 저장은 **아무 일도 하지 않는다**
    await act(async () => { await result.current.save(); });
    expect(updateBundle).not.toHaveBeenCalled();

    await act(async () => { release(); await running; });
    expect(updateBundle).toHaveBeenCalledTimes(1);
    expect(result.current.items[0].answer).toBe('AI 답');
  });

  it('⚠️ 앞서 쓴 자료 이름을 지우지 않고 더한다 — 답지 머리글이 출처를 빠뜨리면 안 된다', async () => {
    runPrintQaAnswers.mockResolvedValue({
      answers: [{ no: 1, answer: '답', evidence: '', source: null }],
      dropped: { malformed: 0, unknownNo: 0, duplicate: 0 },
      withoutEvidence: 1,
    });
    const { result } = renderHook(() => usePrintQa(bundle({
      qa_items: [item({ id: 'a' })],
      qa_meta: { references: ['개념지 · 봄봄'] },
    })));

    await act(async () => {
      await result.current.generateAnswers([{ label: '전문 · 동백꽃', plain: '자료' }]);
    });
    expect(result.current.meta.references).toEqual(['개념지 · 봄봄', '전문 · 동백꽃']);
  });
});

describe('usePrintQa — 손 편집', () => {
  it('답을 고치면 teacher 가 되고 저장 전까지 dirty 다', async () => {
    const { result } = renderHook(() => usePrintQa(bundle({ qa_items: [item({ id: 'a' })] })));

    act(() => result.current.updateAnswer('a', '직접 쓴 답'));
    expect(result.current.items[0]).toMatchObject({ answer: '직접 쓴 답', answerSource: 'teacher' });
    expect(result.current.dirty).toBe(true);

    // 칸에 치는 동안 띄어쓰기가 사라지면 안 된다 — 훅도 다듬지 않는다
    act(() => result.current.updateAnswer('a', '직접 쓴 답 '));
    expect(result.current.items[0].answer).toBe('직접 쓴 답 ');
    act(() => result.current.updateAnswer('a', '직접 쓴 답'));

    await act(async () => { await result.current.save(); });
    await waitFor(() => expect(result.current.dirty).toBe(false));
    expect(updateBundle).toHaveBeenCalledWith('b1', expect.objectContaining({
      qa_items: [expect.objectContaining({ answer: '직접 쓴 답' })],
    }));
  });

  it('⚠️ 물려받은 앞글은 승인이 풀린다 (Stop 게이트)', () => {
    const { result } = renderHook(() => usePrintQa(bundle({
      qa_items: [
        item({ id: 'a', lead: '안 본 글' }),
        item({ id: 'b', lead: '본 지문', leadApproved: true }),
      ],
    })));
    act(() => result.current.removeItem('a'));
    expect(result.current.items[0].leadApproved).toBe(false);
  });

  it('⚠️ 지운 문항의 앞글을 뒤 문항이 물려받는다 (코덱스 2R)', () => {
    const { result } = renderHook(() => usePrintQa(bundle({
      qa_items: [item({ id: 'a', lead: '[가] 지문' }), item({ id: 'b' })],
    })));
    act(() => result.current.removeItem('a'));
    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0].lead).toBe('[가] 지문');
  });

  it('⚠️ 지운 문항은 고름에서도 빠진다 — 안 그러면 "고른 2개" 라고 해 놓고 하나만 만든다', () => {
    const { result } = renderHook(() => usePrintQa(bundle({
      qa_items: [item({ id: 'a' }), item({ id: 'b' })],
    })));
    expect(result.current.picked.size).toBe(2);
    act(() => result.current.removeItem('a'));
    expect([...result.current.picked]).toEqual(['b']);
  });

  it('고름을 손으로 바꾸고 기본으로 되돌릴 수 있다', () => {
    const { result } = renderHook(() => usePrintQa(bundle({
      qa_items: [item({ id: 'a' }), item({ id: 'b', answerSource: 'printed', answer: '가' })],
    })));
    expect([...result.current.picked]).toEqual(['a']);

    act(() => result.current.pick('b', true));
    expect(result.current.picked.size).toBe(2);
    act(() => result.current.pickNone());
    expect(result.current.picked.size).toBe(0);
    act(() => result.current.pickDefault());
    expect([...result.current.picked]).toEqual(['a']);
  });
});
