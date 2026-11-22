import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ProblemReport } from '@/lib/problem-report/types';
import ProblemReportRow from './ProblemReportRow';

const report = {
  id: 'r1', problem_id: 'p1', paper_id: 'pa1', paper_item_id: 'i1',
  snapshot: { stem_html: '<p>윗글의 [A]에 대한 설명으로</p>', number: 12 },
  paper_title: '춘향전', printed_no: 20, source_label: '2025 고1 휘경여자고등학교 2학기 기말',
  category: 'answer', note: '정답이 ④예요', status: 'open', resolution_note: '', resolved_at: null, resolved_by: null,
  notified_at: null, user_id: 'u1', created_at: '2026-11-22T03:00:00Z', updated_at: '2026-11-22T03:00:00Z',
} as unknown as ProblemReport;

const draw = (props: Partial<Parameters<typeof ProblemReportRow>[0]> = {}) =>
  render(<ul><ProblemReportRow report={report} n={1} {...props} /></ul>);

describe('ProblemReportRow', () => {
  it('종류 · 자리 · 출처 · 발문 · 내용 · 신고한 선생님이 보이고, 알림이 못 갔으면 그 표시가 붙는다', () => {
    draw({ reporter: '최지은', sourceId: 's1' });
    expect(screen.getByText('정답 오류')).toBeTruthy();
    expect(screen.getByText(/춘향전 20번/)).toBeTruthy();
    // 문제지에서 신고한 건은 출처 줄에 원본 시험지의 번호를 붙인다
    expect(screen.getByText('2025 고1 휘경여자고등학교 2학기 기말 · 원래 12번')).toBeTruthy();
    expect(screen.getByText('정답이 ④예요')).toBeTruthy();
    expect(screen.getByText(/최지은 선생님/)).toBeTruthy();
    expect(screen.getByText('알림 안 감')).toBeTruthy();
    expect(screen.getByRole('link', { name: '문항 편집' }).getAttribute('href')).toBe('/problems/edit/p1');
    expect(screen.getByRole('link', { name: '시험지에서 보기' }).getAttribute('href')).toBe('/problems/sources/s1?item=p1');
  });

  it('처리 단추는 원장(onResolve)에게만 그린다', () => {
    const onResolve = vi.fn();
    const { rerender } = draw();
    expect(screen.queryByRole('button', { name: '고침' })).toBeNull();
    rerender(<ul><ProblemReportRow report={report} n={1} onResolve={onResolve} /></ul>);
    fireEvent.click(screen.getByRole('button', { name: '고침' }));
    fireEvent.click(screen.getByRole('button', { name: '반려' }));
    expect(onResolve.mock.calls).toEqual([['fixed'], ['rejected']]);
  });

  it('처리된 신고는 상태와 처리 메모, 다시 열기 단추를 보인다', () => {
    const onResolve = vi.fn();
    render(<ul><ProblemReportRow
      report={{ ...report, status: 'fixed', resolution_note: '정답 고쳤어요', resolved_at: '2026-11-22T04:00:00Z', notified_at: '2026-11-22T03:00:01Z' }}
      n={1} onResolve={onResolve}
    /></ul>);
    expect(screen.getByText('고침')).toBeTruthy();
    expect(screen.getByText(/정답 고쳤어요/)).toBeTruthy();
    expect(screen.queryByText('알림 안 감')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '다시 열기' }));
    expect(onResolve).toHaveBeenCalledWith('open');
  });

  it('문제 은행에서 신고한 건은 자리에 원래 번호가 있어 출처 줄에 또 붙이지 않는다', () => {
    render(<ul><ProblemReportRow report={{ ...report, paper_title: null, printed_no: null }} n={1} /></ul>);
    expect(screen.getByText('문제 은행 · 원래 12번')).toBeTruthy();
    expect(screen.getByText('2025 고1 휘경여자고등학교 2학기 기말')).toBeTruthy();
  });

  it('문항이 지워졌으면 링크 대신 그 사실을 적는다', () => {
    draw({});
    render(<ul><ProblemReportRow report={{ ...report, id: 'r2', problem_id: null }} n={2} /></ul>);
    expect(screen.getByText(/문항이 지워졌거나 다시 올라왔어요/)).toBeTruthy();
  });
});
