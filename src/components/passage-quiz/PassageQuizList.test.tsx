import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import PassageQuizList from './PassageQuizList';
import type { PassageQuizDropped } from '@/lib/passage-quiz';
import type { QuizItem } from '@/lib/passage-quiz';

const items: QuizItem[] = [
  { id: 'a', kind: 'ox', text: '화자는 떠나는 이를 붙잡지 않는다.', answer: 'O', evidence: '말없이 고이 보내', source: '' },
  { id: 'b', kind: 'short', text: '길에 뿌리는 꽃은?', answer: '진달래꽃', evidence: '영변에 약산', source: '' },
  { id: 'c', kind: 'ox', text: '화자는 눈물을 흘린다.', answer: 'X', evidence: '죽어도 아니 눈물', source: '개념지 · 진달래꽃' },
];

const dropped = (over: Partial<PassageQuizDropped> = {}): PassageQuizDropped => ({
  evidenceNotInText: 0, answerNotInText: 0, duplicate: 0, malformed: 0, ...over,
});

const props = (over: Partial<Parameters<typeof PassageQuizList>[0]> = {}) => ({
  items, dropped: null, onChange: vi.fn(), onRemove: vi.fn(), onClear: vi.fn(), ...over,
});

describe('PassageQuizList', () => {
  it('유형별로 나눠 보여 주되 번호는 한 벌이다 — O,X 가 먼저다', () => {
    render(<PassageQuizList {...props()} />);
    // 문제지·정답표와 같은 번호여야 한다(numberQuizItems 한 곳에서 매긴다)
    expect(screen.getByLabelText('1번 진술')).toBeTruthy();
    expect(screen.getByLabelText('2번 진술')).toBeTruthy();
    expect(screen.getByLabelText('3번 질문')).toBeTruthy();
    expect(screen.getByText('O,X 2문항')).toBeTruthy();
    expect(screen.getByText('단답형 1문항')).toBeTruthy();
  });

  it('O,X 는 토글로, 단답형은 입력 칸으로 답을 고친다', () => {
    render(<PassageQuizList {...props()} />);
    expect(screen.getByLabelText('1번 정답 O').getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByLabelText('1번 정답 X').getAttribute('aria-pressed')).toBe('false');
    expect((screen.getByLabelText('3번 정답') as HTMLInputElement).value).toBe('진달래꽃');
  });

  it('근거는 접어 두되 지운 문항은 보여 주지 않는다', () => {
    render(<PassageQuizList {...props()} />);
    // 참고자료에서 온 근거는 어느 자료인지 함께 적는다 — 지문을 아무리 훑어도 없는 구절이다
    expect(screen.getAllByText('지문 근거')).toHaveLength(2);
    expect(screen.getByText('근거 · 개념지 · 진달래꽃')).toBeTruthy();
    expect(screen.queryByLabelText('4번 문항 빼기')).toBeNull();
  });

  it('저장되지 않는다는 것을 문항이 있는 동안 계속 보여 준다', () => {
    // 떠나기 전 확인창이 닿지 못하는 길(브라우저 뒤로 가기·로그아웃)이 있다
    render(<PassageQuizList {...props()} />);
    expect(screen.getByText(/저장되지 않아요/)).toBeTruthy();
  });

  it('왜 적게 나왔는지 적는다 — 안 적으면 "왜 세 개뿐이지" 만 남는다', () => {
    render(<PassageQuizList {...props({ dropped: dropped({ evidenceNotInText: 2, answerNotInText: 1 }) })} />);
    expect(screen.getByText(/근거 구절이 지문·참고자료에 없어 뺀 문항 2개/)).toBeTruthy();
    expect(screen.getByText(/답이 지문·참고자료에 없어 뺀 단답형 1개/)).toBeTruthy();
  });

  it('버린 것이 없으면 안내를 띄우지 않는다', () => {
    const { container } = render(<PassageQuizList {...props({ items: [], dropped: dropped() })} />);
    expect(container.innerHTML).toBe('');
  });

  it('목록이 비어도 버린 내역은 알려 준다 — 전부 걸러진 경우다', () => {
    render(<PassageQuizList {...props({ items: [], dropped: dropped({ malformed: 3 }) })} />);
    expect(screen.getByText(/모양이 안 맞아 뺀 문항 3개/)).toBeTruthy();
  });
});
