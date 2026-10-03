import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { Category } from '@/types';
import type { ReferenceUnit } from '@/types/reference-text';
import UnitPickBody from './UnitPickBody';

const category = (over: Partial<Category> = {}): Category => ({
  id: 'cat-1', level: '중등', year: '', grade: '중2', publisher: '천재(노미숙)',
  semester: '1학기', chapter: '1. 문학', sub_chapter: '(1) 시', user_id: 'u', created_at: '', ...over,
});

const picked: ReferenceUnit = {
  grade: '중2', textbook: '천재(노미숙)', semester: '1학기', unit_path: ['1. 문학', '(1) 시'],
};

/** 접혀 있으면 펼치고, 잎이면 누른다 */
async function open(label: string) {
  const node = (await screen.findByText(label)).closest('[role="button"]')!;
  if (node.getAttribute('aria-expanded') !== 'true') fireEvent.click(node);
}

function renderBody(value: ReferenceUnit[] = [], categories: Category[] | null = [category()]) {
  const onChange = vi.fn<(units: ReferenceUnit[]) => void>();
  render(
    <UnitPickBody categories={categories} failed={false} onRetry={vi.fn()} value={value} onChange={onChange} />,
  );
  return onChange;
}

describe('UnitPickBody', () => {
  it('카테고리 잎을 누르면 그 단원을 붙인다', async () => {
    const onChange = renderBody();
    for (const label of ['중등', '중2', '천재(노미숙)', '1학기', '1. 문학', '(1) 시']) await open(label);
    expect(onChange).toHaveBeenCalledWith([picked]);
  });

  it('이미 붙은 단원은 체크돼 보이고, 다시 누르면 뺀다', async () => {
    const onChange = renderBody([picked]);
    for (const label of ['중등', '중2', '천재(노미숙)', '1학기', '1. 문학']) await open(label);
    expect(screen.getByRole('checkbox')).toHaveProperty('ariaChecked', 'true');
    await open('(1) 시');
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it('여덟 개가 차면 붙이지 않고 그 자리에서 알린다', async () => {
    const full = Array.from({ length: 8 }, (_, i) => ({ ...picked, unit_path: [`${i + 10}. 단원`] }));
    const onChange = renderBody(full);
    for (const label of ['중등', '중2', '천재(노미숙)', '1학기', '1. 문학', '(1) 시']) await open(label);
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByText(/8개까지 붙일 수 있어요/)).toBeTruthy();
  });

  it('⚠️ 대단원이 빈 카테고리는 그리지 않는다 — 눌러도 붙일 단원이 없는 체크 상자가 된다', async () => {
    renderBody([], [category(), category({ id: 'cat-0', publisher: '빈교과서', chapter: '', sub_chapter: '' })]);
    await open('중등');
    await open('중2');
    expect(screen.getByText('천재(노미숙)')).toBeTruthy();
    expect(screen.queryByText('빈교과서')).toBeNull();
  });

  it('검색하면 맞는 단원만 남기고 펼쳐 보인다', () => {
    renderBody([], [category(), category({ id: 'cat-2', publisher: '비상(김진수)', chapter: '3. 소설', sub_chapter: '' })]);
    fireEvent.change(screen.getByLabelText('단원 검색'), { target: { value: '소설' } });
    expect(screen.getByText('3. 소설')).toBeTruthy();
    expect(screen.queryByText('천재(노미숙)')).toBeNull();
  });

  it('읽는 중·실패를 알리고 실패하면 다시 불러올 수 있다', () => {
    const onRetry = vi.fn();
    const { rerender } = render(
      <UnitPickBody categories={null} failed={false} onRetry={onRetry} value={[]} onChange={vi.fn()} />,
    );
    expect(screen.getByText(/불러오는 중/)).toBeTruthy();
    rerender(<UnitPickBody categories={null} failed onRetry={onRetry} value={[]} onChange={vi.fn()} />);
    fireEvent.click(screen.getByText('다시 불러오기'));
    expect(onRetry).toHaveBeenCalled();
  });
});
