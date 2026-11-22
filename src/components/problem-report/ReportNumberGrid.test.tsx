import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { PaperItemRef } from '@/lib/problem-report/queries';
import ReportNumberGrid from './ReportNumberGrid';

/** n 개 항목 — 인쇄 번호 = 배열 차례 + 1 */
const itemsOf = (n: number): PaperItemRef[] => Array.from({ length: n }, (_, i) => ({
  id: `i${i + 1}`, problem_id: `p${i + 1}`,
  snapshot: { stem_html: `<p>${i + 1}번 발문</p>` } as PaperItemRef['snapshot'],
}));

describe('ReportNumberGrid — 신고 창 번호판 (2026-11-22)', () => {
  it('번호를 숫자 단추로 늘어놓고 누르면 그 항목을 고른다', () => {
    const onChange = vi.fn();
    render(<ReportNumberGrid items={itemsOf(20)} value="" onChange={onChange} />);
    expect(screen.getAllByRole('radio')).toHaveLength(20);
    fireEvent.click(screen.getByRole('radio', { name: '17번' }));
    expect(onChange).toHaveBeenCalledWith('i17');
  });

  it('고른 칸만 표시되고 Tab 으로 들어가는 칸도 그 칸 하나다(없으면 1번)', () => {
    const { rerender } = render(<ReportNumberGrid items={itemsOf(5)} value="" onChange={() => undefined} />);
    expect(screen.getAllByRole('radio').map((r) => r.getAttribute('tabindex'))).toEqual(['0', '-1', '-1', '-1', '-1']);
    rerender(<ReportNumberGrid items={itemsOf(5)} value="i3" onChange={() => undefined} />);
    expect(screen.getByRole('radio', { name: '3번' }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getAllByRole('radio').map((r) => r.getAttribute('tabindex'))).toEqual(['-1', '-1', '0', '-1', '-1']);
  });

  it('화살표는 옆·위아래(8칸)로, Home·End 는 처음·끝으로 옮겨 고른다 — 판 밖으로는 안 나간다', () => {
    const onChange = vi.fn();
    render(<ReportNumberGrid items={itemsOf(20)} value="i10" onChange={onChange} />);
    const ten = screen.getByRole('radio', { name: '10번' });
    fireEvent.keyDown(ten, { key: 'ArrowRight' });
    fireEvent.keyDown(ten, { key: 'ArrowLeft' });
    fireEvent.keyDown(ten, { key: 'ArrowDown' });
    fireEvent.keyDown(ten, { key: 'ArrowUp' });
    fireEvent.keyDown(ten, { key: 'Home' });
    fireEvent.keyDown(ten, { key: 'End' });
    expect(onChange.mock.calls.map((c) => c[0])).toEqual(['i11', 'i9', 'i18', 'i2', 'i1', 'i20']);
    onChange.mockClear();
    fireEvent.keyDown(screen.getByRole('radio', { name: '20번' }), { key: 'ArrowDown' });
    fireEvent.keyDown(screen.getByRole('radio', { name: '1번' }), { key: 'ArrowLeft' });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('발문 앞부분을 단추 풍선 글로 보여 준다', () => {
    render(<ReportNumberGrid items={itemsOf(3)} value="" onChange={() => undefined} />);
    expect(screen.getByRole('radio', { name: '2번' }).getAttribute('title')).toBe('2번 발문');
  });
});
