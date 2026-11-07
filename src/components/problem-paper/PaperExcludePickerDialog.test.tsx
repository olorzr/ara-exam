import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const fetchPapersForPicker = vi.fn();
const toastError = vi.fn();

vi.mock('@/lib/book/queries', () => ({
  fetchPapersForPicker: (...args: unknown[]) => fetchPapersForPicker(...args),
  PAPER_PICKER_LIMIT: 2,
}));
vi.mock('@/hooks/useDebouncedValue', () => ({ useDebouncedValue: (value: string) => value }));
vi.mock('sonner', () => ({ toast: { error: (...args: unknown[]) => toastError(...args) } }));

const { default: PaperExcludePickerDialog } = await import('./PaperExcludePickerDialog');
const { PAPER_EXCLUDE_MAX } = await import('@/lib/problem-bank/paper-exclusions');

const paper = (id: string, title: string, total_questions = 10) => ({
  id, title, total_questions, source_labels: [], created_at: '2026-11-07T00:00:00Z',
});
const week1 = paper('p1', '음운 1주차', 112);
const week2 = paper('p2', '음운 2주차', 80);
const excluded1 = { id: 'p1', title: '음운 1주차', total_questions: 112 };

beforeEach(() => {
  fetchPapersForPicker.mockReset();
  toastError.mockReset();
});

function draw(selected = [] as { id: string; title: string; total_questions: number }[]) {
  const onApply = vi.fn();
  const onClose = vi.fn();
  render(<PaperExcludePickerDialog open selected={selected} onClose={onClose} onApply={onApply} />);
  return { onApply, onClose };
}

describe('PaperExcludePickerDialog', () => {
  it('여럿을 체크해 한 번에 정한다', async () => {
    fetchPapersForPicker.mockResolvedValue([week1, week2]);
    const { onApply } = draw();
    fireEvent.click(await screen.findByRole('checkbox', { name: /음운 1주차/ }));
    fireEvent.click(screen.getByRole('checkbox', { name: /음운 2주차/ }));
    fireEvent.click(screen.getByRole('button', { name: '2개 문제지의 문항 빼기' }));
    expect(onApply).toHaveBeenCalledWith([excluded1, { id: 'p2', title: '음운 2주차', total_questions: 80 }]);
  });

  it('이미 빼고 있는 문제지는 체크된 채로 열리고, 풀어서 적용하면 빈 배열이다', async () => {
    fetchPapersForPicker.mockResolvedValue([week1]);
    const { onApply } = draw([excluded1]);
    const box = await screen.findByRole<HTMLInputElement>('checkbox', { name: /음운 1주차/ });
    expect(box.checked).toBe(true);
    fireEvent.click(box);
    fireEvent.click(screen.getByRole('button', { name: '빼지 않기' }));
    expect(onApply).toHaveBeenCalledWith([]);
  });

  it('⚠️ 검색으로 목록이 바뀌어도 앞에서 체크한 문제지는 풀리지 않는다', async () => {
    fetchPapersForPicker.mockImplementation(async (search: string) => (search ? [week2] : [week1]));
    const { onApply } = draw();
    fireEvent.click(await screen.findByRole('checkbox', { name: /음운 1주차/ }));
    fireEvent.change(screen.getByRole('textbox', { name: '문제지 제목으로 찾기' }), { target: { value: '2주차' } });
    fireEvent.click(await screen.findByRole('checkbox', { name: /음운 2주차/ }));
    fireEvent.click(screen.getByRole('button', { name: '2개 문제지의 문항 빼기' }));
    expect(onApply.mock.calls[0][0].map((p: { id: string }) => p.id)).toEqual(['p1', 'p2']);
  });

  it('⚠️ 상한에 닿으면 새 문제지는 못 고른다 — 고른 것은 풀 수 있다(주소가 프록시 상한을 넘으면 목록이 죽는다, 코덱스 2R)', async () => {
    const papers = Array.from({ length: PAPER_EXCLUDE_MAX + 1 }, (_, i) => paper(`p${i}`, `문제지 ${i}번`));
    const atLimit = papers.slice(0, PAPER_EXCLUDE_MAX).map(({ id, title, total_questions }) => ({ id, title, total_questions }));
    fetchPapersForPicker.mockResolvedValue(papers);
    const { onApply } = draw(atLimit);

    const extra = await screen.findByRole<HTMLInputElement>('checkbox', { name: new RegExp(`문제지 ${PAPER_EXCLUDE_MAX}번`) });
    expect(extra.disabled).toBe(true);
    expect(screen.getByText(`한 번에 ${PAPER_EXCLUDE_MAX}개까지 고를 수 있어요.`)).toBeTruthy();

    const first = screen.getByRole<HTMLInputElement>('checkbox', { name: /문제지 0번/ });
    expect(first.disabled).toBe(false);
    fireEvent.click(first);
    expect(extra.disabled).toBe(false);
    fireEvent.click(extra);
    fireEvent.click(screen.getByRole('button', { name: `${PAPER_EXCLUDE_MAX}개 문제지의 문항 빼기` }));
    expect(onApply.mock.calls[0][0]).toHaveLength(PAPER_EXCLUDE_MAX);
  });

  it("못 읽으면 '맞는 문제지가 없어요' 라고 하지 않는다", async () => {
    fetchPapersForPicker.mockRejectedValue(new Error('연결이 끊겼어요.'));
    draw();
    expect(await screen.findByText('문제지를 불러오지 못했어요.')).toBeTruthy();
    expect(screen.queryByText('맞는 문제지가 없어요.')).toBeNull();
    expect(toastError).toHaveBeenCalledWith('연결이 끊겼어요.');
  });

  it('목록이 상한에 닿으면 제목으로 찾으라고 알린다', async () => {
    fetchPapersForPicker.mockResolvedValue([week1, week2]);
    draw();
    await waitFor(() => expect(screen.getByText(/최근 2개만 보여요/)).toBeTruthy());
  });

  it('취소는 적용하지 않는다', async () => {
    fetchPapersForPicker.mockResolvedValue([week1]);
    const { onApply, onClose } = draw();
    fireEvent.click(await screen.findByRole('checkbox', { name: /음운 1주차/ }));
    fireEvent.click(screen.getByRole('button', { name: '취소' }));
    expect(onClose).toHaveBeenCalled();
    expect(onApply).not.toHaveBeenCalled();
  });
});
