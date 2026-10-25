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
    fireEvent.click(screen.getByLabelText('이름 칸 넣기'));
    fireEvent.click(screen.getByRole('button', { name: '저장' }));
    await waitFor(() => expect(props.onClose).toHaveBeenCalled());
    expect(props.onSave).toHaveBeenCalledWith(
      {
        kind: 'simple', layout: 'basic', title: '여름 특강', subtitle: '', showNameBox: false, imagePath: '',
        teacher: '', backKind: 'none', backImagePath: '',
      },
      { front: null, back: null },
    );
  });

  it('디자인을 고르고 여러 줄 부제를 적으면 줄바꿈째 저장한다', async () => {
    const props = renderDialog(null);
    fireEvent.change(screen.getByLabelText(/부제/), { target: { value: '고등 1학년\n화자와 정서' } });
    fireEvent.click(screen.getByLabelText('책등'));
    fireEvent.click(screen.getByRole('button', { name: '저장' }));
    await waitFor(() => expect(props.onSave).toHaveBeenCalled());
    expect(vi.mocked(props.onSave).mock.calls[0][0]).toMatchObject({
      kind: 'simple', layout: 'spines', subtitle: '고등 1학년\n화자와 정서',
    });
  });

  it('지금 디자인으로 시작하고, 그림 표지로 바꾸면 디자인 없이 저장한다', async () => {
    const props = renderDialog({ ...DEFAULT_SIMPLE_COVER, layout: 'soft' });
    expect((screen.getByLabelText('블러') as HTMLInputElement).checked).toBe(true);
    fireEvent.click(screen.getByLabelText('만든 표지 그림 올리기'));
    expect(screen.queryByLabelText('블러')).toBeNull();
    fireEvent.change(screen.getByLabelText(/A4 세로 비율/), {
      target: { files: [new File(['x'], 'cover.png', { type: 'image/png' })] },
    });
    fireEvent.click(screen.getByRole('button', { name: '저장' }));
    await waitFor(() => expect(props.onSave).toHaveBeenCalled());
    expect(vi.mocked(props.onSave).mock.calls[0][0]).toMatchObject({ kind: 'image', layout: 'basic' });
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

  it('선생님 칸 — 자리글이 만든 선생님 이름이고, 적은 이름으로 저장한다', async () => {
    const props = renderDialog(null, { creatorName: '송알' });
    const input = screen.getByPlaceholderText('송알');
    fireEvent.change(input, { target: { value: '김선생' } });
    fireEvent.click(screen.getByRole('button', { name: '저장' }));
    await waitFor(() => expect(props.onSave).toHaveBeenCalled());
    expect(vi.mocked(props.onSave).mock.calls[0][0]).toMatchObject({ teacher: '김선생' });
  });

  it('뒷표지 — 앞표지와 같은 디자인을 골라 저장한다', async () => {
    const props = renderDialog({ ...DEFAULT_SIMPLE_COVER, layout: 'zine' });
    fireEvent.click(screen.getByLabelText('앞표지와 같은 디자인'));
    fireEvent.click(screen.getByRole('button', { name: '저장' }));
    await waitFor(() => expect(props.onSave).toHaveBeenCalled());
    expect(vi.mocked(props.onSave).mock.calls[0][0]).toMatchObject({ layout: 'zine', backKind: 'design', backImagePath: '' });
  });

  it('뒷표지 — 그림 앞표지에는 디자인 짝이 없고, 디자인 뒷표지였으면 없음으로 바뀐다', async () => {
    const props = renderDialog({ ...DEFAULT_SIMPLE_COVER, backKind: 'design' });
    expect((screen.getByLabelText('앞표지와 같은 디자인') as HTMLInputElement).checked).toBe(true);
    fireEvent.click(screen.getByLabelText('만든 표지 그림 올리기'));
    expect(screen.queryByLabelText('앞표지와 같은 디자인')).toBeNull();
    expect((screen.getByLabelText('뒷표지 없음') as HTMLInputElement).checked).toBe(true);
    fireEvent.change(screen.getByLabelText(/A4 세로 비율/), {
      target: { files: [new File(['x'], 'cover.png', { type: 'image/png' })] },
    });
    fireEvent.click(screen.getByRole('button', { name: '저장' }));
    await waitFor(() => expect(props.onSave).toHaveBeenCalled());
    expect(vi.mocked(props.onSave).mock.calls[0][0]).toMatchObject({ kind: 'image', backKind: 'none' });
  });

  it('뒷표지 그림 — 고르기 전에는 저장할 수 없고, 고르면 두 번째 인자로 넘긴다', async () => {
    const props = renderDialog(null);
    fireEvent.click(screen.getByLabelText('뒷표지 그림 올리기'));
    expect((screen.getByRole('button', { name: '저장' }) as HTMLButtonElement).disabled).toBe(true);
    const back = new File(['b'], 'back.png', { type: 'image/png' });
    fireEvent.change(screen.getByLabelText('뒷표지 그림'), { target: { files: [back] } });
    fireEvent.click(screen.getByRole('button', { name: '저장' }));
    await waitFor(() => expect(props.onSave).toHaveBeenCalled());
    expect(vi.mocked(props.onSave).mock.calls[0][1]).toEqual({ front: null, back });
  });

  it('이미 올린 뒷표지 그림은 다시 고르지 않아도 저장할 수 있다', () => {
    renderDialog({ ...DEFAULT_SIMPLE_COVER, backKind: 'image', backImagePath: 'papers/p/cover-b.jpg' });
    expect((screen.getByLabelText('뒷표지 그림 올리기') as HTMLInputElement).checked).toBe(true);
    expect((screen.getByRole('button', { name: '저장' }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('뒷표지 그림을 고르다 말고 표지 없음으로 바꾸면 저장할 수 있다(코덱스 1R)', async () => {
    const props = renderDialog(DEFAULT_SIMPLE_COVER);
    fireEvent.click(screen.getByLabelText('뒷표지 그림 올리기'));
    expect((screen.getByRole('button', { name: '저장' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByLabelText('표지 없음'));
    const save = screen.getByRole('button', { name: '저장' }) as HTMLButtonElement;
    expect(save.disabled).toBe(false);
    fireEvent.click(save);
    await waitFor(() => expect(props.onRemove).toHaveBeenCalled());
  });
});
