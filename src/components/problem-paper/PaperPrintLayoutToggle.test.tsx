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
  it('인쇄 창에서 고를 것 — A3 · 가로 · 짧은 면 뒤집기 — 를 알린다', () => {
    const { container } = render(<PaperPrintLayoutNotice />);
    expect(container.textContent).toContain('A3');
    expect(container.textContent).toContain('짧은 면 뒤집기');
    expect(container.textContent).toContain('긴 면 뒤집기');
    expect(container.firstElementChild!.hasAttribute('data-no-print')).toBe(true);
  });

  it('막힌 까닭이 있으면 안내 대신 그것을 띄운다', () => {
    const { container } = render(<PaperPrintLayoutNotice blockedReason="번호 안내를 먼저 확인하세요" />);
    expect(container.textContent).toBe('번호 안내를 먼저 확인하세요');
  });
});
