import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  submit: vi.fn<(...args: unknown[]) => Promise<string>>(async () => 'r1'),
  notify: vi.fn<(...args: unknown[]) => Promise<'reached' | 'failed'>>(async () => 'reached'),
  count: vi.fn<(...args: unknown[]) => Promise<number>>(async () => 0),
  state: vi.fn<(...args: unknown[]) => Promise<unknown>>(async () => ({
    tags: { work_titles: ['동백꽃'], unit_path: ['1. 문학'], area_path: [], grammar_paths: ['단어 > 품사'] },
    source: { source_type: '내신기출', title: '', school_name: '상현중', year: '2026', grade: '중2', semester: '1학기', exam_type: '중간', publisher: '' },
    number: 7,
    token: 'tok-1',
  })),
  toast: { success: vi.fn(), warning: vi.fn(), error: vi.fn() },
}));
vi.mock('sonner', () => ({ toast: m.toast }));
vi.mock('@/lib/problem-report/notify-client', () => ({ notifyProblemReport: m.notify }));
vi.mock('@/lib/problem-report/queries', () => ({
  submitProblemReport: m.submit,
  countOpenReports: m.count,
  fetchReportState: m.state,
  fetchPaperItemRefs: async (paperId: string, revision: string) => ({
    stale: revision !== 'rev-now',
    items: paperId === 'paperRlo' ? [
      { id: 'r1', problem_id: 'p1', snapshot: { stem_html: '<p>가</p>', number: 3, source: { source_type: '모의고사', title: '가', school_name: '', year: '', grade: '', exam_type: '', publisher: '' } } },
      { id: 'r2', problem_id: 'p2', snapshot: { stem_html: '<p>나</p>', number: 8, source: { source_type: '모의고사', title: `시험${String.fromCodePoint(0x202e)}`, school_name: '', year: '', grade: '', exam_type: '', publisher: '' } } },
    ] : [
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
  m.state.mockClear();
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
    // 발문 앞부분은 <bdi> 안에(방향 제어를 가둔다) — 줄 전체 글은 '2번 · 둘째 문항'
    expect(screen.getByText('둘째 문항').tagName).toBe('BDI');
    expect(screen.getByText('둘째 문항').parentElement?.textContent).toBe('2번 · 둘째 문항');
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

  it('태그 오류는 지금 붙은 태그를 보여 주고, 그 상태의 지문을 실어 내용 없이도 신고한다', async () => {
    const onClose = vi.fn();
    render(<ProblemReportDialog open onClose={onClose} target={{ kind: 'problem', problemId: 'p9', label: '문항' }} />);
    const select = screen.getByRole('combobox', { name: '오류 종류' });
    expect(screen.getByRole('option', { name: '태그 오류 (작품·단원·영역)' })).toBeTruthy();
    expect(screen.getByRole('option', { name: '출처·번호 오류' })).toBeTruthy();
    expect(m.state).not.toHaveBeenCalled();
    fireEvent.change(select, { target: { value: 'tag' } });
    expect(screen.getByRole('textbox').getAttribute('placeholder')).toContain('문법 태그');
    // 읽는 동안은 신고를 못 누른다(보여 준 값과 지문이 짝이어야 한다)
    expect(screen.getByRole('button', { name: '신고하기' })).toHaveProperty('disabled', true);
    expect(await screen.findByText('지금 붙은 태그')).toBeTruthy();
    expect(screen.getByText('동백꽃')).toBeTruthy();
    expect(screen.getByText('단어 > 품사')).toBeTruthy();
    expect(m.state).toHaveBeenCalledWith({ problemId: 'p9' });
    fireEvent.click(screen.getByRole('button', { name: '신고하기' }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(m.submit).toHaveBeenCalledWith({ category: 'tag', note: '', problemId: 'p9', stateToken: 'tok-1' });
  });

  it('출처 신고는 지금 출처를 보여 주고, 정답 신고는 지문을 싣지 않는다', async () => {
    render(<ProblemReportDialog open onClose={() => undefined} target={{ kind: 'problem', problemId: 'p9', label: '문항' }} />);
    const select = screen.getByRole('combobox', { name: '오류 종류' });
    fireEvent.change(select, { target: { value: 'source' } });
    // 머리 줄과 '신고될 출처' 둘 다 확인한 상태로 그린다
    expect(await screen.findAllByText('2026 중2 상현중 1학기 중간 7번')).toHaveLength(2);
    // 출처 신고도 태그를 함께 보여 준다(둘 다 신고에 남고 둘 다 대조된다)
    expect(screen.getByText('지금 붙은 태그')).toBeTruthy();
    fireEvent.change(select, { target: { value: 'answer' } });
    expect(screen.queryByText('신고될 출처')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '신고하기' }));
    await waitFor(() => expect(m.submit).toHaveBeenCalled());
    expect(m.submit).toHaveBeenCalledWith({ category: 'answer', note: '', problemId: 'p9' });
  });

  it('그사이 바뀌어 거절되면 지금 상태를 다시 읽고 쓰던 글은 남긴다', async () => {
    m.submit.mockRejectedValueOnce(new Error('이 문항의 태그나 출처가 방금 다른 곳에서 바뀌었어요.'));
    render(<ProblemReportDialog open onClose={() => undefined} target={{ kind: 'problem', problemId: 'p9', label: '문항' }} />);
    fireEvent.change(screen.getByRole('combobox', { name: '오류 종류' }), { target: { value: 'tag' } });
    await screen.findByText('지금 붙은 태그');
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '단원이 틀려요' } });
    fireEvent.click(screen.getByRole('button', { name: '신고하기' }));
    await waitFor(() => expect(m.toast.error).toHaveBeenCalled());
    await waitFor(() => expect(m.state).toHaveBeenCalledTimes(2));
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('단원이 틀려요');
  });

  it('머리 줄도 확인한 상태를 따른다 — 다시 읽어 번호가 바뀌면 머리도 바뀐다', async () => {
    render(<ProblemReportDialog open onClose={() => undefined} target={{ kind: 'problem', problemId: 'p9', label: '2026 중2 상현중 1학기 중간 6번' }} />);
    expect(screen.getByText('2026 중2 상현중 1학기 중간 6번')).toBeTruthy();
    fireEvent.change(screen.getByRole('combobox', { name: '오류 종류' }), { target: { value: 'source' } });
    // 머리와 '신고될 출처' 둘 다 확인한 상태(7번)
    await waitFor(() => expect(screen.getAllByText('2026 중2 상현중 1학기 중간 7번')).toHaveLength(2));
    expect(screen.queryByText('2026 중2 상현중 1학기 중간 6번')).toBeNull();
  });

  it('출처 제목의 방향 제어 글자는 드러내 그려 뒤의 번호가 뒤집히지 않는다', async () => {
    const rlo = String.fromCodePoint(0x202e);
    m.state.mockResolvedValueOnce({
      tags: null, number: 17, token: 't',
      source: { source_type: '모의고사', title: `시험${rlo}`, year: '', grade: '', school_name: '', publisher: '', semester: '', exam_type: '' },
    });
    const { container } = render(<ProblemReportDialog open onClose={() => undefined} target={{ kind: 'problem', problemId: 'p9', label: '문항' }} />);
    fireEvent.change(screen.getByRole('combobox', { name: '오류 종류' }), { target: { value: 'source' } });
    await screen.findAllByText('⟨U+202E⟩');
    // 실제 방향 제어 글자는 화면 글에 남지 않는다
    expect(container.ownerDocument.body.textContent?.includes(rlo)).toBe(false);
    expect(container.ownerDocument.body.textContent).toContain('17번');
  });

  it('문제지에서 고른 항목의 원본 출처 줄도 방향 제어 글자를 드러내 그린다', async () => {
    const rlo = String.fromCodePoint(0x202e);
    const { container } = render(<ProblemReportDialog open onClose={() => undefined} target={{ kind: 'paper', paperId: 'paperRlo', revision: 'rev-now' }} />);
    await screen.findByRole('radiogroup', { name: '신고할 문항 번호' });
    fireEvent.click(screen.getByRole('radio', { name: '2번' }));
    expect(await screen.findByText('⟨U+202E⟩')).toBeTruthy();
    expect(container.ownerDocument.body.textContent?.includes(rlo)).toBe(false);
  });

  it('지금 상태를 못 읽어도 신고는 막지 않는다(지문 없이 보낸다)', async () => {
    m.state.mockRejectedValueOnce(new Error('x'));
    render(<ProblemReportDialog open onClose={() => undefined} target={{ kind: 'problem', problemId: 'p9', label: '문항' }} />);
    fireEvent.change(screen.getByRole('combobox', { name: '오류 종류' }), { target: { value: 'tag' } });
    expect(await screen.findByText(/신고에 남을 태그·출처를 불러오지 못했어요/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '신고하기' }));
    await waitFor(() => expect(m.submit).toHaveBeenCalledWith({ category: 'tag', note: '', problemId: 'p9' }));
  });

  it('문제지 신고는 고른 항목 기준으로 굳힐 상태를 읽는다(원본이 지워진 항목도)', async () => {
    render(<ProblemReportDialog open onClose={() => undefined} target={{ kind: 'paper', paperId: 'paper1', revision: 'rev-now' }} />);
    await screen.findByRole('radiogroup', { name: '신고할 문항 번호' });
    fireEvent.change(screen.getByRole('combobox', { name: '오류 종류' }), { target: { value: 'source' } });
    expect(m.state).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('radio', { name: '3번' }));
    await waitFor(() => expect(m.state).toHaveBeenCalledWith({ paperItemId: 'i3' }));
    m.state.mockResolvedValueOnce({ tags: null, source: null, number: 5, token: 'tok-i' });
    fireEvent.change(screen.getByRole('combobox', { name: '오류 종류' }), { target: { value: 'answer' } });
    fireEvent.change(screen.getByRole('combobox', { name: '오류 종류' }), { target: { value: 'tag' } });
    expect(await screen.findByText(/원본 문항이 지워져 지금 붙은 태그가 없어요/)).toBeTruthy();
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

  it('오류 종류는 브라우저 기본 고르기이고 터치 화면 글자는 16px — 아이폰이 초점에 확대하지 않게(코덱스 19·22·23R)', () => {
    render(<ProblemReportDialog open onClose={() => undefined} target={{ kind: 'problem', problemId: 'p9', label: '문항' }} />);
    const select = screen.getByRole('combobox', { name: '오류 종류' });
    expect(select.tagName).toBe('SELECT');
    // 터치 화면에서는 폭과 상관없이 16px(가로로 돌린 아이폰도, 23R)
    expect(select.className).toContain('[@media(hover:none)]:text-base');
    expect(select.className).not.toContain('md:text-sm');
  });
});
