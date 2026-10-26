import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { DEFAULT_BOOK_SETTINGS, SPINE_FONTS } from '@/lib/book';
import BookSpineFontField from './BookSpineFontField';

describe('BookSpineFontField — 책등 글꼴 고르기', () => {
  it('글꼴마다 진짜 라디오, 지금 글꼴이 골라져 있고 책등 제목을 그 글꼴로 보여 준다', () => {
    const { container } = render(
      <BookSpineFontField settings={DEFAULT_BOOK_SETTINGS} sample="국어 문학 기출 모음집" disabled={false} onSettings={vi.fn()} />,
    );
    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(SPINE_FONTS.length);
    expect((screen.getByLabelText('지마켓 산스') as HTMLInputElement).checked).toBe(true);
    const samples = Array.from(container.querySelectorAll<HTMLElement>('[aria-hidden="true"]'));
    expect(samples[0].textContent).toBe('국어 문학 기출');
    expect(samples.find((el) => el.style.fontFamily.startsWith('"Dongle"'))).toBeTruthy();
  });

  it('고르면 그 자리에서 설정을 보낸다', () => {
    const onSettings = vi.fn();
    render(<BookSpineFontField settings={DEFAULT_BOOK_SETTINGS} sample="" disabled={false} onSettings={onSettings} />);
    fireEvent.click(screen.getByLabelText('주아'));
    expect(onSettings).toHaveBeenCalledWith({ ...DEFAULT_BOOK_SETTINGS, spineFont: 'jua' });
  });
});
