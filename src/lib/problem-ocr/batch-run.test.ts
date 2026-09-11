import { describe, it, expect, vi } from 'vitest';
import { representativeFailure, runOcrBatches } from './batch-run';
import { AiError } from '@/lib/ai/types';
import { toWarningObject, warningText } from './warnings';

/** 쪽 번호를 '쪽 전체 한 장' 짜리 렌더 결과로 */
const asFull = (pages: number[]) => pages.map((page) => ({ page, part: 'full' as const }));

/** 요청한 쪽을 전부 그려 낸 렌더 함수 */
const ok = (images: string[] = ['data:image/jpeg;base64,x']) =>
  vi.fn(async (pages: number[]) => ({ images, rendered: asFull(pages), skipped: [] }));

/** 경고를 한 줄로 이어 본다 */
const said = (res: { warnings: Parameters<typeof warningText>[0][] }) =>
  res.warnings.map(warningText).join(' | ');

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
      renderBatch: vi.fn().mockResolvedValue({ images: ['b', 'c'], rendered: asFull([2, 3]), skipped: [1] }),
      runBatch,
    });

    expect(runBatch).toHaveBeenCalledWith(expect.objectContaining({ pages: [2, 3] }));
    expect(res.drafts[0].pages).toEqual([2, 3]);
    expect(said(res)).toContain('건너뛴 쪽');
    expect(toWarningObject(res.warnings[0]).targets).toEqual([{ kind: 'page', page: 1, label: '1쪽' }]);
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
    expect(said(res)).toContain('읽지 못했어요');
    expect(said(res)).toContain('시간이 초과');
    // '2번째 묶음' 은 우리 사정이다 — 선생님이 볼 수 있는 것은 쪽 번호다
    expect(said(res)).toContain('2쪽');
    expect(toWarningObject(res.warnings[0]).targets).toEqual([{ kind: 'page', page: 2, label: '2쪽' }]);
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
        .mockResolvedValueOnce({ images: ['x'], rendered: asFull([2]), skipped: [] }),
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
    expect(said(res)).toContain('건너뛴 쪽');
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
    expect(said(res)).toContain('취소하기 전까지');
  });

  it('렌더 도중 취소되면 AI 를 부르지 않는다 — 한도 절약', async () => {
    const controller = new AbortController();
    const runBatch = vi.fn().mockResolvedValue({ draft: 'x', rawLength: 1 });
    const res = await runOcrBatches({
      batches: [[1]],
      renderBatch: vi.fn(async () => {
        controller.abort();
        return { images: ['x'], rendered: asFull([1]), skipped: [] };
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
  const base = { drafts: [], warnings: [], imagesSent: 0, rawLength: 0, retries: 0 };
  const at = (batch: number) => ({ pages: [batch], retried: false });

  it('중단시킨 코드를 최우선으로 고른다', () => {
    const failure = representativeFailure({
      ...base,
      failures: [
        { kind: 'render', batch: 1, message: '', ...at(1) },
        { kind: 'ai', batch: 2, code: 'unauthorized', ...at(2) },
      ],
      fatal: 'unauthorized',
    });
    expect(failure).toMatchObject({ kind: 'ai', code: 'unauthorized' });
  });

  it('AI 실패가 렌더 실패보다 구체적이다', () => {
    const failure = representativeFailure({
      ...base,
      failures: [
        { kind: 'render', batch: 1, message: 'x', ...at(1) },
        { kind: 'ai', batch: 2, code: 'timeout', ...at(2) },
      ],
      fatal: null,
    });
    expect(failure).toMatchObject({ kind: 'ai', code: 'timeout' });
  });

  it('실패가 없으면 null', () => {
    expect(representativeFailure({ ...base, failures: [], fatal: null })).toBeNull();
  });
});

describe('runOcrBatches — 실패한 묶음 다시 읽기', () => {
  it('실패한 묶음을 쪽 하나씩 쪼개 다시 읽는다 — 겹침이 1쪽뿐이라 가운데 쪽은 이 묶음만 본다', async () => {
    const runBatch = vi.fn(async ({ pages }: { pages: number[] }) => {
      // 3쪽을 한꺼번에 보내면 출력이 길어 워치독에 걸린다(실제로 흔한 실패다)
      if (pages.length > 1) throw new AiError('timeout');
      return { draft: `p${pages[0]}`, rawLength: 1 };
    });

    const res = await runOcrBatches({
      batches: [[1, 2, 3]],
      renderBatch: ok(),
      runBatch,
    });

    expect(res.drafts.map((d) => d.draft)).toEqual(['p1', 'p2', 'p3']);
    expect(res.drafts.map((d) => d.pages)).toEqual([[1], [2], [3]]);
    expect(res.retries).toBe(3);
    // 다 살렸으면 실패가 아니다 — 없는 경고로 겁주지 않는다
    expect(res.failures).toHaveLength(0);
    expect(said(res)).not.toContain('읽지 못했어요');
  });

  it('일부만 살아나면 **끝내 못 읽은 쪽만** 경고에 싣는다', async () => {
    const runBatch = vi.fn(async ({ pages }: { pages: number[] }) => {
      if (pages.length > 1 || pages[0] === 2) throw new AiError('timeout');
      return { draft: `p${pages[0]}`, rawLength: 1 };
    });

    const res = await runOcrBatches({
      batches: [[1, 2, 3]],
      renderBatch: ok(),
      runBatch,
    });

    expect(res.drafts.map((d) => d.draft)).toEqual(['p1', 'p3']);
    expect(res.failures[0].pages).toEqual([2]);
    expect(said(res)).toContain('다시 시도했지만');
    expect(said(res)).toContain('2쪽');
    expect(said(res)).not.toContain('1쪽');
  });

  it('한 쪽짜리 묶음은 그대로 한 번 더 — 일시적인 실패가 대부분이다', async () => {
    const runBatch = vi.fn()
      .mockRejectedValueOnce(new AiError('invalid_output'))
      .mockResolvedValueOnce({ draft: 'a', rawLength: 1 });

    const res = await runOcrBatches({ batches: [[5]], renderBatch: ok(), runBatch });

    expect(runBatch).toHaveBeenCalledTimes(2);
    expect(res.drafts.map((d) => d.draft)).toEqual(['a']);
    expect(res.retries).toBe(1);
  });

  it('한도 초과는 다시 시도하지 않는다 — 같은 결과가 나오고 한도만 더 태운다', async () => {
    const runBatch = vi.fn().mockRejectedValue(new AiError('usage_limit_exceeded'));
    const res = await runOcrBatches({ batches: [[1, 2, 3]], renderBatch: ok(), runBatch });

    expect(runBatch).toHaveBeenCalledTimes(1);
    expect(res.retries).toBe(0);
    expect(res.fatal).toBe('usage_limit_exceeded');
    expect(res.failures[0].pages).toEqual([1, 2, 3]);
  });

  it('렌더가 통째로 죽어도 쪽을 쪼개면 성한 쪽은 건진다', async () => {
    const renderBatch = vi.fn(async (pages: number[]) => {
      // 2쪽이 pdf.js 를 죽인다 — 예전에는 1·3쪽까지 함께 잃었다
      if (pages.includes(2) && pages.length > 1) throw new Error('PDF 손상');
      if (pages[0] === 2) throw new Error('PDF 손상');
      return { images: ['x'], rendered: asFull(pages), skipped: [] };
    });
    const res = await runOcrBatches({
      batches: [[1, 2, 3]],
      renderBatch,
      runBatch: vi.fn(async ({ pages }: { pages: number[] }) => ({ draft: `p${pages[0]}`, rawLength: 1 })),
    });

    expect(res.drafts.map((d) => d.draft)).toEqual(['p1', 'p3']);
    expect(res.failures[0]).toMatchObject({ kind: 'render', pages: [2] });
  });

  it('재시도 중 한도에 걸리면 그 자리에서 멈춘다 — 계속 보내면 한도만 더 태운다', async () => {
    const runBatch = vi.fn(async ({ pages }: { pages: number[] }) => {
      if (pages.length > 1) throw new AiError('timeout');
      if (pages[0] === 1) return { draft: 'p1', rawLength: 1 };
      throw new AiError('usage_limit_exceeded');
    });

    const res = await runOcrBatches({ batches: [[1, 2, 3]], renderBatch: ok(), runBatch });

    // 첫 시도 + 1쪽 + 2쪽(한도) = 3번. 3쪽은 보내지 않는다
    expect(runBatch).toHaveBeenCalledTimes(3);
    expect(res.fatal).toBe('usage_limit_exceeded');
    // 안 보낸 쪽도 **잃은 쪽**이다 — 조용히 빠뜨리면 안 된다
    expect(res.failures[0].pages).toEqual([2, 3]);
  });

  it('이미지를 하나도 못 만든 묶음은 다시 시도하지 않는다 — 쪽마다 이미 예산을 쟀다', async () => {
    const renderBatch = vi.fn().mockResolvedValue({ images: [], rendered: [], skipped: [1, 2] });
    const res = await runOcrBatches({ batches: [[1, 2]], renderBatch, runBatch: vi.fn() });

    expect(renderBatch).toHaveBeenCalledTimes(1);
    expect(res.retries).toBe(0);
  });
});
