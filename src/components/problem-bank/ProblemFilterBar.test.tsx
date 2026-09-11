import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import ProblemFilterBar from './ProblemFilterBar';
import { EMPTY_SOURCE_FACETS } from '@/lib/problem-bank/facets';
import { EMPTY_FILTERS, type ProblemFilters } from '@/lib/problem-bank/filters';
import { grammarSelectOptions } from '@/lib/problem-bank/grammar-browse-tree';

/** 트리거에는 셰브론 아이콘이 섞여 들어와 정확 일치로는 못 본다 */
function renderBar(filters: Partial<ProblemFilters> = {}) {
  return render(
    <ProblemFilterBar
      filters={{ ...EMPTY_FILTERS, ...filters }}
      facets={EMPTY_SOURCE_FACETS}
      areaFacets={[]}
      unitFacets={[]}
      grammarOptions={grammarSelectOptions()}
      workFacets={[]}
      total={0}
      onChange={() => {}}
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
});
