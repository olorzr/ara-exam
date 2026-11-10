import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import PaperPrintLayoutToggle, { PaperPrintLayoutNotice } from './PaperPrintLayoutToggle';

describe('PaperPrintLayoutToggle', () => {
  it('고른 쪽만 눌려 있다', () => {
    render(<PaperPrintLayoutToggle value="booklet" onChange={() => {}} />);
    expect(screen.getByRole('button', { name: '중철 제본' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: '낱장' }).getAttribute('aria-pressed')).toBe('false');
  });

  it('누르면 그 방식을 알린다', () => {
    const onChange = vi.fn();
    render(<PaperPrintLayoutToggle value="single" onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: '중철 제본' }));
    expect(onChange).toHaveBeenCalledWith('booklet');
  });
});

describe('PaperPrintLayoutNotice', () => {
  it('인쇄 창에서 고를 것 — A3 · 여백 없음 · 고른 양면 방향 — 을 알리고, 인쇄되지 않는다', () => {
    const { container } = render(<PaperPrintLayoutNotice duplex="short" onDuplexChange={() => {}} />);
    expect(container.textContent).toContain('A3');
    expect(container.textContent).toContain('여백 없음');
    expect(container.textContent).toContain('양면(짧은 쪽으로 넘기기)');
    expect(container.textContent).toContain('반대쪽을 누르세요');
    expect(container.firstElementChild!.hasAttribute('data-no-print')).toBe(true);
  });

  it('긴 쪽을 골랐으면 안내도 긴 쪽이라고 적는다', () => {
    const { container } = render(<PaperPrintLayoutNotice duplex="long" onDuplexChange={() => {}} />);
    expect(container.textContent).toContain('양면(긴 쪽으로 넘기기)');
    expect(screen.getByRole('button', { name: '긴 쪽' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: '짧은 쪽' }).getAttribute('aria-pressed')).toBe('false');
  });

  it('양면 방향 단추를 누르면 그 방향을 알린다', () => {
    const onDuplexChange = vi.fn();
    render(<PaperPrintLayoutNotice duplex="short" onDuplexChange={onDuplexChange} />);
    expect(screen.getByRole('group', { name: '양면 넘김 방향' })).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '긴 쪽' }));
    expect(onDuplexChange).toHaveBeenCalledWith('long');
  });

  it('막힌 까닭이 있으면 안내 대신 그것을 띄운다', () => {
    const { container } = render(
      <PaperPrintLayoutNotice blockedReason="번호 안내를 먼저 확인하세요" duplex="short" onDuplexChange={() => {}} />,
    );
    expect(container.textContent).toBe('번호 안내를 먼저 확인하세요');
  });
});
