import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('next/navigation', () => ({ useParams: () => ({ id: 's1' }) }));
// 탭 안 부품은 각자 테스트한다 — 여기서는 머리의 링크만 본다
vi.mock('@/components/problem-sets', () => ({
  ExamItemsTab: () => null, ExamOriginalTab: () => null, ExamAnswerKeyTab: () => null,
}));
vi.mock('@/hooks/useExamView', () => ({
  useExamView: () => ({
    data: {
      source: {
        id: 's1', source_type: '내신기출', title: '2025 압구정중 중1 2학기 기말', school_name: '압구정중학교',
        year: '2025', grade: '중1', semester: '2학기', exam_type: '기말', textbook: '비상(박현숙)', publisher: '',
        page_count: 8, answer_key_paths: [], file_path: '',
      },
      passages: [], problems: [],
    },
    loading: false, missing: false, error: null, reload: vi.fn(),
  }),
}));

const { default: ProblemSetExamPage } = await import('./page');

describe('읽기 전용 시험 보기 — 머리', () => {
  it("'원본 대조로 고치기' 가 그 시험지의 고치기 화면으로 간다(2026-11-22)", () => {
    render(<ProblemSetExamPage />);
    expect(screen.getByRole('link', { name: '원본 대조로 고치기' }).getAttribute('href')).toBe('/problems/sources/s1');
    expect(screen.getByRole('heading', { level: 1, name: '압구정중학교' })).toBeTruthy();
  });
});
