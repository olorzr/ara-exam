import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import QuizReferencesSection from './QuizReferencesSection';
import type { AttachedReference } from '@/lib/quiz-references/types';

const ref = (over: Partial<AttachedReference> = {}): AttachedReference => ({
  key: 'sheet:a', kind: 'sheet', id: 'a', label: '개념지 · 진달래꽃',
  subtitle: '2026 · 중2 · 천재(정호웅)', updatedAt: '2026-09-01T00:00:00Z',
  reason: "제목에 '진달래꽃'", auto: true, plain: '본문', truncated: false, ...over,
});

const props = (over: Partial<Parameters<typeof QuizReferencesSection>[0]> = {}) => ({
  attached: [ref()],
  suggesting: false,
  canSuggest: true,
  hasRoom: true,
  textChars: 1000,
  referenceChars: 2000,
  onSuggest: vi.fn(),
  onOpenPicker: vi.fn(),
  onRemove: vi.fn(),
  ...over,
});

describe('QuizReferencesSection', () => {
  it('왜 붙었는지 반드시 보여 준다 — 근거 없이 붙으면 고칠 실마리가 없다', () => {
    render(<QuizReferencesSection {...props()} />);
    expect(screen.getByText("자동 · 제목에 '진달래꽃'")).toBeTruthy();
    expect(screen.getByText('개념지 · 진달래꽃')).toBeTruthy();
  });

  it('직접 고른 자료는 자동이라고 하지 않는다', () => {
    render(<QuizReferencesSection {...props({
      attached: [ref({ auto: false, reason: '직접 고름' })],
    })} />);
    expect(screen.getByText('직접 고름')).toBeTruthy();
  });

  it('본문을 아직 못 읽었으면 그렇다고 알린다 — 그동안 만들기가 잠긴다', () => {
    render(<QuizReferencesSection {...props({ attached: [ref({ plain: null })] })} />);
    expect(screen.getByText('본문 불러오는 중…')).toBeTruthy();
  });

  it('잘린 자료는 앞부분만 보낸다고 밝힌다 — 안 밝히면 "왜 뒷부분을 못 봤지" 가 남는다', () => {
    render(<QuizReferencesSection {...props({ attached: [ref({ truncated: true })] })} />);
    expect(screen.getByText('앞부분만 보냄')).toBeTruthy();
  });

  it('자료마다 빼기 버튼이 있고 어느 자료인지 이름으로 말한다', () => {
    const onRemove = vi.fn();
    render(<QuizReferencesSection {...props({ onRemove })} />);
    screen.getByLabelText('개념지 · 진달래꽃 빼기').click();
    expect(onRemove).toHaveBeenCalledWith('sheet:a');
  });

  it('찾을 신호가 없으면 찾기를 잠그고 무엇을 하면 되는지 알려 준다', () => {
    render(<QuizReferencesSection {...props({ attached: [], canSuggest: false })} />);
    expect((screen.getByRole('button', { name: /참고자료 찾기/ }) as HTMLButtonElement).disabled)
      .toBe(true);
    expect(screen.getByText(/작품 제목·지은이를 적거나/)).toBeTruthy();
  });

  it('자리가 다 찼으면 직접 추가를 잠근다', () => {
    render(<QuizReferencesSection {...props({ hasRoom: false })} />);
    expect((screen.getByRole('button', { name: /직접 추가/ }) as HTMLButtonElement).disabled)
      .toBe(true);
  });

  it('지문과 참고자료의 글자 수 합을 보여 준다 — 상한이 언제 걸릴지 알아야 한다', () => {
    render(<QuizReferencesSection {...props()} />);
    expect(screen.getByText(/지문 1,000자 \+ 참고자료 2,000자/)).toBeTruthy();
  });
});
