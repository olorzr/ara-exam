import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { TypeMixRow } from '@/lib/problem-paper/type-mix';
import type { QuestionType } from '@/types/problem-bank';
import TypeMixForm from './TypeMixForm';

const row = (id: string, type: QuestionType): TypeMixRow =>
  ({ id, question_type: type, passage_id: null });

/** 객관식 n개 + 주관식 m개짜리 풀 */
function pool(objective: number, subjective: number): TypeMixRow[] {
  return [
    ...Array.from({ length: objective }, (_, i) => row(`o${i}`, '객관식')),
    ...Array.from({ length: subjective }, (_, i) => row(`s${i}`, '주관식')),
  ];
}

function draw(rows: TypeMixRow[], added: string[] = []) {
  const onConfirm = vi.fn();
  const onCancel = vi.fn();
  render(
    <TypeMixForm
      rows={rows} added={new Set(added)} busy={false} onConfirm={onConfirm} onCancel={onCancel}
    />,
  );
  return { onConfirm, onCancel };
}

const totalInput = () => screen.getByLabelText('문항 수');
const percentInput = () => screen.getByLabelText('객관식 비율');
const submit = () => screen.getByRole('button', { name: /문항 담기$/ });

describe('TypeMixForm', () => {
  it('기본은 20문항 · 객관식 80% 다', () => {
    draw(pool(30, 10));

    expect(screen.getByText('객관식 16 · 주관식 4')).toBeTruthy();
    expect(submit().textContent).toContain('20문항 담기');
  });

  it('비율 버튼을 누르면 계획이 바뀐다', () => {
    draw(pool(30, 30));

    fireEvent.click(screen.getByRole('button', { name: '주관식만' }));
    expect(screen.getByText('객관식 0 · 주관식 20')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: '5 : 5' }));
    expect(screen.getByText('객관식 10 · 주관식 10')).toBeTruthy();
  });

  it('고른 비율 버튼을 눌린 상태로 알린다', () => {
    draw(pool(30, 30));

    expect(screen.getByRole('button', { name: '8 : 2' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: '5 : 5' }).getAttribute('aria-pressed')).toBe('false');
  });

  it('담을 수 있는 수를 넘겨 치면 가둔다', () => {
    draw(pool(20, 5));

    fireEvent.change(totalInput(), { target: { value: '500' } });
    // 풀이 25개뿐이라 25로 깎이고, 80% 면 20 : 5 다
    expect(screen.getByText('객관식 20 · 주관식 5')).toBeTruthy();
    expect(submit().textContent).toContain('25문항 담기');
  });

  /** 모자란 갈래를 다른 갈래로 채우지 않는다 — 담기 전에 말해 준다 */
  it('한쪽이 모자라면 덜 담고 미리 알린다', () => {
    draw(pool(30, 2));

    expect(screen.getByText('객관식 16 · 주관식 2')).toBeTruthy();
    expect(screen.getByText(/주관식 2문항이 모자라요/)).toBeTruthy();
    expect(submit().textContent).toContain('18문항 담기');
  });

  it('이미 담긴 문항은 세지 않는다', () => {
    draw(pool(10, 10), ['o0', 'o1', 'o2', 's0']);

    expect(screen.getByText(/남은 문항 객관식 7 · 주관식 9/)).toBeTruthy();
  });

  it('확정하면 고른 값을 그대로 넘긴다', () => {
    const { onConfirm } = draw(pool(30, 30));

    fireEvent.change(totalInput(), { target: { value: '10' } });
    fireEvent.change(percentInput(), { target: { value: '70' } });
    fireEvent.click(submit());

    expect(onConfirm).toHaveBeenCalledWith({ total: 10, objectivePercent: 70 });
  });

  it('담을 것이 하나도 없으면 폼 대신 까닭을 적는다', () => {
    const { onCancel } = draw(pool(2, 0), ['o0', 'o1']);

    expect(screen.queryByLabelText('문항 수')).toBeNull();
    expect(screen.getByText(/이 조건의 문항이 모두 담겨 있어요/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: '닫기' }));
    expect(onCancel).toHaveBeenCalled();
  });

  it('문제지가 가득 찼으면 그렇게 말한다', () => {
    const added = Array.from({ length: 200 }, (_, i) => `x${i}`);
    draw(pool(30, 30), added);

    expect(screen.getByText(/문제지가 가득 찼어요/)).toBeTruthy();
  });
});
