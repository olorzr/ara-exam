import { describe, expect, it, vi, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';

const info = vi.fn();
vi.mock('sonner', () => ({ toast: { info: (m: string) => info(m) } }));

const { useFigureCapture } = await import('./useFigureCapture');

const BBOX = { x: 0.1, y: 0.2, w: 0.3, h: 0.4 };
const URL = 'https://signed.example/page-3.jpg';

/** 쪽·카드 판을 손으로 정해 두고 훅을 띄운다 */
function setup(options?: { page?: number }) {
  const setPage = vi.fn();
  /** 항목 id → 판(마운트 세대 + 저장 버전). 없으면 지워진 항목이다 */
  const versions = new Map<string, string>([['A', '0:0|v1'], ['B', '0:0|v1']]);
  const { result, rerender } = renderHook(() => useFigureCapture({
    pageOf: (id: string) => (id === 'A' ? (options?.page ?? 3) : 5),
    versionOf: (id: string) => versions.get(id) ?? null,
    setPage,
  }));
  return { result, rerender, setPage, versions };
}

beforeEach(() => info.mockReset());

describe('useFigureCapture', () => {
  it('켜면 그 항목이 실린 쪽으로 원본을 넘긴다 — 잡을 그림이 거기 있다', () => {
    const { result, setPage } = setup({ page: 3 });
    act(() => result.current.start('A', vi.fn()));
    expect(setPage).toHaveBeenCalledWith(3);
    expect(result.current.target?.id).toBe('A');
    expect(result.current.target?.figureIndex).toBe(null);
  });

  it('같은 카드의 같은 자리를 다시 누르면 그만둔다', () => {
    const { result } = setup();
    act(() => result.current.start('A', vi.fn(), 2));
    act(() => result.current.start('A', vi.fn(), 2));
    expect(result.current.target).toBe(null);
  });

  it('같은 카드라도 다른 그림이면 그 자리로 갈아 낀다 — 끄고 다시 누르지 않아도 된다', () => {
    const { result } = setup();
    act(() => result.current.start('A', vi.fn(), 2));
    act(() => result.current.start('A', vi.fn(), 3));
    expect(result.current.target?.figureIndex).toBe(3);
  });

  it("'그림 추가' 와 '다시 자르기' 는 서로 다른 자리다", () => {
    const { result } = setup();
    act(() => result.current.start('A', vi.fn()));
    act(() => result.current.start('A', vi.fn(), 1));
    expect(result.current.target?.figureIndex).toBe(1);
  });

  it('잡은 영역을 기다리던 카드에 넘기고 잡기를 끝낸다', () => {
    const { result } = setup();
    const onBbox = vi.fn();
    act(() => result.current.start('A', onBbox, 2));
    act(() => result.current.deliver(BBOX, URL));
    expect(onBbox).toHaveBeenCalledWith(BBOX, URL);
    expect(result.current.target).toBe(null);
  });

  it('⚠️ 카드가 다시 마운트되면 잡기를 무효로 본다 — 옛 본문으로 새 본문을 덮지 않는다', () => {
    const { result, rerender, versions } = setup();
    const onBbox = vi.fn();
    act(() => result.current.start('A', onBbox, 1));
    versions.set('A', '1:0|v1');
    rerender();
    expect(result.current.target).toBe(null);
    act(() => result.current.deliver(BBOX, URL));
    expect(onBbox).not.toHaveBeenCalled();
  });

  it('⚠️ 기다리는 사이 그 카드를 저장하면 잡기를 무효로 본다 — 옛 버전으로 저장하면 충돌한다', () => {
    const { result, rerender, versions } = setup();
    const onBbox = vi.fn();
    act(() => result.current.start('A', onBbox, 1));
    versions.set('A', '0:0|v2');
    rerender();
    expect(result.current.target).toBe(null);
    act(() => result.current.deliver(BBOX, URL));
    expect(onBbox).not.toHaveBeenCalled();
  });

  it('지워진 항목은 잡기를 시작하지도 않는다 — 없는 행에 저장하러 가지 않는다', () => {
    const { result, setPage } = setup();
    act(() => result.current.start('없는id', vi.fn(), 1));
    expect(result.current.target).toBe(null);
    expect(setPage).not.toHaveBeenCalled();
  });

  it('기다리던 항목이 지워지면 잡기가 사라진다', () => {
    const { result, rerender, versions } = setup();
    act(() => result.current.start('A', vi.fn(), 1));
    versions.delete('A');
    rerender();
    expect(result.current.target).toBe(null);
  });

  it('그만두면 대상이 사라진다', () => {
    const { result } = setup();
    act(() => result.current.start('A', vi.fn()));
    act(() => result.current.cancel());
    expect(result.current.target).toBe(null);
  });

  it('안내 문구가 두 갈래다 — 붙이는 것과 그 자리만 바꾸는 것은 다른 일이다', () => {
    const { result } = setup();
    expect(result.current.banner).toBe(null);
    act(() => result.current.start('A', vi.fn()));
    expect(result.current.banner).toContain('본문 끝에 붙습니다');
    act(() => result.current.start('A', vi.fn(), 2));
    expect(result.current.banner).toContain('2번 그림');
    expect(result.current.banner).toContain('칩은 그대로');
  });

  it('판이 달라져 잡기가 사라지면 까닭을 알린다 — 배너가 말없이 없어지면 고장인 줄 안다', () => {
    const { result, rerender, versions } = setup();
    act(() => result.current.start('A', vi.fn(), 1));
    expect(info).not.toHaveBeenCalled();

    versions.set('A', '0:0|v2');
    rerender();
    expect(info).toHaveBeenCalledTimes(1);

    // 같은 일로 두 번 알리지 않는다
    rerender();
    expect(info).toHaveBeenCalledTimes(1);
  });

  it('사람이 그만두거나 다 넘긴 경우에는 알리지 않는다 — 스스로 한 일이다', () => {
    const { result } = setup();
    act(() => result.current.start('A', vi.fn(), 1));
    act(() => result.current.cancel());
    expect(info).not.toHaveBeenCalled();

    act(() => result.current.start('A', vi.fn(), 1));
    act(() => result.current.deliver(BBOX, URL));
    expect(info).not.toHaveBeenCalled();
  });
});
