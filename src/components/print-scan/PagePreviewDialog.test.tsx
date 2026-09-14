import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import PagePreviewDialog from './PagePreviewDialog';

const PAGES = [2, 5, 7];

describe('PagePreviewDialog', () => {
  it('닫혀 있으면 아무것도 그리지 않는다', () => {
    render(
      <PagePreviewDialog
        page={null} pages={PAGES} src="data:image/jpeg;base64,x" loading={false}
        onClose={() => {}} onNavigate={() => {}}
      />,
    );
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('그린 쪽을 크게 보여 준다', () => {
    render(
      <PagePreviewDialog
        page={5} pages={PAGES} src="data:image/jpeg;base64,x" loading={false}
        onClose={() => {}} onNavigate={() => {}}
      />,
    );
    const image = screen.getByAltText('5쪽 크게 보기') as HTMLImageElement;
    expect(image.src).toContain('data:image/jpeg');
  });

  it('띄엄띄엄한 목록의 양 끝에서는 그쪽 단추가 잠긴다 — 묶음이 덮는 쪽은 연속이 아니다', () => {
    const { rerender } = render(
      <PagePreviewDialog
        page={2} pages={PAGES} src="x" loading={false} onClose={() => {}} onNavigate={() => {}}
      />,
    );
    expect((screen.getByRole('button', { name: '앞 쪽' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: '다음 쪽' }) as HTMLButtonElement).disabled).toBe(false);

    rerender(
      <PagePreviewDialog
        page={7} pages={PAGES} src="x" loading={false} onClose={() => {}} onNavigate={() => {}}
      />,
    );
    expect((screen.getByRole('button', { name: '다음 쪽' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('다음 단추는 목록에서의 이웃으로 간다 (6쪽이 아니라 7쪽)', () => {
    const onNavigate = vi.fn();
    render(
      <PagePreviewDialog
        page={5} pages={PAGES} src="x" loading={false} onClose={() => {}} onNavigate={onNavigate}
      />,
    );
    screen.getByRole('button', { name: '다음 쪽' }).click();
    expect(onNavigate).toHaveBeenCalledWith(7);
  });

  it('아직 못 그렸으면 자리를 지키고 알린다 — 빈 창은 고장으로 보인다', () => {
    render(
      <PagePreviewDialog
        page={5} pages={PAGES} src={null} loading onClose={() => {}} onNavigate={() => {}}
      />,
    );
    expect(screen.getByText('불러오는 중…')).toBeDefined();
  });

  it('실패하면 까닭을 보여 준다', () => {
    render(
      <PagePreviewDialog
        page={5} pages={PAGES} src={null} loading={false} error="이 쪽을 크게 그리지 못했어요."
        onClose={() => {}} onNavigate={() => {}}
      />,
    );
    expect(screen.getByText('이 쪽을 크게 그리지 못했어요.')).toBeDefined();
  });
});
