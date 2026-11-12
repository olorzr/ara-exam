import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { SourceListRow } from '@/lib/problem-bank/source-list';
import SetSourceList from './SetSourceList';

function row(over: Partial<SourceListRow>): SourceListRow {
  return {
    id: 's1', source_type: '내신기출', title: '2026 무학중 중2 1학기 중간', school_name: '무학중학교',
    year: '2026', grade: '중2', semester: '1학기', exam_type: '중간', publisher: '', textbook: '',
    file_path: '', answer_key_paths: [], page_count: 8, problem_count: 32,
    ...over,
  } as SourceListRow;
}

describe('SetSourceList', () => {
  it('학교 줄을 누르면 읽기 전용 시험 보기로 간다', () => {
    render(<SetSourceList rows={[row({}), row({ id: 's2', school_name: '광희중학교', problem_count: 0 })]} />);
    const links = screen.getAllByRole('link');
    expect(links.map((a) => a.getAttribute('href'))).toEqual(['/problems/sets/exam/s1', '/problems/sets/exam/s2']);
    expect(links[0].textContent).toContain('무학중학교');
    expect(links[0].textContent).toContain('32문항');
    expect(links[1].textContent).toContain('문항 없음');
  });

  it('모의고사는 과목 이름을 줄 머리로 쓴다', () => {
    render(<SetSourceList rows={[row({ source_type: '모의고사', school_name: '', title: '2027학년도 6월 모평 (화법과 작문)' })]} />);
    expect(screen.getByText('화법과 작문')).toBeTruthy();
  });
});
