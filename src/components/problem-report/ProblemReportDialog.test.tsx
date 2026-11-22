import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  submit: vi.fn<(...args: unknown[]) => Promise<string>>(async () => 'r1'),
  notify: vi.fn<(...args: unknown[]) => Promise<'reached' | 'failed'>>(async () => 'reached'),
  count: vi.fn<(...args: unknown[]) => Promise<number>>(async () => 0),
  toast: { success: vi.fn(), warning: vi.fn(), error: vi.fn() },
}));
vi.mock('sonner', () => ({ toast: m.toast }));
vi.mock('@/lib/problem-report/notify-client', () => ({ notifyProblemReport: m.notify }));
vi.mock('@/lib/problem-report/queries', () => ({
  submitProblemReport: m.submit,
  countOpenReports: m.count,
  fetchPaperItemRefs: async (_paperId: string, revision: string) => ({
    stale: revision !== 'rev-now',
    items: [
      { id: 'i1', problem_id: 'p1', snapshot: { stem_html: '<p>첫 문항</p>', number: 3, source: { school_name: '압구정중학교', year: '2025', grade: '중1', exam_type: '기말' } } },
      { id: 'i2', problem_id: 'p2', snapshot: { stem_html: '<p>둘째 문항</p>', number: 4, source: { school_name: '압구정중학교', year: '2025', grade: '중1', exam_type: '기말' } } },
      { id: 'i3', problem_id: null, snapshot: { stem_html: '<p>지워진 문항</p>', number: 5, source: { school_name: '압구정중학교', year: '2025', grade: '중1', exam_type: '기말' } } },
    ],
  }),
}));
// 원본 쪽은 따로 테스트한다(ReportOriginalPage.test) — 여기서는 어느 문항의 원본을 여는지만 본다
vi.mock('./ReportOriginalPage', () => ({
  default: ({ problemId }: { problemId: string | null }) => <p data-testid="origin">원본:{problemId ?? '없음'}</p>,
}));

const { default: ProblemReportDialog } = await import('./ProblemReportDialog');

beforeEach(() => {
  m.submit.mockClear();
  m.notify.mockClear();
  m.notify.mockResolvedValue('reached');
  m.count.mockResolvedValue(0);
  Object.values(m.toast).forEach((f) => f.mockClear());
});

describe('ProblemReportDialog', () => {
  it('문제지에서는 번호판에서 골라 신고하고, 저장 뒤 원장 알림을 부른다', async () => {
    const onClose = vi.fn();
    render(<ProblemReportDialog open onClose={onClose} target={{ kind: 'paper', paperId: 'paper1', revision: 'rev-now' }} />);
    await screen.findByRole('radiogroup', { name: '신고할 문항 번호' });
    expect(screen.getByRole('button', { name: '신고하기' })).toHaveProperty('disabled', true);
    expect(screen.getByText('번호를 고르면 원본 시험지 쪽이 여기 보여요.')).toBeTruthy();
    fireEvent.click(screen.getByRole('radio', { name: '2번' }));
    expect(screen.getByRole('radio', { name: '2번' }).getAttribute('aria-checked')).toBe('true');
    // 고른 문항을 글로 확인하고, 그 문항의 원본을 연다
    expect(screen.getByText('2번 · 둘째 문항')).toBeTruthy();
    expect(screen.getByText('원본: 2025 중1 압구정중학교 기말 4번')).toBeTruthy();
    expect(screen.getByTestId('origin').textContent).toBe('원본:p2');
    fireEvent.change(screen.getByRole('combobox', { name: '오류 종류' }), { target: { value: 'answer' } });
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '  정답이 ④예요 ' } });
    fireEvent.click(screen.getByRole('button', { name: '신고하기' }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(m.submit).toHaveBeenCalledWith({ category: 'answer', note: '정답이 ④예요', paperItemId: 'i2', paperRevision: 'rev-now' });
    expect(m.notify).toHaveBeenCalledWith('r1');
    expect(m.toast.success).toHaveBeenCalled();
  });

  it("'기타' 는 내용을 적어야 신고할 수 있다", async () => {
    render(<ProblemReportDialog open onClose={() => undefined} target={{ kind: 'problem', problemId: 'p9', label: '2025 압구정중 3번' }} />);
    fireEvent.change(screen.getByRole('combobox', { name: '오류 종류' }), { target: { value: 'other' } });
    expect(screen.getByRole('button', { name: '신고하기' })).toHaveProperty('disabled', true);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '그림이 없어요' } });
    expect(screen.getByRole('button', { name: '신고하기' })).toHaveProperty('disabled', false);
  });

  it('알림이 못 가도 신고는 저장됐다고 알린다', async () => {
    m.notify.mockResolvedValue('failed');
    const onClose = vi.fn();
    render(<ProblemReportDialog open onClose={onClose} target={{ kind: 'problem', problemId: 'p9', label: '문항' }} />);
    fireEvent.change(screen.getByRole('combobox', { name: '오류 종류' }), { target: { value: 'text' } });
    fireEvent.click(screen.getByRole('button', { name: '신고하기' }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(m.submit).toHaveBeenCalledWith({ category: 'text', note: '', problemId: 'p9' });
    expect(m.toast.warning).toHaveBeenCalled();
  });

  it('같은 문항에 접수 중인 신고가 있으면 알려 준다', async () => {
    m.count.mockResolvedValue(2);
    render(<ProblemReportDialog open onClose={() => undefined} target={{ kind: 'problem', problemId: 'p9', label: '문항' }} />);
    expect(await screen.findByText(/이미 2건 신고돼 있어요/)).toBeTruthy();
  });

  it('저장이 실패하면 창을 닫지 않고 알린다', async () => {
    m.submit.mockRejectedValueOnce(new Error('기타 신고는 내용을 적어 주세요'));
    const onClose = vi.fn();
    render(<ProblemReportDialog open onClose={onClose} target={{ kind: 'problem', problemId: 'p9', label: '문항' }} />);
    fireEvent.change(screen.getByRole('combobox', { name: '오류 종류' }), { target: { value: 'answer' } });
    fireEvent.click(screen.getByRole('button', { name: '신고하기' }));
    await waitFor(() => expect(m.toast.error).toHaveBeenCalledWith('기타 신고는 내용을 적어 주세요'));
    expect(onClose).not.toHaveBeenCalled();
    expect(m.notify).not.toHaveBeenCalled();
  });

  it('창과 뒤판은 인쇄물에 찍히지 않는다(body 로 포털돼 툴바의 data-no-print 밖이다)', async () => {
    render(<ProblemReportDialog open onClose={() => undefined} target={{ kind: 'paper', paperId: 'paper1', revision: 'rev-now' }} />);
    const dialog = await screen.findByRole('dialog');
    expect(dialog.closest('[data-no-print]')).not.toBeNull();
  });

  it('화면이 본 판과 지금 판이 다르면 번호를 고르지 못하게 하고 새로 고치라고 알린다', async () => {
    render(<ProblemReportDialog open onClose={() => undefined} target={{ kind: 'paper', paperId: 'paper1', revision: 'rev-old' }} />);
    expect(await screen.findByText(/다른 곳에서 바뀌었어요/)).toBeTruthy();
    expect(screen.queryByRole('radiogroup', { name: '신고할 문항 번호' })).toBeNull();
    fireEvent.change(screen.getByRole('combobox', { name: '오류 종류' }), { target: { value: 'answer' } });
    expect(screen.getByRole('button', { name: '신고하기' })).toHaveProperty('disabled', true);
  });

  it('문제 은행 문항이면 처음부터 그 문항의 원본을 연다', async () => {
    render(<ProblemReportDialog open onClose={() => undefined} target={{ kind: 'problem', problemId: 'p9', label: '2025 압구정중 3번' }} />);
    expect(screen.getByTestId('origin').textContent).toBe('원본:p9');
  });

  it('원본 문항이 지워진 문제지 항목은 원본 칸이 그 사실을 알린다(번호는 고를 수 있다)', async () => {
    render(<ProblemReportDialog open onClose={() => undefined} target={{ kind: 'paper', paperId: 'paper1', revision: 'rev-now' }} />);
    await screen.findByRole('radiogroup', { name: '신고할 문항 번호' });
    fireEvent.click(screen.getByRole('radio', { name: '3번' }));
    expect(screen.getByTestId('origin').textContent).toBe('원본:없음');
  });

  it('오류 종류는 브라우저 기본 고르기이고 휴대폰 글자는 16px — 아이폰이 초점에 확대하지 않게(코덱스 19·22R)', () => {
    render(<ProblemReportDialog open onClose={() => undefined} target={{ kind: 'problem', problemId: 'p9', label: '문항' }} />);
    const select = screen.getByRole('combobox', { name: '오류 종류' });
    expect(select.tagName).toBe('SELECT');
    expect(select.className).toContain('text-base');
    expect(select.className).toContain('md:text-sm');
  });
});
