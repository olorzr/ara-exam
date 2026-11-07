import { beforeAll, describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { stubPrintLayout } from '@/test-utils/print-layout-stub';
import type { PaperItemSnapshot, ProblemPaper } from '@/types/problem-bank';
import ProblemAnswerKeyView from './ProblemAnswerKeyView';

/**
 * 답지의 쪽 수 알림 — 실제 배치가 돌아야 알림이 오므로 재는 값을 흉내 낸다(stubPrintLayout).
 * 같은 파일의 다른 테스트(ProblemAnswerKeyView.test)는 측정 없는 폴백으로 돌아 따로 뒀다.
 */
beforeAll(() => stubPrintLayout({ firstHeader: 120, laterHeader: 30 }));

const paper: ProblemPaper = {
  id: 'p1', title: '2026 고1 1학기 중간 대비', settings: { columns: 2, showScore: false, showSource: true, omr: false },
  source_labels: [], total_questions: 1, user_id: 'u1', updated_by: null,
  created_at: '2026-10-10T00:00:00Z', updated_at: '2026-10-10T00:00:00Z',
};

const item: PaperItemSnapshot = {
  number: 1, question_type: '객관식', stem_html: '<p>물음</p>', choices: ['가', '나', '다', '라', '마'], answer: '3',
  score: null, explanation_html: '', area_path: [], work_title: '', render_mode: 'text', image_path: '', figure_paths: [],
  passage: null,
  source: { source_type: '내신기출', title: '', school_name: '성수고', year: '2026', grade: '고1', exam_type: '중간', publisher: '' },
};

describe('ProblemAnswerKeyView — 쪽 수 알림', () => {
  it('배치가 끝나면 onLayout 으로 본문 쪽 수를 알린다', () => {
    const onLayout = vi.fn();
    render(<ProblemAnswerKeyView paper={paper} items={[item]} onLayout={onLayout} />);
    expect(onLayout).toHaveBeenCalled();
    expect((onLayout.mock.calls.at(-1)![0] as { pageCount: number }).pageCount).toBe(1);
  });
});
