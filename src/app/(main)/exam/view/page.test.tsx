import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

/**
 * 단어 시험지 보기 — 문항 조회 실패·불일치 (2026-10-15 리뷰 6번).
 *
 * 합성 저장소: 표마다 돌려줄 응답을 바꿔 끼운다. 인쇄 뷰는 받은 문항 수만 찍는 대역이다.
 */

type Res = { data: unknown; error: { message: string } | null };
const m = vi.hoisted(() => ({ responses: {} as Record<string, () => Res> }));

vi.mock('next/navigation', () => ({ useSearchParams: () => ({ get: () => 'exam-1' }) }));
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: (table: string) => {
      const q: Record<string, unknown> = {};
      for (const k of ['select', 'eq', 'order', 'range', 'maybeSingle', 'single', 'in']) q[k] = () => q;
      q.then = (yes: (r: Res) => unknown, no: (e: unknown) => unknown) =>
        Promise.resolve((m.responses[table] ?? (() => ({ data: [], error: null })))()).then(yes, no);
      return q;
    },
  },
}));
vi.mock('@/components/exam', () => ({
  ExamPaperView: ({ words }: { words: unknown[] }) => <div>시험지 문항 {words.length}</div>,
  MultipleChoiceView: ({ words }: { words: unknown[] }) => <div>객관식 문항 {words.length}</div>,
  MultipleChoiceAnswerView: () => null,
  WordBookView: () => null,
}));

const { default: ExamViewPage } = await import('./page');

const exam = (total: number, over: Record<string, unknown> = {}) => ({
  id: 'exam-1', title: '합성 단어시험', pass_percentage: 80, total_questions: total, pass_count: 4,
  category_ids: [], created_at: '', ...over,
});
const words = (n: number) => Array.from({ length: n }, (_, i) => ({
  id: `w${i}`, exam_id: 'exam-1', word_id: `word-${i}`, word: `단어${i}`, meaning: `뜻${i}`, order_index: i,
}));
const ok = (data: unknown) => () => ({ data, error: null });
const fail = () => ({ data: null, error: { message: 'network failed' } });

beforeEach(() => {
  m.responses = {};
});

describe('단어 시험지 보기 — 문항 조회', () => {
  it('⚠️ 메타는 읽었는데 문항 조회가 실패하면 빈 시험지를 그리지 않고 인쇄를 막는다', async () => {
    m.responses = { exams: ok(exam(20)), exam_words: fail };
    render(<ExamViewPage />);

    expect(await screen.findByText(/문항을 불러오지 못했어요/)).toBeTruthy();
    expect(screen.queryByText('인쇄')).toBeNull();
    expect(screen.queryByText(/시험지 문항/)).toBeNull();
  });

  it('⚠️ 읽은 문항 수가 메타와 다르면 막는다 — 부분 목록으로 선지·정답을 만들지 않는다', async () => {
    m.responses = { exams: ok(exam(20)), exam_words: ok(words(19)) };
    render(<ExamViewPage />);

    expect(await screen.findByText(/20개 중 19개/)).toBeTruthy();
    expect(screen.queryByText('인쇄')).toBeNull();
    expect(screen.queryByText(/문항 \d+$/)).toBeNull();
  });

  it('메타와 문항이 둘 다 실패하면 다시 시도를 내준다(없는 시험으로 말하지 않는다)', async () => {
    m.responses = { exams: fail, exam_words: fail };
    render(<ExamViewPage />);

    expect(await screen.findByText('시험지를 불러오지 못했어요')).toBeTruthy();
    expect(screen.queryByText('시험지를 찾을 수 없어요')).toBeNull();

    m.responses = { exams: ok(exam(5)), exam_words: ok(words(5)) };
    fireEvent.click(screen.getByText('다시 시도'));
    expect(await screen.findByText('시험지 문항 5')).toBeTruthy();
  });

  it('문항 조회 실패 뒤 다시 시도가 성공하면 정상으로 그린다', async () => {
    m.responses = { exams: ok(exam(5)), exam_words: fail };
    render(<ExamViewPage />);
    await screen.findByText(/문항을 불러오지 못했어요/);

    m.responses = { exams: ok(exam(5)), exam_words: ok(words(5)) };
    fireEvent.click(screen.getByText('다시 시도'));
    expect(await screen.findByText('시험지 문항 5')).toBeTruthy();
    expect(screen.getByText('인쇄').closest('button')?.disabled).toBe(false);
  });

  it('없는 시험이면 찾을 수 없다고 한다', async () => {
    m.responses = { exams: ok(null), exam_words: ok([]) };
    render(<ExamViewPage />);
    expect(await screen.findByText('시험지를 찾을 수 없어요')).toBeTruthy();
  });
});

describe('단어 시험지 보기 — 정상', () => {
  it('정상 시험은 그리고 인쇄할 수 있다', async () => {
    m.responses = { exams: ok(exam(5)), exam_words: ok(words(5)) };
    render(<ExamViewPage />);
    expect(await screen.findByText('시험지 문항 5')).toBeTruthy();
    expect(screen.getByText('인쇄').closest('button')?.disabled).toBe(false);

    fireEvent.click(screen.getByText('객관식 시험지'));
    expect(screen.getByText('객관식 문항 5')).toBeTruthy();
  });

  it('정상 재시험도 그대로 그린다', async () => {
    m.responses = {
      exams: ok(exam(6, { parent_exam_id: 'exam-0', retake_number: 1, title: '합성 단어시험 (재시험 1차)' })),
      exam_words: ok(words(6)),
    };
    render(<ExamViewPage />);
    expect(await screen.findByText('시험지 문항 6')).toBeTruthy();
    expect(screen.getByText('인쇄')).toBeTruthy();
  });
});
