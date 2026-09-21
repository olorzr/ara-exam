import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import WorkTreePanel from './WorkTreePanel';
import type { WorkFacet } from '@/lib/problem-bank/facets';
import { EMPTY_FILTERS, type ProblemFilters } from '@/lib/problem-bank/filters';

/**
 * ⚠️ 이 환경의 `window.localStorage` 는 메서드가 없는 빈 객체다(jsdom 28 + vitest 4).
 *    정렬 선택이 **남는지** 보려면 진짜 저장소를 세워야 한다(`work-tree-pref.test.ts` 와 같은 사정).
 */
function fakeStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() { return map.size; },
    clear: () => map.clear(),
    getItem: (k: string) => map.get(k) ?? null,
    key: (i: number) => [...map.keys()][i] ?? null,
    removeItem: (k: string) => { map.delete(k); },
    setItem: (k: string, v: string) => { map.set(k, v); },
  };
}

const original = Object.getOwnPropertyDescriptor(window, 'localStorage');

const WORKS: WorkFacet[] = [
  { title: '동백꽃', author: '김유정', count: 14, kind: 'literary' },
  { title: '홍길동전', author: '', count: 1, kind: 'literary' },
  { title: '거울 뉴런', author: '', count: 2, kind: 'nonliterary' },
  { title: '통일 시대의 우리말', author: '권재일', count: 27, kind: 'nonliterary' },
];

function renderPanel(filters: Partial<ProblemFilters> = {}, onChange = vi.fn()) {
  render(
    <WorkTreePanel
      filters={{ ...EMPTY_FILTERS, ...filters }}
      works={WORKS}
      onChange={onChange}
    />,
  );
  return onChange;
}

/**
 * 정렬 칸의 팝업은 열지 않는다 — base-ui Select 는 포털 + 포인터 이벤트라
 * `fireEvent` 로는 실제 조작을 흉내 낼 수 없다. 대신 **저장된 선택으로 렌더**해
 * 같은 경로(lazy 초기화 → `buildWorkTree(works, order)`)를 지난다.
 * 칸 자체가 값을 저장하는지는 `work-tree-pref.test.ts` 가 따로 고정한다.
 */
function storeOrder(order: string) {
  window.localStorage.setItem('ara-work-tree-order', order);
}

describe('WorkTreePanel', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'localStorage', {
      value: fakeStorage(), configurable: true, writable: true,
    });
  });
  afterEach(() => {
    if (original) Object.defineProperty(window, 'localStorage', original);
  });

  it('문학과 비문학을 갈라 보여 준다 — 비문학이 작품 사이에 섞이면 안 된다', () => {
    renderPanel();
    expect(screen.getByText('문학')).toBeTruthy();
    expect(screen.getByText('비문학')).toBeTruthy();
  });

  it('기본은 지은이순이라 지은이 폴더가 보인다', () => {
    renderPanel();
    expect(screen.getByText('김유정')).toBeTruthy();
    expect(screen.getByText('권재일')).toBeTruthy();
    // 갈래마다 따로 선다 — 문학의 『홍길동전』과 비문학의 『거울 뉴런』이 한 폴더에 섞이면 안 된다
    expect(screen.getAllByText('지은이 미입력')).toHaveLength(2);
    expect(screen.getByRole('combobox', { name: '작품 트리 정렬' }).textContent)
      .toContain('지은이순');
  });

  it('작품명순으로 열면 지은이 폴더가 사라지고 잎에 지은이가 붙는다', () => {
    storeOrder('title');
    renderPanel();

    expect(screen.queryByText('김유정')).toBeNull();
    expect(screen.getByText('동백꽃 — 김유정 (14)')).toBeTruthy();
    // 지은이를 모르는 작품은 제목만
    expect(screen.getByText('홍길동전 (1)')).toBeTruthy();
    // 갈래는 정렬과 무관하게 그대로다
    expect(screen.getByText('비문학')).toBeTruthy();
    expect(screen.getByRole('combobox', { name: '작품 트리 정렬' }).textContent)
      .toContain('작품명순');
  });

  it('저장값이 이상하면 기본 정렬로 연다 — 빈 트리가 되면 안 된다', () => {
    storeOrder('count');
    renderPanel();

    expect(screen.getByText('김유정')).toBeTruthy();
    expect(screen.getByRole('combobox', { name: '작품 트리 정렬' }).textContent)
      .toContain('지은이순');
  });

  it('작품을 누르면 그 작품으로 조건을 건다', () => {
    const onChange = renderPanel();

    fireEvent.click(screen.getByText('동백꽃 (14)'));

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      work_title: '동백꽃', page: 0, school_name: '', unit_path: [],
    }));
  });

  it('작품명순으로 눌러도 같은 조건이 걸린다', () => {
    storeOrder('title');
    const onChange = renderPanel();

    fireEvent.click(screen.getByText('동백꽃 — 김유정 (14)'));

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ work_title: '동백꽃' }));
  });

  it('조건이 걸려 있을 때만 해제가 보인다', () => {
    renderPanel();
    expect(screen.queryByRole('button', { name: '해제' })).toBeNull();
  });
});
