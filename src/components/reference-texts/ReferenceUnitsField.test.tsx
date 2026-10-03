import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { ReferenceUnit } from '@/types/reference-text';

const getAllSelectableCategories = vi.fn().mockResolvedValue([]);
vi.mock('@/lib/category-master', () => ({
  getAllSelectableCategories: (...a: unknown[]) => getAllSelectableCategories(...a),
}));

const { default: ReferenceUnitsField } = await import('./ReferenceUnitsField');

const a: ReferenceUnit = { grade: '중2', textbook: '천재(노미숙)', semester: '1학기', unit_path: ['1. 문학'] };
const b: ReferenceUnit = { grade: '중3', textbook: '비상(김진수)', semester: '', unit_path: ['3. 소설', '(1) 단편'] };

describe('ReferenceUnitsField', () => {
  it('붙은 단원을 칩으로 보여 준다', () => {
    render(<ReferenceUnitsField value={[a, b]} onChange={vi.fn()} />);
    expect(screen.getByText('중2 천재(노미숙) 1학기 1. 문학')).toBeTruthy();
    expect(screen.getByText('중3 비상(김진수) 3. 소설 > (1) 단편')).toBeTruthy();
    expect(screen.getByText('(2 / 8)')).toBeTruthy();
  });

  it('칩의 ✕ 로 그 단원만 뺀다', () => {
    const onChange = vi.fn();
    render(<ReferenceUnitsField value={[a, b]} onChange={onChange} />);
    fireEvent.click(screen.getByLabelText('중2 천재(노미숙) 1학기 1. 문학 빼기'));
    expect(onChange).toHaveBeenCalledWith([b]);
  });

  it('단원이 없으면 무엇을 하면 되는지 알려 준다', () => {
    render(<ReferenceUnitsField value={[]} onChange={vi.fn()} />);
    expect(screen.getByText(/아직 붙인 단원이 없어요/)).toBeTruthy();
  });

  it('⚠️ 카테고리는 고르기 단추를 누를 때 읽는다 — 폼을 열 때마다 표 여섯 개를 읽지 않는다', () => {
    render(<ReferenceUnitsField value={[]} onChange={vi.fn()} />);
    expect(getAllSelectableCategories).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('단원 고르기'));
    expect(getAllSelectableCategories).toHaveBeenCalledTimes(1);
  });
});
