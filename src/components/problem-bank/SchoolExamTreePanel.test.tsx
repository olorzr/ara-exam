import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import SchoolExamTreePanel from './SchoolExamTreePanel';
import { EMPTY_FILTERS } from '@/lib/problem-bank/filters';
import type { SchoolExamFacet } from '@/lib/problem-bank/school-exam-tree';
import type { WorkbookFacet } from '@/lib/problem-bank/workbook-tree';

const TUPLES: SchoolExamFacet[] = [
  { source_type: '내신기출', school_name: '성수고등학교', year: '2025', grade: '고1', semester: '1학기', exam_type: '중간' },
  { source_type: '내신기출', school_name: '성수고등학교', year: '2026', grade: '고1', semester: '1학기', exam_type: '중간' },
  { source_type: '내신기출', school_name: '도선고등학교', year: '2025', grade: '고1', semester: '2학기', exam_type: '기말' },
];

const BOOKS: WorkbookFacet[] = [
  { source_type: '평가문제집', school_name: '', year: '2026', grade: '중2', semester: '1학기', exam_type: '',
    textbook: '동아', title: '동아 중2-1 평가문제집 2-(1) 시와 화자' },
  { source_type: '평가문제집', school_name: '', year: '2026', grade: '중2', semester: '1학기', exam_type: '',
    textbook: '동아', title: '동아 중2-1 평가문제집 1-(1) 효과적으로 듣고 말하기' },
];

function renderPanel(onChange = vi.fn(), filters = EMPTY_FILTERS) {
  render(<SchoolExamTreePanel filters={filters} tuples={TUPLES} workbooks={BOOKS} onChange={onChange} />);
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

  it('평가문제집 가지 — 교과서 › 학년·학기 › 책(단원 차례), 잎은 출처 제목까지 건다', () => {
    const onChange = renderPanel();
    fireEvent.click(row('동아'));
    fireEvent.click(row('중2 1학기'));
    const leaves = screen.getAllByText(/^\d-\(\d\)/).map((n) => n.textContent);
    expect(leaves).toEqual(['1-(1) 효과적으로 듣고 말하기', '2-(1) 시와 화자']);
    fireEvent.click(screen.getByText('2-(1) 시와 화자'));
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({
      source_type: '평가문제집', textbook: '동아', grade: '중2', semester: '1학기',
      source_title: '동아 중2-1 평가문제집 2-(1) 시와 화자', school_name: '', exam_type: '',
    }));
  });

  it('평가문제집이 걸려 있으면 해제가 교과서·책 제목까지 푼다', () => {
    const onChange = renderPanel(vi.fn(), { ...EMPTY_FILTERS, source_type: '평가문제집', textbook: '동아', source_title: 'x' });
    fireEvent.click(screen.getByText('해제'));
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ source_type: '', textbook: '', source_title: '' }));
  });
});
