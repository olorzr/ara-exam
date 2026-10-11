import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import ProblemFilterBar from './ProblemFilterBar';
import { EMPTY_SOURCE_FACETS } from '@/lib/problem-bank/facets';
import { EMPTY_FILTERS, type ProblemFilters } from '@/lib/problem-bank/filters';
import { grammarSelectOptions } from '@/lib/problem-bank/grammar-browse-tree';

/** 트리거에는 셰브론 아이콘이 섞여 들어와 정확 일치로는 못 본다 */
function renderBar(filters: Partial<ProblemFilters> = {}, onChange: (patch: Partial<ProblemFilters>) => void = () => {}) {
  return render(
    <ProblemFilterBar
      filters={{ ...EMPTY_FILTERS, ...filters }}
      facets={EMPTY_SOURCE_FACETS}
      areaFacets={[]}
      unitFacets={[]}
      grammarOptions={grammarSelectOptions()}
      workFacets={[]}
      total={0}
      onChange={onChange}
      onReset={() => {}}
    />,
  );
}

describe('ProblemFilterBar', () => {
  /**
   * 이 테스트가 고정하는 것: 조건을 안 건 기본 상태에서 칸들이 내부 센티널(`__all__`)을
   * 그대로 보여 주던 증상. base-ui 는 `items` 가 없으면 값을 그대로 그린다.
   */
  it('조건이 없을 때 칸에 센티널이 아니라 사람 말이 보인다', () => {
    const { container } = renderBar();

    expect(container.textContent).not.toContain('__all__');
    expect(container.textContent).not.toContain('__none__');
    expect(screen.getByRole('combobox', { name: '유형' }).textContent).toContain('유형 전체');
    expect(screen.getByRole('combobox', { name: '학교' }).textContent).toContain('학교 전체');
  });

  it('학교급 칸이 사람 말로 보인다', () => {
    renderBar();
    expect(screen.getByRole('combobox', { name: '학교급' }).textContent).toContain('학교급 전체');
  });

  it('학교급 조건이 걸리면 고른 학교급이 보인다', () => {
    renderBar({ school_level: '고등' });
    expect(screen.getByRole('combobox', { name: '학교급' }).textContent).toContain('고등');
  });

  /** 태그가 0건이어도 문법 칸은 나와야 한다 — 안 나오면 붙일 길이 없다 */
  it('문법 칸은 태그가 하나도 없어도 보인다', () => {
    renderBar();

    expect(screen.getByRole('combobox', { name: '문법' }).textContent).toContain('문법 전체');
  });

  it('문법 조건이 걸리면 고른 경로가 그대로 보인다', () => {
    renderBar({ grammar_path: ['단어', '품사'] });

    expect(screen.getByRole('combobox', { name: '문법' }).textContent).toContain('단어 > 품사');
  });

  it('패싯이 비어도 조건이 걸린 칸은 남는다 — 안 그러면 끌 수가 없다', () => {
    renderBar({ textbook: '천재' });

    expect(screen.getByRole('combobox', { name: '교과서' }).textContent).toContain('천재');
  });

  it('패싯도 조건도 없는 칸은 아예 안 그린다', () => {
    renderBar();

    expect(screen.queryByRole('combobox', { name: '교과서' })).toBeNull();
    expect(screen.queryByRole('combobox', { name: '단원' })).toBeNull();
  });

  it("'그 작품만' 칸은 작품·문법 축이 걸렸을 때만 그린다", () => {
    renderBar();
    expect(screen.queryByRole('checkbox')).toBeNull();
  });

  it('작품 축이면 작품 이름, 문법 축이면 문법 이름으로 그린다', () => {
    const { unmount } = renderBar({ work_title: '서시' });
    expect(screen.getByRole('checkbox', { name: '이 작품만 묻는 문항' })).toBeTruthy();
    unmount();
    renderBar({ grammar_path: ['음운'] });
    expect(screen.getByRole('checkbox', { name: '문학·독서 지문 없는 문항' })).toBeTruthy();
  });

  it('누르면 첫 쪽으로 돌아가며 켠다 — 켜진 상태도 그대로 보인다', () => {
    const onChange = vi.fn();
    const { unmount } = renderBar({ work_title: '서시' }, onChange);
    fireEvent.click(screen.getByRole('checkbox', { name: '이 작품만 묻는 문항' }));
    expect(onChange).toHaveBeenCalledWith({ solo: true, page: 0 });
    unmount();
    renderBar({ work_title: '서시', solo: true });
    expect((screen.getByRole('checkbox') as HTMLInputElement).checked).toBe(true);
  });
});
