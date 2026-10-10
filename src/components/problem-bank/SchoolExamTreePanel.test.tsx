import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import SchoolExamTreePanel from './SchoolExamTreePanel';
import { EMPTY_FILTERS } from '@/lib/problem-bank/filters';
import type { SchoolExamFacet } from '@/lib/problem-bank/school-exam-tree';

const TUPLES: SchoolExamFacet[] = [
  { source_type: '내신기출', school_name: '성수고등학교', year: '2025', grade: '고1', semester: '1학기', exam_type: '중간' },
  { source_type: '내신기출', school_name: '성수고등학교', year: '2026', grade: '고1', semester: '1학기', exam_type: '중간' },
  { source_type: '내신기출', school_name: '도선고등학교', year: '2025', grade: '고1', semester: '2학기', exam_type: '기말' },
];

function renderPanel(onChange = vi.fn()) {
  render(<SchoolExamTreePanel filters={EMPTY_FILTERS} tuples={TUPLES} onChange={onChange} />);
  return onChange;
}

/** 폴더 줄(role=button) — 라벨 글자로 찾는다 */
function row(label: string) {
  return screen.getByText(label).closest('[role="button"]') as HTMLElement;
}

describe('SchoolExamTreePanel', () => {
  it('처음에는 학교까지만 보이고 학년도부터는 접혀 있다', () => {
    renderPanel();
    expect(row('고등').getAttribute('aria-expanded')).toBe('true');
    expect(row('성수고등학교').getAttribute('aria-expanded')).toBe('false');
    expect(row('도선고등학교').getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByText('2026학년도')).toBeNull();
    expect(screen.queryByText('2025학년도')).toBeNull();
  });

  it('학교를 누르면 학년도가 펼쳐진다 — 단계는 그대로 있다', () => {
    renderPanel();
    fireEvent.click(row('성수고등학교'));
    expect(row('성수고등학교').getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByText('2026학년도')).toBeTruthy();
    expect(screen.getByText('2025학년도')).toBeTruthy();
    // 다른 학교는 그대로 접혀 있다
    expect(row('도선고등학교').getAttribute('aria-expanded')).toBe('false');
  });

  it('펼쳐서 잎을 고르면 그 시험 조건이 걸린다', () => {
    const onChange = renderPanel();
    fireEvent.click(row('도선고등학교'));
    fireEvent.click(row('2025학년도'));
    fireEvent.click(row('고1'));
    fireEvent.click(row('2학기 기말'));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      school_name: '도선고등학교', year: '2025', grade: '고1', semester: '2학기', exam_type: '기말',
    }));
  });
});
