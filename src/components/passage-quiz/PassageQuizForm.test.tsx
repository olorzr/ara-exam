import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import PassageQuizForm from './PassageQuizForm';
import { EMPTY_DRAFT, PASSAGE_QUIZ_TEXT_LIMIT } from '@/lib/passage-quiz';

const props = (over: Partial<Parameters<typeof PassageQuizForm>[0]> = {}) => ({
  draft: { ...EMPTY_DRAFT, text: '나 보기가 역겨워 가실 때에는' },
  onChange: vi.fn(),
  running: false,
  onGenerate: vi.fn(),
  onCancel: vi.fn(),
  onOpenPicker: vi.fn(),
  ...over,
});

describe('PassageQuizForm', () => {
  it('개수 칸은 비어 있는 것이 기본이고 자리표시자가 자동이라고 말한다', () => {
    render(<PassageQuizForm {...props()} />);
    const ox = screen.getByLabelText('O,X 개수') as HTMLInputElement;
    expect(ox.value).toBe('');
    expect(ox.getAttribute('placeholder')).toBe('자동');
    expect(screen.getByText(/AI 가 정합니다/)).toBeTruthy();
  });

  it('지문이 없으면 만들 수 없고 까닭을 보여 준다', () => {
    render(<PassageQuizForm {...props({ draft: EMPTY_DRAFT })} />);
    expect((screen.getByRole('button', { name: /문항 만들기/ }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText('지문을 붙여 넣어 주세요.')).toBeTruthy();
  });

  it('지문이 너무 길면 보내기 전에 막는다 — 사람이 줄이면 해결된다', () => {
    const long = 'ㄱ'.repeat(PASSAGE_QUIZ_TEXT_LIMIT + 1);
    render(<PassageQuizForm {...props({ draft: { ...EMPTY_DRAFT, text: long } })} />);
    expect(screen.getByText(/너무 길어요/)).toBeTruthy();
  });

  it('두 유형을 다 0 으로 두면 막는다 — 낼 문항이 없다', () => {
    render(<PassageQuizForm {...props({
      draft: { ...EMPTY_DRAFT, text: '지문', oxCount: '0', shortCount: '0' },
    })} />);
    expect(screen.getByText('두 유형 가운데 하나는 만들어야 해요.')).toBeTruthy();
  });

  it('만드는 중에는 취소가 나오고 다시 누를 수 없다', () => {
    render(<PassageQuizForm {...props({ running: true })} />);
    expect(screen.getByRole('button', { name: /만드는 중/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: '취소' })).toBeTruthy();
  });

  it('참고자료 사정으로도 막고 그 까닭을 보여 준다', () => {
    render(<PassageQuizForm {...props({ extraBlocker: '참고자료를 불러오는 중이에요.' })} />);
    expect((screen.getByRole('button', { name: /문항 만들기/ }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText('참고자료를 불러오는 중이에요.')).toBeTruthy();
  });

  it('입력값 문제를 먼저 말한다 — 지문이 비었는데 참고자료 얘기를 하면 안 된다', () => {
    render(<PassageQuizForm {...props({
      draft: EMPTY_DRAFT, extraBlocker: '참고자료를 불러오는 중이에요.',
    })} />);
    expect(screen.getByText('지문을 붙여 넣어 주세요.')).toBeTruthy();
  });

  it('실행 중이 아니면 취소를 보여 주지 않는다', () => {
    render(<PassageQuizForm {...props()} />);
    expect(screen.queryByRole('button', { name: '취소' })).toBeNull();
    expect(screen.getByRole('button', { name: /아카이브에서 불러오기/ })).toBeTruthy();
  });
});
