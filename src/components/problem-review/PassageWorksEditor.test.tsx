import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import PassageWorksEditor from './PassageWorksEditor';
import { WORKS_MAX } from '@/lib/problem-bank/work-title';
import type { PassageWork } from '@/types/problem-bank';

const WORKS: PassageWork[] = [
  { label: '가', title: '진달래꽃', author: '김소월' },
  { label: '나', title: '엄마 걱정', author: '기형도' },
];

describe('PassageWorksEditor', () => {
  it('실린 작품을 줄마다 보여 준다 — 한 칸에 이어 적던 자리다', () => {
    render(<PassageWorksEditor works={WORKS} onChange={vi.fn()} />);
    expect((screen.getByLabelText('1번째 작품명') as HTMLInputElement).value).toBe('진달래꽃');
    expect((screen.getByLabelText('2번째 지은이') as HTMLInputElement).value).toBe('기형도');
    expect((screen.getByLabelText('1번째 작품 구분') as HTMLInputElement).value).toBe('가');
  });

  it('작품이 없으면 비었다고 말한다 — 빈 화면이면 고장인 줄 안다', () => {
    render(<PassageWorksEditor works={[]} onChange={vi.fn()} />);
    expect(screen.getByText(/실린 작품이 없어요/)).toBeTruthy();
  });

  it('줄을 더한다', () => {
    const onChange = vi.fn();
    render(<PassageWorksEditor works={WORKS} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: /작품 추가/ }));
    expect(onChange).toHaveBeenCalledWith([...WORKS, { label: '', title: '', author: '' }]);
  });

  it('줄을 지운다 — 딸린 문항의 작품명도 따라 바뀐다', () => {
    const onChange = vi.fn();
    render(<PassageWorksEditor works={WORKS} onChange={onChange} />);
    fireEvent.click(screen.getByLabelText('1번째 작품 빼기'));
    expect(onChange).toHaveBeenCalledWith([WORKS[1]]);
  });

  it('한 칸만 고쳐도 그 줄만 바뀐다', () => {
    const onChange = vi.fn();
    render(<PassageWorksEditor works={WORKS} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('2번째 작품명'), { target: { value: '엄마생각' } });
    expect(onChange).toHaveBeenCalledWith([WORKS[0], { ...WORKS[1], title: '엄마생각' }]);
  });

  it('상한에 닿으면 더 못 넣는다 — DB 의 CHECK 가 저장을 통째로 거부한다', () => {
    const many = Array.from({ length: WORKS_MAX }, (_, i) => (
      { label: '', title: `작품${i}`, author: '' }
    ));
    render(<PassageWorksEditor works={many} onChange={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /작품 추가/ })).toBeNull();
  });

  it('딸린 문항까지 바뀐다고 미리 알린다 — 모르고 고치면 놀란다', () => {
    render(<PassageWorksEditor works={WORKS} onChange={vi.fn()} />);
    expect(screen.getByText('딸린 문항의 작품명도 함께 바뀝니다')).toBeTruthy();
  });
});
