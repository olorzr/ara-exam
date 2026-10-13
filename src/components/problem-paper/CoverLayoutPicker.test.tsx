import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { COVER_LAYOUT_LABELS, COVER_LAYOUTS } from '@/lib/problem-paper/cover';
import CoverLayoutPicker from './CoverLayoutPicker';

const PREVIEW = { title: '현대시 읽기', subtitle: '고등 1학년\n화자와 정서', showNameBox: true, year: '2026' };

describe('CoverLayoutPicker', () => {
  it('디자인마다 라디오 하나와 줄인 표지를 그리고, 지금 값이 골라져 있다', () => {
    const { container } = render(<CoverLayoutPicker value="rings" onChange={() => {}} preview={PREVIEW} />);
    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(COVER_LAYOUTS.length);
    expect((screen.getByLabelText(COVER_LAYOUT_LABELS.rings) as HTMLInputElement).checked).toBe(true);
    expect((screen.getByLabelText(COVER_LAYOUT_LABELS.basic) as HTMLInputElement).checked).toBe(false);
    // 줄인 표지는 꾸밈이다 — 입력값이 그대로 들어가지만 읽는 이름은 아래 글자뿐이다
    const thumbs = container.querySelectorAll('[aria-hidden="true"] .pb-cover');
    expect(thumbs).toHaveLength(COVER_LAYOUTS.length);
    expect(thumbs[0].textContent).toContain('현대시 읽기');
  });

  it('고른 칸을 색으로만 알리지 않는다 — 라디오가 화면에 보인다', () => {
    render(<CoverLayoutPicker value="rings" onChange={() => {}} preview={PREVIEW} />);
    for (const radio of screen.getAllByRole('radio')) expect(radio.className).not.toContain('sr-only');
  });

  it('누르면 그 디자인을 알린다', () => {
    const onChange = vi.fn();
    render(<CoverLayoutPicker value="basic" onChange={onChange} preview={PREVIEW} />);
    fireEvent.click(screen.getByLabelText(COVER_LAYOUT_LABELS.spines));
    expect(onChange).toHaveBeenCalledWith('spines');
  });

  it('잠그면 고를 수 없다', () => {
    render(<CoverLayoutPicker value="basic" onChange={() => {}} preview={PREVIEW} disabled />);
    // fieldset 이 잠그면 라디오 자신의 disabled 속성은 그대로라 :disabled 로 본다
    expect(screen.getByLabelText(COVER_LAYOUT_LABELS.soft).matches(':disabled')).toBe(true);
  });
});
