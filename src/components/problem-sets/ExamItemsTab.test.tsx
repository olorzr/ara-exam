import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { Passage, Problem } from '@/types/problem-bank';

const signed = vi.fn((paths: string[]) => ({
  urls: new Map(paths.map((p) => [p, `https://signed/${p}`])), loading: false, missing: [] as string[], reload: vi.fn(),
}));
vi.mock('@/hooks/useSignedImageUrls', () => ({ useSignedImageUrls: (paths: string[]) => signed(paths) }));

const { default: ExamItemsTab } = await import('./ExamItemsTab');

function passage(over: Partial<Passage>): Passage {
  return {
    id: 'pA', source_id: 's1', label: '[1~2]', html: '<p>지문 본문</p>', works: [{ title: '동백꽃', author: '김유정' }],
    title: '동백꽃', author: '김유정', area_path: [], unit_path: [], page_no: 1, bbox: null, image_path: '',
    figure_paths: [], render_mode: 'text', ...over,
  } as unknown as Passage;
}

function problem(over: Partial<Problem>): Problem {
  return {
    id: 'q1', source_id: 's1', passage_id: 'pA', number: 1, question_type: '객관식', stem_html: '<p>물음</p>',
    choices: ['가', '나', '다', '라', '마'], answer: '3', score: 4, explanation_html: '', area_path: [], unit_path: [],
    grammar_paths: [], work_titles: [], work_title: '', tags: [], page_no: 1, bbox: null, image_path: '',
    figure_paths: [], render_mode: 'text', ...over,
  } as unknown as Problem;
}

describe('ExamItemsTab', () => {
  it('지문을 한 번 찍고 딸린 문항을 잇는다 — 다른 지문 뒤 서술형에서 다시 나오면 본문 대신 안내', () => {
    const { container } = render(
      <ExamItemsTab
        passages={[passage({}), passage({ id: 'pB', html: '<p>둘째 지문</p>', works: [], label: '[3]' })]}
        problems={[
          problem({ id: 'e1', number: 1, question_type: '서술형', score: null, choices: [] }),
          problem({ id: 'q3', number: 3, passage_id: 'pB' }),
          problem({ id: 'q2', number: 2 }),
          problem({ id: 'q1', number: 1 }),
        ]}
      />,
    );
    expect(container.querySelectorAll('section')).toHaveLength(3);
    expect(screen.getAllByText('지문 본문')).toHaveLength(1);
    expect(screen.getByText('앞에 나온 지문 「동백꽃」에 딸린 문항이에요.')).toBeTruthy();
    // 번호는 본문이 찍고, 머리에는 유형·배점만
    expect(screen.getAllByText('객관식 · 4점')).toHaveLength(3);
    expect(screen.getByText('서술형')).toBeTruthy();
  });

  it('같은 지문의 서술형이 바로 이어지면 같은 덩어리다', () => {
    const { container } = render(
      <ExamItemsTab
        passages={[passage({})]}
        problems={[problem({ id: 'q1' }), problem({ id: 'e1', number: 1, question_type: '서술형', choices: [] })]}
      />,
    );
    expect(container.querySelectorAll('section')).toHaveLength(1);
  });

  it('정답 선지를 글자로도 알린다(문제 은행 상세 창과 같은 부품)', () => {
    render(<ExamItemsTab passages={[]} problems={[problem({ passage_id: null })]} />);
    expect(screen.getByText('정답')).toBeTruthy();
  });

  it('그림은 본문 그림과 이미지 출제 원본만 서명한다', () => {
    signed.mockClear();
    render(
      <ExamItemsTab
        passages={[passage({ figure_paths: ['f/p.jpg'], image_path: 'crop/p.jpg' })]}
        problems={[problem({ figure_paths: ['f/q.jpg'] })]}
      />,
    );
    expect(signed).toHaveBeenLastCalledWith(['f/p.jpg', 'f/q.jpg']);
  });

  it('문항이 없으면 안내만', () => {
    render(<ExamItemsTab passages={[]} problems={[]} />);
    expect(screen.getByText('이 시험지에는 아직 읽어 낸 문항이 없어요.')).toBeTruthy();
  });
});
