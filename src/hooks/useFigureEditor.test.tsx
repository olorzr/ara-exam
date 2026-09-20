import { describe, expect, it, vi, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';

const uploadFigure = vi.fn();
const error = vi.fn();
const success = vi.fn();

vi.mock('@/lib/problem-bank/figure-capture', async () => {
  const real = await vi.importActual<
    typeof import('@/lib/problem-bank/figure-capture')
  >('@/lib/problem-bank/figure-capture');
  return { ...real, uploadFigure: (...args: unknown[]) => uploadFigure(...args) };
});

vi.mock('sonner', () => ({ toast: { error: (m: string) => error(m), success: (m: string) => success(m) } }));

const { useFigureEditor } = await import('./useFigureEditor');

const fig = (n: number) => `<figure data-figure="${n}"></figure>`;
const BBOX = { x: 0.1, y: 0.2, w: 0.3, h: 0.4 };
const URL = 'https://signed.example/page-3.jpg';

/**
 * 카드가 하는 일을 흉내 낸다 — 본문·경로를 **부를 때** 읽어 주고,
 * 반영·저장을 순서까지 기록한다.
 */
function harness(initial: { html: string; paths: string[] }) {
  const state = { ...initial };
  const order: string[] = [];
  return {
    state,
    order,
    input: {
      kind: 'problem' as const,
      id: '0f9c2b1a-1111-4222-8333-444455556666',
      read: () => { order.push(`read:${state.html}`); return state; },
      apply: (next: { html: string; paths: string[] }) => {
        order.push('apply');
        state.html = next.html;
        state.paths = next.paths;
      },
      save: async (next: { html: string; paths: string[] }) => {
        order.push(`save:${next.paths.join(',')}`);
        return true;
      },
    },
  };
}

beforeEach(() => {
  uploadFigure.mockReset().mockResolvedValue('problems/x/figure-newtoken123.jpg');
  error.mockReset();
  success.mockReset();
});

describe('useFigureEditor.recapture — 잘못 잘린 그림 다시 자르기', () => {
  it('그 번호 자리만 갈아끼우고 본문은 건드리지 않는다 — 칩을 다시 옮기지 않아도 된다', async () => {
    const h = harness({ html: `${fig(1)}<p>글</p>${fig(2)}`, paths: ['a.jpg', 'b.jpg'] });
    const { result } = renderHook(() => useFigureEditor(h.input));

    await act(async () => { await result.current.recapture(2, BBOX, URL, ['a.jpg', 'b.jpg']); });

    expect(h.state.paths).toEqual(['a.jpg', 'problems/x/figure-newtoken123.jpg']);
    expect(h.state.html).toBe(`${fig(1)}<p>글</p>${fig(2)}`);
    expect(success).toHaveBeenCalledWith('2번 그림을 다시 잘랐어요.');
  });

  it('⚠️ 본문은 올린 **뒤에** 읽는다 — 파일이 올라가는 동안 친 글을 잃지 않는다', async () => {
    const h = harness({ html: '<p>처음</p>', paths: ['a.jpg'] });
    uploadFigure.mockImplementation(async () => {
      // 올라가는 동안 선생님이 글을 더 친다
      h.state.html = '<p>처음</p><p>올라가는 동안 친 글</p>';
      return 'problems/x/figure-newtoken123.jpg';
    });
    const { result } = renderHook(() => useFigureEditor(h.input));

    await act(async () => { await result.current.recapture(1, BBOX, URL, ['a.jpg']); });

    expect(h.state.html).toBe('<p>처음</p><p>올라가는 동안 친 글</p>');
    expect(h.order.filter((o) => o.startsWith('save:'))).toEqual([
      'save:problems/x/figure-newtoken123.jpg',
    ]);
  });

  it('⚠️ 저장을 기다리기 전에 화면에 반영한다 — 그 왕복 동안 친 글도 지킨다', async () => {
    const h = harness({ html: '<p>글</p>', paths: ['a.jpg'] });
    const { result } = renderHook(() => useFigureEditor(h.input));

    await act(async () => { await result.current.recapture(1, BBOX, URL, ['a.jpg']); });

    expect(h.order.indexOf('apply')).toBeLessThan(
      h.order.findIndex((o) => o.startsWith('save:')),
    );
  });

  it('없는 번호면 올리지도 않는다 — 어디에도 안 붙을 파일을 만들지 않는다', async () => {
    const h = harness({ html: '<p>글</p>', paths: ['a.jpg'] });
    const { result } = renderHook(() => useFigureEditor(h.input));

    await act(async () => { await result.current.recapture(3, BBOX, URL, ['a.jpg']); });

    expect(uploadFigure).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalled();
    expect(h.state.paths).toEqual(['a.jpg']);
  });

  it('잘라내지 못하면 본문도 경로도 그대로다', async () => {
    uploadFigure.mockResolvedValue(null);
    const h = harness({ html: '<p>글</p>', paths: ['a.jpg'] });
    const { result } = renderHook(() => useFigureEditor(h.input));

    await act(async () => { await result.current.recapture(1, BBOX, URL, ['a.jpg']); });

    expect(h.state.paths).toEqual(['a.jpg']);
    expect(h.order).not.toContain('apply');
    expect(error).toHaveBeenCalled();
  });

  it("만들지 못한 빈 자리('')도 다시 자를 수 있다", async () => {
    const h = harness({ html: `${fig(1)}${fig(2)}`, paths: ['a.jpg', ''] });
    const { result } = renderHook(() => useFigureEditor(h.input));

    await act(async () => { await result.current.recapture(2, BBOX, URL, ['a.jpg', '']); });

    expect(h.state.paths).toEqual(['a.jpg', 'problems/x/figure-newtoken123.jpg']);
  });

  it('올리는 사이 그 그림이 빠졌으면 갈아끼우지 않는다 — 엉뚱한 자리를 덮어쓰지 않는다', async () => {
    const h = harness({ html: `${fig(1)}${fig(2)}`, paths: ['a.jpg', 'b.jpg'] });
    uploadFigure.mockImplementation(async () => {
      h.state.paths = ['a.jpg'];
      h.state.html = fig(1);
      return 'problems/x/figure-newtoken123.jpg';
    });
    const { result } = renderHook(() => useFigureEditor(h.input));

    await act(async () => { await result.current.recapture(2, BBOX, URL, ['a.jpg', 'b.jpg']); });

    expect(h.state.paths).toEqual(['a.jpg']);
    expect(h.order).not.toContain('apply');
    expect(error).toHaveBeenCalled();
  });

  it('⚠️ 누르고 나서 앞 그림이 빠졌으면 그 번호를 덮어쓰지 않는다 — 번호는 당겨진다', async () => {
    // A B C 에서 2번(B)을 다시 자르려는데 A 가 빠지면 2번이 C 가 된다
    const h = harness({ html: `${fig(1)}${fig(2)}${fig(3)}`, paths: ['a.jpg', 'b.jpg', 'c.jpg'] });
    const { result } = renderHook(() => useFigureEditor(h.input));
    const expected = ['a.jpg', 'b.jpg', 'c.jpg'];
    h.state.paths = ['b.jpg', 'c.jpg'];

    await act(async () => { await result.current.recapture(2, BBOX, URL, expected); });

    expect(uploadFigure).not.toHaveBeenCalled();
    expect(h.state.paths).toEqual(['b.jpg', 'c.jpg']);
    expect(error).toHaveBeenCalled();
  });

  it('⚠️ 올리는 사이 앞 그림이 빠져도 덮어쓰지 않는다 — 올린 파일은 버린다', async () => {
    const h = harness({ html: `${fig(1)}${fig(2)}${fig(3)}`, paths: ['a.jpg', 'b.jpg', 'c.jpg'] });
    uploadFigure.mockImplementation(async () => {
      h.state.paths = ['b.jpg', 'c.jpg'];
      return 'problems/x/figure-newtoken123.jpg';
    });
    const { result } = renderHook(() => useFigureEditor(h.input));

    await act(async () => {
      await result.current.recapture(2, BBOX, URL, ['a.jpg', 'b.jpg', 'c.jpg']);
    });

    expect(h.state.paths).toEqual(['b.jpg', 'c.jpg']);
    expect(h.order).not.toContain('apply');
    expect(error).toHaveBeenCalled();
  });

  it('⚠️ 빈 자리가 여럿이면 번호만으로는 못 가린다 — 목록 전체를 견준다', async () => {
    // ['a','',''] 에서 2번 빈 자리를 잡는 사이 2번이 빠지면 ['a',''] 가 되는데,
    // 그 자리도 '' 라 자리 하나만 보면 **원래 3번이던 자리**를 채운다
    const h = harness({ html: `${fig(1)}${fig(2)}${fig(3)}`, paths: ['a.jpg', '', ''] });
    const { result } = renderHook(() => useFigureEditor(h.input));
    const expected = ['a.jpg', '', ''];
    h.state.paths = ['a.jpg', ''];

    await act(async () => { await result.current.recapture(2, BBOX, URL, expected); });

    expect(uploadFigure).not.toHaveBeenCalled();
    expect(h.state.paths).toEqual(['a.jpg', '']);
    expect(error).toHaveBeenCalled();
  });

  it('⚠️ 저장이 실패해 화면 목록만 바뀐 경우에도 막는다 — 그때는 판이 그대로다', async () => {
    // 빼기는 저장을 기다리기 전에 화면부터 고치므로, 저장이 실패하면 `updated_at` 이
    // 그대로라 잡기가 살아 있다. 마지막 방패가 이 대조다
    const h = harness({ html: `${fig(1)}${fig(2)}`, paths: ['a.jpg', 'b.jpg'] });
    const { result } = renderHook(() => useFigureEditor(h.input));
    const expected = ['a.jpg', 'b.jpg'];
    h.state.paths = ['a.jpg'];

    await act(async () => { await result.current.recapture(2, BBOX, URL, expected); });

    expect(uploadFigure).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalled();
  });
});

describe('useFigureEditor.capture — 붙이기는 예전 그대로', () => {
  it('끝에 붙고 자리표시자가 하나 는다', async () => {
    const h = harness({ html: '<p>글</p>', paths: ['a.jpg'] });
    const { result } = renderHook(() => useFigureEditor(h.input));

    await act(async () => { await result.current.capture(BBOX, URL); });

    expect(h.state.paths).toEqual(['a.jpg', 'problems/x/figure-newtoken123.jpg']);
    expect(h.state.html).toBe(`<p>글</p>${fig(2)}`);
  });

  it('상한(9)이 차면 올리지 않는다', async () => {
    const paths = Array.from({ length: 9 }, (_, i) => `${i}.jpg`);
    const h = harness({ html: '<p>글</p>', paths });
    const { result } = renderHook(() => useFigureEditor(h.input));

    await act(async () => { await result.current.capture(BBOX, URL); });

    expect(uploadFigure).not.toHaveBeenCalled();
    expect(h.state.paths).toHaveLength(9);
  });
});
