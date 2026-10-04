import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import PaperCoverDialog from './PaperCoverDialog';
import { DEFAULT_SIMPLE_COVER, type PaperCover } from '@/lib/problem-paper/cover';

function renderDialog(cover: PaperCover | null, overrides: Partial<Parameters<typeof PaperCoverDialog>[0]> = {}) {
  const props = {
    open: true,
    paperTitle: '상현중 기출',
    cover,
    busy: false,
    onClose: vi.fn(),
    onSave: vi.fn().mockResolvedValue(true),
    onRemove: vi.fn().mockResolvedValue(true),
    ...overrides,
  };
  render(<PaperCoverDialog {...props} />);
  return props;
}

describe('PaperCoverDialog', () => {
  it('표지가 없으면 간단 표지로 시작하고, 제목 칸 자리글이 문제지 제목이다', () => {
    renderDialog(null);
    expect((screen.getByLabelText('간단 표지 만들기') as HTMLInputElement).checked).toBe(true);
    expect(screen.getByPlaceholderText('상현중 기출')).toBeTruthy();
  });

  it('간단 표지 저장 — 적은 값으로 onSave, 저장하면 닫는다', async () => {
    const props = renderDialog(null);
    fireEvent.change(screen.getByPlaceholderText('상현중 기출'), { target: { value: '여름 특강' } });
    fireEvent.click(screen.getByLabelText('학교 · 학년 반 · 이름 칸 넣기'));
    fireEvent.click(screen.getByRole('button', { name: '저장' }));
    await waitFor(() => expect(props.onClose).toHaveBeenCalled());
    expect(props.onSave).toHaveBeenCalledWith(
      { kind: 'simple', title: '여름 특강', subtitle: '', showNameBox: false, imagePath: '' },
      null,
    );
  });

  it('표지 없음으로 저장하면 지금 표지를 뺀다', async () => {
    const props = renderDialog(DEFAULT_SIMPLE_COVER);
    fireEvent.click(screen.getByLabelText('표지 없음'));
    fireEvent.click(screen.getByRole('button', { name: '저장' }));
    await waitFor(() => expect(props.onRemove).toHaveBeenCalled());
    expect(props.onSave).not.toHaveBeenCalled();
  });

  it('그림을 고르기 전에는 그림 표지를 저장할 수 없다', () => {
    renderDialog(null);
    fireEvent.click(screen.getByLabelText('만든 표지 그림 올리기'));
    expect((screen.getByRole('button', { name: '저장' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('이미 올린 그림 표지는 그림을 다시 고르지 않아도 저장할 수 있다', () => {
    renderDialog({ ...DEFAULT_SIMPLE_COVER, kind: 'image', imagePath: 'papers/p/cover-a.jpg' });
    expect((screen.getByRole('button', { name: '저장' }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('저장 중에는 단추가 잠긴다', () => {
    renderDialog(null, { busy: true });
    expect((screen.getByRole('button', { name: '저장하는 중…' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: '취소' }) as HTMLButtonElement).disabled).toBe(true);
  });
});
