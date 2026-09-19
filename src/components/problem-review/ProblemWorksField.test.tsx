import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import ProblemWorksField from './ProblemWorksField';
import type { PassageWork } from '@/types/problem-bank';

/** base-ui 체크박스는 span 이라 aria 로 읽는다 */
const box = (name: string) => screen.getByLabelText(`${name} 묻기`);
const checked = (name: string) => box(name).getAttribute('aria-checked') === 'true';
const disabled = (name: string) => box(name).getAttribute('aria-disabled') === 'true';

const WORKS: PassageWork[] = [
  { label: '가', title: '진달래꽃', author: '김소월' },
  { label: '나', title: '엄마 걱정', author: '기형도' },
];

describe('ProblemWorksField — 지문에 작품이 있을 때', () => {
  it('빈 목록은 전체라는 뜻이라 전부 켜 놓는다', () => {
    render(<ProblemWorksField value={[]} onChange={vi.fn()} passageWorks={WORKS} />);
    expect(checked('진달래꽃')).toBe(true);
    expect(checked('엄마 걱정')).toBe(true);
    expect(screen.getByText(/지문에 실린 작품 전체/)).toBeTruthy();
  });

  it('전체에서 하나를 끄면 나머지만 남는다 — 한 편만 묻는 문항이 된다', () => {
    const onChange = vi.fn();
    render(<ProblemWorksField value={[]} onChange={onChange} passageWorks={WORKS} />);
    fireEvent.click(box('진달래꽃'));
    expect(onChange).toHaveBeenCalledWith(['엄마 걱정']);
  });

  it('전부 다시 고르면 고른 그대로 보낸다 — 빈 목록으로 바꾸면 저장 뒤에도 저장 안 됨이 남는다', () => {
    const onChange = vi.fn();
    render(<ProblemWorksField value={['엄마 걱정']} onChange={onChange} passageWorks={WORKS} />);
    fireEvent.click(box('진달래꽃'));
    expect(onChange).toHaveBeenCalledWith(['진달래꽃', '엄마 걱정']);
  });

  it("지문에 없는 작품이 섞이면 '지문 전체' 라고 말하지 않는다 — 실제로는 좁힌 목록이다", () => {
    render(
      <ProblemWorksField value={['진달래꽃', '엄마 걱정', '없는작품']} onChange={vi.fn()} passageWorks={WORKS} />,
    );
    expect(screen.getByText(/고른 작품만 묻습니다/)).toBeTruthy();
  });

  it('지문에 없는 작품도 줄을 세운다 — 안 보이면 저장하는 순간 말없이 사라진다', () => {
    const onChange = vi.fn();
    render(
      <ProblemWorksField value={['엄마 걱정', '없는작품']} onChange={onChange} passageWorks={WORKS} />,
    );
    expect(checked('없는작품')).toBe(true);
    expect(screen.getByText('지문에 없음')).toBeTruthy();
    // 그 줄을 그대로 둔 채 다른 편을 더해도 사라지지 않는다
    fireEvent.click(box('진달래꽃'));
    expect(onChange).toHaveBeenCalledWith(['진달래꽃', '엄마 걱정', '없는작품']);
  });

  it('마지막 한 편은 끌 수 없다 — 저장하면 전체로 되살아나 껐다고 착각한다', () => {
    const onChange = vi.fn();
    render(<ProblemWorksField value={['엄마 걱정']} onChange={onChange} passageWorks={WORKS} />);
    expect(disabled('엄마 걱정')).toBe(true);
    fireEvent.click(box('엄마 걱정'));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('구분 표시와 지은이를 함께 보여 준다 — 어느 편인지 알아야 고른다', () => {
    render(<ProblemWorksField value={[]} onChange={vi.fn()} passageWorks={WORKS} />);
    expect(screen.getByText('(가) 진달래꽃 · 김소월')).toBeTruthy();
  });
});

describe('ProblemWorksField — 지문이 없을 때', () => {
  it('손으로 적고, 가운뎃점으로 여러 편을 나눈다', () => {
    const onChange = vi.fn();
    render(<ProblemWorksField value={[]} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('작품명'), { target: { value: '봄봄 · 동백꽃' } });
    expect(onChange).toHaveBeenCalledWith(['봄봄', '동백꽃']);
  });

  it('친 글자를 그대로 들고 있는다 — 되만들어 그리면 가운뎃점을 칠 수가 없다', () => {
    render(<ProblemWorksField value={[]} onChange={vi.fn()} />);
    const input = screen.getByLabelText('작품명') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '봄봄 ·' } });
    expect(input.value).toBe('봄봄 ·');
  });

  it('이미 붙은 여러 편은 이어서 보여 준다', () => {
    render(<ProblemWorksField value={['봄봄', '동백꽃']} onChange={vi.fn()} />);
    expect((screen.getByLabelText('작품명') as HTMLInputElement).value).toBe('봄봄 · 동백꽃');
  });
});
