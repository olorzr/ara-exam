import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import type { ReferenceText } from '@/types/reference-text';
import ReferenceTextView from './ReferenceTextView';

vi.mock('./ReferenceBodyView', () => ({
  default: ({ body, className }: { body: string; className?: string }) => (
    <div data-testid="body" data-class={className ?? ''}>{body}</div>
  ),
}));

const row: ReferenceText = {
  id: 'r1', title: '효과적으로 듣고 말하기 — 핵심 개념', author: '', body: '본문', kind: '개념', format: 'html',
  seq: 10, tags: ['핵심 정리'], source_key: null, part_of: null, attached_to: null, char_count: 2, units: [], grammar_paths: [], note: '',
  user_id: 'u', updated_by: null, created_at: '2026-11-07T00:00:00Z', updated_at: '2026-11-07T00:00:00Z',
};
const unit = { grade: '중2', textbook: '동아', semester: '1학기', unit_path: ['1. 가', '(1) 나'] };
const top = { ...row, id: 't1', body: '제재 본문', source_key: '평가문제집|동아|중2-1학기|묶음|작품|1. 가 > (1) 나|동백꽃|김유정', attached_to: 'r1', units: [unit] };
const wing = { ...row, id: 'g1', body: '여백 본문', source_key: '평가문제집|동아|중2-1학기|묶음|여백|1. 가 > (1) 나', attached_to: 'r1', units: [unit] };

describe('ReferenceTextView — 묶음의 부분과 붙은 글', () => {
  it('부분이면 묶음으로, 붙은 글이면 붙은 곳으로 가는 길을 준다', () => {
    const { unmount } = render(<ReferenceTextView row={{ ...row, part_of: 'b1' }} backHref="/reference-texts" />);
    expect(screen.getByRole('link', { name: '묶음 보기' }).getAttribute('href')).toBe('/reference-texts/b1');
    unmount();
    render(<ReferenceTextView row={{ ...row, attached_to: 'w1' }} backHref="/reference-texts" />);
    expect(screen.getByRole('link', { name: '붙은 글 보기' }).getAttribute('href')).toBe('/reference-texts/w1');
  });

  it('붙은 글이 없으면 안내도 칸도 없다', () => {
    render(<ReferenceTextView row={row} backHref="/reference-texts" />);
    expect(screen.queryByRole('link', { name: '묶음 보기' })).toBeNull();
    expect(screen.queryByRole('complementary')).toBeNull();
    expect(screen.getAllByTestId('body')).toHaveLength(1);
  });

  it('제재 정리는 본문보다 앞에 전체 폭으로 그린다', () => {
    render(<ReferenceTextView row={{ ...row, kind: '작품' }} attachments={[top]} backHref="/reference-texts" />);
    const bodies = screen.getAllByTestId('body').map((el) => el.textContent);
    expect(bodies).toEqual(['제재 본문', '본문']);
    expect(screen.getByRole('region', { name: '제재 정리' })).toBeTruthy();
    expect(screen.queryByRole('complementary')).toBeNull();
  });

  it('여백 글은 본문 오른쪽 칸에 작은 글자로 그린다', () => {
    render(<ReferenceTextView row={row} attachments={[wing]} backHref="/reference-texts" />);
    const aside = screen.getByRole('complementary', { name: '여백 정리' });
    expect(within(aside).getByTestId('body').getAttribute('data-class')).toBe('ref-sheet--wing');
    expect(within(aside).getByText('여백 본문')).toBeTruthy();
  });

  it('고치기는 원장에게만 — 붙은 글 자신의 화면으로 간다', () => {
    const { unmount } = render(<ReferenceTextView row={row} attachments={[top, wing]} backHref="/reference-texts" />);
    expect(screen.queryByRole('link', { name: '고치기' })).toBeNull();
    unmount();
    render(<ReferenceTextView row={row} attachments={[top, wing]} backHref="/reference-texts" onEdit={() => {}} />);
    expect(screen.getAllByRole('link', { name: '고치기' }).map((a) => a.getAttribute('href'))).toEqual(['/reference-texts/t1', '/reference-texts/g1']);
  });

  it('같은 자리의 글이 둘이면 이름표에 단원을 붙인다', () => {
    render(<ReferenceTextView row={row} attachments={[top, { ...top, id: 't2', units: [{ ...unit, textbook: '해냄' }] }]} backHref="/reference-texts" />);
    expect(screen.getAllByRole('region').map((el) => el.getAttribute('aria-label'))).toEqual([
      expect.stringContaining('동아'), expect.stringContaining('해냄'),
    ]);
  });

  it('붙은 글만 못 읽었으면 본문은 그리고 다시 읽기를 내민다', () => {
    const onRetry = vi.fn();
    render(<ReferenceTextView row={row} attachFailed onRetry={onRetry} backHref="/reference-texts" />);
    expect(screen.getByTestId('body').textContent).toBe('본문');
    expect(screen.getByText(/함께 붙는 정리를 불러오지 못했어요/).closest('[data-no-print]')).toBeNull();
    const retry = screen.getByRole('button', { name: '다시 불러오기' });
    expect(retry.hasAttribute('data-no-print')).toBe(true);
    fireEvent.click(retry);
    expect(onRetry).toHaveBeenCalled();
  });

  it('붙은 글을 읽는 동안은 인쇄를 잠그고 인쇄물에도 그 사실을 찍는다', () => {
    render(<ReferenceTextView row={row} attachLoading backHref="/reference-texts" />);
    const button = screen.getByRole('button', { name: '불러오는 중' });
    expect((button as HTMLButtonElement).disabled).toBe(true);
    const notice = screen.getByText('함께 붙는 정리를 불러오는 중이에요.');
    expect(notice.closest('[data-no-print]')).toBeNull();
  });
});
