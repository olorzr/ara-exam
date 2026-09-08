import { describe, it, expect, vi } from 'vitest';
import { representativeFailure, runOcrBatches } from './batch-run';
import { AiError } from '@/lib/ai/types';

/** 요청한 쪽을 전부 그려 낸 렌더 함수 */
const ok = (images: string[] = ['data:image/jpeg;base64,x']) =>
  vi.fn(async (pages: number[]) => ({ images, rendered: pages, skipped: [] }));

describe('runOcrBatches', () => {
  it('묶음을 순서대로 실행한다 — 병렬로 보내면 한도만 빨리 태운다', async () => {
    const order: number[] = [];
    const runBatch = vi.fn(async ({ index }: { index: number }) => {
      order.push(index);
      return { draft: `d${index}`, rawLength: 10 };
    });

    const res = await runOcrBatches({
      batches: [[1, 2], [2, 3], [3, 4]],
      renderBatch: ok(),
      runBatch,
    });

    expect(order).toEqual([0, 1, 2]);
    expect(res.drafts.map((d) => d.draft)).toEqual(['d0', 'd1', 'd2']);
    expect(res.drafts[1].pages).toEqual([2, 3]);
    expect(res.rawLength).toBe(30);
  });

  it('건너뛴 쪽은 프롬프트의 쪽 목록에서도 빠진다 — 안 그러면 내용이 엉뚱한 쪽으로 기록된다', async () => {
    const runBatch = vi.fn().mockResolvedValue({ draft: 'd', rawLength: 1 });
    const res = await runOcrBatches({
      batches: [[1, 2, 3]],
      // 1쪽이 너무 커서 건너뛰었다 — 이미지는 2·3쪽 두 장뿐이다
      renderBatch: vi.fn().mockResolvedValue({ images: ['b', 'c'], rendered: [2, 3], skipped: [1] }),
      runBatch,
    });

    expect(runBatch).toHaveBeenCalledWith(expect.objectContaining({ pages: [2, 3] }));
    expect(res.drafts[0].pages).toEqual([2, 3]);
    expect(res.warnings.join()).toContain('건너뛴 쪽');
  });

  it('한 묶음이 실패해도 나머지를 계속 읽는다 — 이미 태운 사용량을 버리지 않는다', async () => {
    const runBatch = vi.fn()
      .mockResolvedValueOnce({ draft: 'a', rawLength: 1 })
      .mockRejectedValueOnce(new AiError('timeout'))
      .mockResolvedValueOnce({ draft: 'c', rawLength: 1 });

    const res = await runOcrBatches({
      batches: [[1], [2], [3]],
      renderBatch: ok(),
      runBatch,
    });

    expect(res.drafts.map((d) => d.draft)).toEqual(['a', 'c']);
    expect(res.failures).toHaveLength(1);
    expect(res.fatal).toBeNull();
  });

  it('실패를 반드시 경고로 드러낸다 — 일부만 읽고 다 읽은 척하지 않는다', async () => {
    const res = await runOcrBatches({
      batches: [[1], [2]],
      renderBatch: ok(),
      runBatch: vi.fn()
        .mockResolvedValueOnce({ draft: 'a', rawLength: 1 })
        .mockRejectedValueOnce(new AiError('timeout')),
    });
    expect(res.warnings.join()).toContain('읽지 못했어요');
    expect(res.warnings.join()).toContain('시간이 초과');
  });

  it('한도 초과처럼 반복해도 같은 결과인 오류는 즉시 멈춘다', async () => {
    const runBatch = vi.fn().mockRejectedValue(new AiError('usage_limit_exceeded'));
    const res = await runOcrBatches({
      batches: [[1], [2], [3]],
      renderBatch: ok(),
      runBatch,
    });
    expect(runBatch).toHaveBeenCalledTimes(1);
    expect(res.fatal).toBe('usage_limit_exceeded');
  });

  it('렌더 실패는 AI 를 부르지 않고 건너뛴다', async () => {
    const runBatch = vi.fn().mockResolvedValue({ draft: 'b', rawLength: 1 });
    const res = await runOcrBatches({
      batches: [[1], [2]],
      renderBatch: vi.fn()
        .mockRejectedValueOnce(new Error('PDF 손상'))
        .mockResolvedValueOnce({ images: ['x'], rendered: [2], skipped: [] }),
      runBatch,
    });
    expect(runBatch).toHaveBeenCalledTimes(1);
    expect(res.failures[0]).toMatchObject({ kind: 'render', batch: 1 });
  });

  it('이미지가 하나도 안 만들어지면 보내지 않는다', async () => {
    const runBatch = vi.fn();
    const res = await runOcrBatches({
      batches: [[1]],
      renderBatch: vi.fn().mockResolvedValue({ images: [], rendered: [], skipped: [1] }),
      runBatch,
    });
    expect(runBatch).not.toHaveBeenCalled();
    expect(res.warnings.join()).toContain('건너뛴 쪽');
  });

  it('취소하면 남은 묶음을 보내지 않고 읽은 것은 남긴다', async () => {
    const controller = new AbortController();
    const runBatch = vi.fn(async ({ index }: { index: number }) => {
      if (index === 0) controller.abort();
      return { draft: `d${index}`, rawLength: 1 };
    });

    const res = await runOcrBatches({
      batches: [[1], [2], [3]],
      renderBatch: ok(),
      runBatch,
      signal: controller.signal,
    });

    expect(runBatch).toHaveBeenCalledTimes(1);
    expect(res.fatal).toBe('cancelled');
    expect(res.drafts).toHaveLength(1);
    expect(res.warnings.join()).toContain('취소하기 전까지');
  });

  it('렌더 도중 취소되면 AI 를 부르지 않는다 — 한도 절약', async () => {
    const controller = new AbortController();
    const runBatch = vi.fn().mockResolvedValue({ draft: 'x', rawLength: 1 });
    const res = await runOcrBatches({
      batches: [[1]],
      renderBatch: vi.fn(async () => {
        controller.abort();
        return { images: ['x'], rendered: [1], skipped: [] };
      }),
      runBatch,
      signal: controller.signal,
    });
    expect(runBatch).not.toHaveBeenCalled();
    expect(res.fatal).toBe('cancelled');
  });

  it('진행률을 묶음 단위로 알린다', async () => {
    const onProgress = vi.fn();
    await runOcrBatches({
      batches: [[1], [2]],
      renderBatch: ok(),
      runBatch: vi.fn().mockResolvedValue({ draft: 'x', rawLength: 1 }),
      onProgress,
    });
    expect(onProgress).toHaveBeenCalledWith(1, 2);
    expect(onProgress).toHaveBeenCalledWith(2, 2);
  });
});

describe('representativeFailure', () => {
  const base = { drafts: [], warnings: [], imagesSent: 0, rawLength: 0 };

  it('중단시킨 코드를 최우선으로 고른다', () => {
    const failure = representativeFailure({
      ...base,
      failures: [{ kind: 'render', batch: 1, message: '' }, { kind: 'ai', batch: 2, code: 'unauthorized' }],
      fatal: 'unauthorized',
    });
    expect(failure).toMatchObject({ kind: 'ai', code: 'unauthorized' });
  });

  it('AI 실패가 렌더 실패보다 구체적이다', () => {
    const failure = representativeFailure({
      ...base,
      failures: [{ kind: 'render', batch: 1, message: 'x' }, { kind: 'ai', batch: 2, code: 'timeout' }],
      fatal: null,
    });
    expect(failure).toMatchObject({ kind: 'ai', code: 'timeout' });
  });

  it('실패가 없으면 null', () => {
    expect(representativeFailure({ ...base, failures: [], fatal: null })).toBeNull();
  });
});
