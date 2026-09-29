import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import SourceFilterBar from './SourceFilterBar';
import { EMPTY_SOURCE_FACETS } from '@/lib/problem-bank/facets';
import { EMPTY_SOURCE_LIST_FILTERS } from '@/lib/problem-bank/source-list-filters';

/**
 * base-ui Select 팝업은 포털 + 포인터 이벤트라 fireEvent 로 못 연다(WorkTreePanel.test 와 같은 사정).
 * 드롭다운 칸의 규칙은 source-list-filters.test.ts 가 고정하고, 여기서는 그리기·검색·지우기만 본다.
 */
describe('SourceFilterBar', () => {
  it('출처 칸을 드롭다운으로 그리고 건수를 보인다', () => {
    render(
      <SourceFilterBar
        filters={EMPTY_SOURCE_LIST_FILTERS}
        facets={{ ...EMPTY_SOURCE_FACETS, schools: ['상현중'], years: ['2026'] }}
        total={12}
        onChange={() => undefined}
        onReset={() => undefined}
      />,
    );
    for (const name of ['유형', '학교급', '학교', '학년도', '학년', '시험', '늘어놓는 차례']) {
      expect(screen.getByRole('combobox', { name })).toBeTruthy();
    }
    expect(screen.getByText('시험지 12건')).toBeTruthy();
  });

  it('제목을 치면 그대로 알리고, 조건이 없으면 지우기 단추가 없다', () => {
    const onChange = vi.fn();
    render(
      <SourceFilterBar
        filters={EMPTY_SOURCE_LIST_FILTERS}
        facets={EMPTY_SOURCE_FACETS}
        total={0}
        onChange={onChange}
        onReset={() => undefined}
      />,
    );
    fireEvent.change(screen.getByRole('textbox', { name: '시험지 제목 검색' }), { target: { value: '봄봄' } });
    expect(onChange).toHaveBeenCalledWith({ title: '봄봄' });
    expect(screen.queryByRole('button', { name: /조건 지우기/ })).toBeNull();
  });

  it('조건이 걸리면 지우기 단추가 나온다', () => {
    const onReset = vi.fn();
    render(
      <SourceFilterBar
        filters={{ ...EMPTY_SOURCE_LIST_FILTERS, year: '2026' }}
        facets={EMPTY_SOURCE_FACETS}
        total={3}
        onChange={() => undefined}
        onReset={onReset}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /조건 지우기/ }));
    expect(onReset).toHaveBeenCalled();
  });
});
