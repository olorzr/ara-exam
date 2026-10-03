import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { WorkFacet } from '@/lib/problem-bank/facets';
import WorkPickBody from './WorkPickBody';

const WORKS: WorkFacet[] = [
  { title: '동백꽃', author: '김유정', count: 14, kind: 'literary' },
  { title: '봄봄', author: '김유정', count: 3, kind: 'literary' },
  { title: '진달래꽃', author: '김소월', count: 5, kind: 'literary' },
  { title: '통일 시대의 우리말', author: '권재일', count: 2, kind: 'nonliterary' },
];

function renderBody(facets: WorkFacet[] | null = WORKS, failed = false) {
  const onPick = vi.fn();
  const onRetry = vi.fn();
  render(<WorkPickBody facets={facets} failed={failed} onRetry={onRetry} onPick={onPick} />);
  return { onPick, onRetry };
}

describe('WorkPickBody', () => {
  it('문제 은행 작품 트리에서 고르면 제목·지은이를 넘긴다', () => {
    const { onPick } = renderBody();
    // 첫 화면은 갈래만 펼쳐 지은이 폴더가 보인다
    fireEvent.click(screen.getByText('김유정'));
    fireEvent.click(screen.getByText('봄봄 (3)'));
    expect(onPick).toHaveBeenCalledWith({ title: '봄봄', author: '김유정' });
  });

  it('검색하면 맞는 작품만 남기고 폴더를 펼쳐 바로 보인다', () => {
    renderBody();
    fireEvent.change(screen.getByLabelText('작품 검색'), { target: { value: '진달래' } });
    expect(screen.getByText('진달래꽃 (5)')).toBeTruthy();
    expect(screen.queryByText('김유정')).toBeNull();
  });

  it('지은이로도 찾는다', () => {
    renderBody();
    fireEvent.change(screen.getByLabelText('작품 검색'), { target: { value: '김유정' } });
    expect(screen.getByText('동백꽃 (14)')).toBeTruthy();
    expect(screen.getByText('봄봄 (3)')).toBeTruthy();
  });

  it('맞는 작품이 없으면 직접 적어도 된다고 알린다', () => {
    renderBody();
    fireEvent.change(screen.getByLabelText('작품 검색'), { target: { value: '없는작품' } });
    expect(screen.getByText(/제목을 직접 적어도 됩니다/)).toBeTruthy();
  });

  it('읽는 중·실패를 알리고 실패하면 다시 불러올 수 있다', () => {
    renderBody(null);
    expect(screen.getByText(/불러오는 중/)).toBeTruthy();
  });

  it('실패하면 다시 불러오기 단추를 준다', () => {
    const { onRetry } = renderBody(null, true);
    fireEvent.click(screen.getByText('다시 불러오기'));
    expect(onRetry).toHaveBeenCalled();
  });
});
