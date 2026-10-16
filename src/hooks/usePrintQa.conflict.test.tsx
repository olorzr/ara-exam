import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { PrintBundle, PrintQaItem } from '@/types/print-scan';

/**
 * 문답 저장의 동시성과 0행 갱신 (2026-10-15 리뷰 2·7번).
 *
 * **진짜 `updateBundle`·`fetchBundle`** 을 메모리 속 묶음 한 행에 붙인다. 합성 저장소는
 * PostgREST 처럼 `eq` 조건이 모두 맞는 행만 고치고(0행이어도 오류가 아니다), 고칠 때마다
 * `updated_at` 을 올린다(sql/26 의 트리거). 실제 AI 는 부르지 않는다.
 */

type Row = Record<string, unknown> & { updated_at: string };
const db = vi.hoisted(() => ({ row: null as Row | null, seq: 0 }));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: () => {
      const filters: [string, unknown][] = [];
      let patch: Record<string, unknown> | null = null;
      const matches = () => db.row !== null && filters.every(([k, v]) => db.row?.[k] === v);
      const q: Record<string, unknown> = {
        update: (p: Record<string, unknown>) => { patch = p; return q; },
        select: () => q,
        eq: (k: string, v: unknown) => { filters.push([k, v]); return q; },
        maybeSingle: async () => {
          if (patch) {
            if (!matches() || !db.row) return { data: null, error: null };
            db.seq += 1;
            db.row = { ...db.row, ...structuredClone(patch), updated_at: `v${db.seq}` };
            return { data: { updated_at: db.row.updated_at }, error: null };
          }
          return { data: matches() ? { ...db.row, print_scans: null } : null, error: null };
        },
      };
      return q;
    },
  },
}));

const runPrintQaAnswers = vi.fn();
const runPrintQaSplit = vi.fn();
const toastSuccess = vi.fn();
const toastError = vi.fn();

vi.mock('@/lib/print-qa', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/print-qa')>()),
  runPrintQaSplit: (...a: unknown[]) => runPrintQaSplit(...a),
  runPrintQaAnswers: (...a: unknown[]) => runPrintQaAnswers(...a),
}));
vi.mock('@/lib/ai/still-enabled', () => ({ ocrStillEnabled: async () => true }));
vi.mock('@/lib/ai/localPort', () => ({ getCodexPort: () => 8899 }));
vi.mock('@/lib/ai/localModelPref', () => ({ getCodexModelPref: () => ({ model: null, effort: null }) }));
vi.mock('@/lib/ai/ocrPref', () => ({ resolveOcrPrefFromBridge: async () => ({ model: 'm', effort: 'high' }) }));
vi.mock('sonner', () => ({
  toast: {
    success: (...a: unknown[]) => toastSuccess(...a),
    error: (...a: unknown[]) => toastError(...a),
    warning: vi.fn(),
    info: vi.fn(),
  },
}));

const { usePrintQa } = await import('./usePrintQa');
const { printQaSourceHash } = await import('@/lib/print-qa');

/** 처음 읽어 둔 원문 — 문답은 이 원문의 해시로 나눠 둔 것이다 */
const OCR_HTML = '<p>1. 1번 물음 답: 원래 답</p>';

function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((res) => { resolve = res; });
  return { promise, resolve };
}

const item = (id: string, label: string, over: Partial<PrintQaItem> = {}): PrintQaItem => ({
  id, label, lead: '', question: `${label}번 물음`, answer: '원래 답', answerSource: 'printed',
  studentAnswer: '', evidence: '', evidenceSource: null, verified: true, leadApproved: false, ...over,
});

const ITEMS = [item('q1', '1'), item('q2', '2', { answer: '', answerSource: 'none' })];

const BUNDLE: PrintBundle = {
  id: 'b1', scan_id: 's1', name: '합성 프린트', school_id: null, school_name: '합성중', year: '2026',
  grade: '중2', semester: '2학기', exam_type: '중간', include_handwriting: false, register_words: false,
  source: 'scan', pages: [1], page_paths: [''], ocr_html: OCR_HTML,
  ocr_meta: {}, words_meta: {}, qa_items: ITEMS, qa_meta: { sourceHash: printQaSourceHash(OCR_HTML) },
  status: '읽기완료', user_id: 'u',
  updated_by: null, created_at: '', updated_at: 'v0',
};

const savedItems = () => (db.row?.qa_items ?? []) as PrintQaItem[];

/** 같은 묶음을 연 두 탭 */
function twoTabs() {
  return [renderHook(() => usePrintQa(BUNDLE)), renderHook(() => usePrintQa(BUNDLE))] as const;
}

beforeEach(() => {
  db.row = { ...structuredClone(BUNDLE) } as Row;
  db.seq = 0;
  runPrintQaAnswers.mockReset();
  runPrintQaSplit.mockReset();
  toastSuccess.mockReset();
  toastError.mockReset();
  vi.spyOn(window, 'confirm').mockReturnValue(true);
});

describe('문답 저장 — 두 탭(리뷰 2번)', () => {
  it('⚠️ 다른 문항을 고쳐도 뒤에 저장한 탭이 앞서 저장한 교정을 되돌리지 않는다', async () => {
    const [a, b] = twoTabs();
    act(() => a.result.current.updateAnswer('q1', '교정 답안'));
    await act(async () => { await a.result.current.save(); });
    expect(savedItems()[0].answer).toBe('교정 답안');

    act(() => b.result.current.updateQuestion('q2', 'B 가 고친 물음'));
    await act(async () => { await b.result.current.save(); });

    expect(savedItems()[0].answer).toBe('교정 답안');
    expect(savedItems()[1].question).toBe('2번 물음');
    expect(b.result.current.saveFailure).toBe('conflict');
    expect(b.result.current.dirty).toBe(true);
    // 내 입력은 화면에 남아 다시 시도할 수 있다
    expect(b.result.current.items[1].question).toBe('B 가 고친 물음');
    expect(toastSuccess).toHaveBeenCalledTimes(1);
  });

  it('같은 문항을 고쳐도 명시적 충돌로 멈춘다', async () => {
    const [a, b] = twoTabs();
    act(() => a.result.current.updateAnswer('q1', 'A 의 답'));
    await act(async () => { await a.result.current.save(); });
    act(() => b.result.current.updateAnswer('q1', 'B 의 답'));
    await act(async () => { await b.result.current.save(); });

    expect(savedItems()[0].answer).toBe('A 의 답');
    expect(b.result.current.saveFailure).toBe('conflict');
    expect(b.result.current.items[0].answer).toBe('B 의 답');
  });

  it('한 탭의 연속 저장은 돌려받은 버전으로 이어진다', async () => {
    const [a] = twoTabs();
    act(() => a.result.current.updateAnswer('q1', '첫 교정'));
    await act(async () => { await a.result.current.save(); });
    act(() => a.result.current.updateAnswer('q1', '둘째 교정'));
    await act(async () => { await a.result.current.save(); });

    expect(savedItems()[0].answer).toBe('둘째 교정');
    expect(a.result.current.saveFailure).toBeNull();
    expect(a.result.current.dirty).toBe(false);
  });

  it('⚠️ 모범답안을 만드는 사이 다른 탭이 저장하면 만든 답은 남고 저장은 충돌로 멈춘다', async () => {
    const ai = deferred<unknown>();
    runPrintQaAnswers.mockReturnValue(ai.promise);
    const [a, b] = twoTabs();

    let running!: Promise<number>;
    act(() => { running = b.result.current.generateAnswers([]); });
    act(() => a.result.current.updateAnswer('q1', '교정 답안'));
    await act(async () => { await a.result.current.save(); });

    await act(async () => {
      ai.resolve({
        answers: [{ no: 1, answer: 'AI 모범답안', evidence: '', source: null }], // 고른 것(2번) 안의 1번째
        dropped: { malformed: 0, unknownNo: 0, duplicate: 0 },
        withoutEvidence: 1,
      });
      await running;
    });

    expect(savedItems()[0].answer).toBe('교정 답안');
    expect(savedItems()[1].answer).toBe('');
    expect(b.result.current.items[1].answer).toBe('AI 모범답안');
    expect(b.result.current.dirty).toBe(true);
    expect(b.result.current.saveFailure).toBe('conflict');

    // 사람이 고르면(확인창) 그때 덮는다
    await act(async () => { await b.result.current.overwrite(); });
    expect(savedItems()[1].answer).toBe('AI 모범답안');
    expect(b.result.current.dirty).toBe(false);
    expect(b.result.current.saveFailure).toBeNull();
  });

  it('충돌 뒤 저장된 것을 불러오면 상대 교정을 받고, 그 위에 다시 저장할 수 있다', async () => {
    const [a, b] = twoTabs();
    act(() => a.result.current.updateAnswer('q1', '교정 답안'));
    await act(async () => { await a.result.current.save(); });
    act(() => b.result.current.updateQuestion('q2', 'B 가 고친 물음'));
    await act(async () => { await b.result.current.save(); });

    await act(async () => { await b.result.current.reloadSaved(); });
    expect(b.result.current.items[0].answer).toBe('교정 답안');
    expect(b.result.current.dirty).toBe(false);
    expect(b.result.current.saveFailure).toBeNull();

    act(() => b.result.current.updateQuestion('q2', 'B 가 다시 고친 물음'));
    await act(async () => { await b.result.current.save(); });
    expect(savedItems()[0].answer).toBe('교정 답안');
    expect(savedItems()[1].question).toBe('B 가 다시 고친 물음');
  });

  it('확인창에서 물러서면 불러오기도 덮어쓰기도 하지 않는다', async () => {
    const [a, b] = twoTabs();
    act(() => a.result.current.updateAnswer('q1', '교정 답안'));
    await act(async () => { await a.result.current.save(); });
    act(() => b.result.current.updateAnswer('q1', 'B 의 답'));
    await act(async () => { await b.result.current.save(); });

    vi.spyOn(window, 'confirm').mockReturnValue(false);
    await act(async () => { await b.result.current.reloadSaved(); });
    await act(async () => { await b.result.current.overwrite(); });
    expect(b.result.current.items[0].answer).toBe('B 의 답');
    expect(savedItems()[0].answer).toBe('교정 답안');
  });
});

describe('문답 저장 — 그 사이 원문을 다시 읽었을 때 (코덱스 2R)', () => {
  /** 다른 탭이 '다시 읽기' 를 했다 — 원문이 바뀌고 버전이 오른다(문답 칸은 그대로) */
  function rereadInAnotherTab() {
    db.seq += 1;
    db.row = { ...(db.row as Row), ocr_html: '<p>1. 새로 읽은 물음 답: 새 답</p>', updated_at: `v${db.seq}` };
  }

  it('⚠️ 충돌 뒤 저장된 것을 불러오면 원문도 새것으로 보고 어긋남을 알린다', async () => {
    const [b] = twoTabs();
    expect(b.result.current.stale).toBe(false);
    rereadInAnotherTab();
    act(() => b.result.current.updateAnswer('q1', 'B 의 답'));
    await act(async () => { await b.result.current.save(); });
    expect(b.result.current.saveFailure).toBe('conflict');

    await act(async () => { await b.result.current.reloadSaved(); });
    expect(b.result.current.plain).toContain('새로 읽은 물음');
    expect(b.result.current.stale).toBe(true);
  });

  it('⚠️ 덮어써도 원문은 새것으로 보고, 옛 원문으로 만든 문답이라는 경고가 뜬다', async () => {
    const [b] = twoTabs();
    rereadInAnotherTab();
    act(() => b.result.current.updateAnswer('q1', 'B 의 답'));
    await act(async () => { await b.result.current.save(); });

    await act(async () => { await b.result.current.overwrite(); });
    expect(savedItems()[0].answer).toBe('B 의 답');
    expect(b.result.current.stale).toBe(true);
  });
});

describe('문답 저장 — 지워진 묶음(리뷰 7번)', () => {
  it('⚠️ 다른 탭에서 지운 묶음에 저장하면 성공을 알리지 않고 미저장으로 남긴다', async () => {
    const [a] = twoTabs();
    act(() => a.result.current.updateAnswer('q1', '교정 답안'));
    db.row = null;
    await act(async () => { await a.result.current.save(); });

    expect(db.row).toBeNull();
    expect(a.result.current.dirty).toBe(true);
    expect(a.result.current.saveFailure).toBe('missing');
    expect(a.result.current.items[0].answer).toBe('교정 답안');
    expect(toastSuccess).not.toHaveBeenCalled();
    expect(toastError).toHaveBeenCalledWith(expect.stringContaining('찾지 못했어요'));
  });

  it('⚠️ AI 결과를 저장하기 직전에 지워지면 결과는 화면에 남고 미저장이다', async () => {
    const ai = deferred<unknown>();
    runPrintQaSplit.mockReturnValue(ai.promise);
    const [a] = twoTabs();

    let running!: Promise<number>;
    act(() => { running = a.result.current.split(); });
    db.row = null;
    await act(async () => {
      ai.resolve({
        items: [item('n1', '1', { question: '새로 나눈 물음' })],
        work: { title: '', author: '' }, warnings: [],
        dropped: { malformed: 0, duplicate: 0, answerNotInText: 0 },
      });
      await running;
    });

    expect(a.result.current.items[0].question).toBe('새로 나눈 물음');
    expect(a.result.current.dirty).toBe(true);
    expect(a.result.current.saveFailure).toBe('missing');
  });
});
