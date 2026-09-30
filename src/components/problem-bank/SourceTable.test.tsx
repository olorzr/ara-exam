import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import SourceTable from './SourceTable';
import type { SourceListRow } from '@/lib/problem-bank/source-list';

const row = (over: Partial<SourceListRow> = {}): SourceListRow => ({
  id: 's1', source_type: '내신기출', title: '2026 상현중 중2 1학기 중간', school_name: '상현중',
  school_id: null, year: '2026', grade: '중2', semester: '1학기', exam_type: '중간', publisher: '',
  textbook: '', file_path: '', answer_key_paths: [], page_count: 4, status: '검수중', ocr_meta: {},
  notes: '', user_id: 'u', updated_by: null, created_at: '2026-09-30T00:00:00Z',
  updated_at: '2026-09-30T00:00:00Z', problem_count: 23, ...over,
});

const draw = (
  rows: SourceListRow[],
  opts: { refreshing?: boolean; deleting?: boolean; canDelete?: boolean } = {},
) => render(
  <SourceTable
    rows={rows} refreshing={opts.refreshing ?? false} deleting={opts.deleting ?? false}
    onDelete={(opts.canDelete ?? true) ? vi.fn() : undefined}
  />,
);

describe('SourceTable', () => {
  it('제목은 시험지 화면으로 가는 링크이고, 칸마다 값을 따로 보인다', () => {
    draw([row()]);
    const link = screen.getByRole('link', { name: '2026 상현중 중2 1학기 중간' }) as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe('/problems/sources/s1');
    expect(screen.getByText('상현중')).toBeTruthy();
    expect(screen.getByText('1학기 중간')).toBeTruthy();
    expect(screen.getByText('23')).toBeTruthy();
  });

  it("문항이 없으면 0 이 아니라 '문항 없음' 으로 짚는다", () => {
    draw([row({ problem_count: 0 })]);
    expect(screen.getByText('문항 없음')).toBeTruthy();
  });

  it('학교가 없는 유형은 주관·출판사를 학교 칸에 보인다', () => {
    draw([row({ source_type: '모의고사', school_name: '', publisher: '평가원', semester: '', exam_type: '수능' })]);
    expect(screen.getByText('평가원')).toBeTruthy();
    expect(screen.getByText('수능')).toBeTruthy();
  });

  it('조건을 바꿔 다시 읽는 동안에는 흐린 줄을 지울 수 없다', () => {
    draw([row()], { refreshing: true });
    const button = screen.getByRole('button', { name: /지우기/ }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });

  it('평소에는 지울 수 있다', () => {
    draw([row()]);
    expect((screen.getByRole('button', { name: /지우기/ }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('지우기를 안 넘기면(원장이 아니면) 지우기 칸을 헤더째 그리지 않는다', () => {
    draw([row()], { canDelete: false });
    expect(screen.queryByRole('button', { name: /지우기/ })).toBeNull();
    expect(screen.queryByText('지우기')).toBeNull();
    expect(screen.getAllByRole('columnheader')).toHaveLength(8);
  });
});
