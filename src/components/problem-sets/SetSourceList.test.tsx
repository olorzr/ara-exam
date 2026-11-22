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

/** 보기 링크 이름 고르기 — 고치기 링크('… 원본 대조로 고치기')는 뺀다 */
const viewName = (head: string) => (name: string) => name.startsWith(head) && !name.endsWith('고치기');

describe('SetSourceList', () => {
  it('학교 이름을 누르면 읽기 전용 시험 보기, 고치기는 원본 대조 고치기로 간다 — 링크 안에 링크가 없다', () => {
    render(<SetSourceList rows={[row({}), row({ id: 's2', school_name: '광희중학교', problem_count: 0 })]} />);
    expect(screen.getByRole('link', { name: viewName('무학중학교2026 무학중 중2') }).getAttribute('href')).toBe('/problems/sets/exam/s1');
    expect(screen.getByRole('link', { name: viewName('광희중학교') }).getAttribute('href')).toBe('/problems/sets/exam/s2');
    expect(screen.getByRole('link', { name: '무학중학교 · 2026 무학중 중2 1학기 중간 원본 대조로 고치기' }).getAttribute('href')).toBe('/problems/sources/s1');
    expect(screen.getByRole('link', { name: /^광희중학교 · .* 원본 대조로 고치기$/ }).getAttribute('href')).toBe('/problems/sources/s2');
    for (const link of screen.getAllByRole('link')) expect(link.querySelector('a')).toBeNull();
    expect(screen.getByText('32문항')).toBeTruthy();
    expect(screen.getByText('문항 없음')).toBeTruthy();
  });

  it('적재 확인거리가 있으면 확인 필요 꼬리표를 단다(목록 표와 같은 값) — 줄을 덮는 링크 위라 풍선 글이 뜬다', () => {
    render(<SetSourceList rows={[row({ ocr_meta: { warnings: [{}, {}] } as SourceListRow['ocr_meta'] })]} />);
    const wrap = screen.getByText('확인 필요 2').closest('[title]');
    expect(wrap?.getAttribute('title')).toContain('고치기 화면 위쪽');
    expect(wrap?.className).toContain('z-10');
  });

  it('학교 이름이 같아도 시험 제목으로 링크 이름이 갈린다', () => {
    render(<SetSourceList rows={[row({ school_name: '', title: '시험 A' }), row({ id: 's2', school_name: '', title: '시험 B' })]} />);
    const names = screen.getAllByRole('link').map((a) => a.getAttribute('aria-label') ?? a.textContent);
    expect(new Set(names).size).toBe(names.length);
  });

  it('모의고사는 과목 이름을 줄 머리로 쓴다', () => {
    render(<SetSourceList rows={[row({ source_type: '모의고사', school_name: '', title: '2027학년도 6월 모평 (화법과 작문)' })]} />);
    expect(screen.getByRole('link', { name: viewName('화법과 작문') })).toBeTruthy();
  });
});
