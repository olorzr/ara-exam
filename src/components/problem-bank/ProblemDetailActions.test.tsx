import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import ProblemDetailActions from './ProblemDetailActions';
import type { Problem, ProblemSource } from '@/types/problem-bank';

function problem(over: Partial<Problem> = {}): Problem {
  return {
    id: 'p1', source_id: 's1', passage_id: 'g1', number: 1, question_type: '객관식',
    stem_html: '<p>물음</p>', choices: [], answer: '1', score: null, explanation_html: '',
    area_path: [], unit_path: [], grammar_paths: [], work_titles: [], work_title: '', tags: [],
    page_no: 1, bbox: null, image_path: '', figure_paths: [], render_mode: 'text',
    status: '검수완료', verified_by: null, verified_at: null, search_text: '',
    user_id: 'u1', updated_by: null, created_at: '', updated_at: '',
    ...over,
  } as Problem;
}

const source = { id: 's1', title: '상현중 기출' } as ProblemSource;

/** 담기 단추는 **캔버스가 있는 화면에서만** 나온다 — 아카이브에는 담을 곳이 없다 */
describe('ProblemDetailActions', () => {
  it('onAdd 를 안 주면 담기 단추가 아예 없다', () => {
    render(<ProblemDetailActions shown={problem()} source={source} siblings={[problem()]} />);

    expect(screen.queryByRole('button', { name: /담기/ })).toBeNull();
    expect(screen.getByRole('link', { name: '문항 편집' })).toBeTruthy();
  });

  it('누르면 지금 보고 있는 문항에 출처를 붙여 넘긴다', () => {
    const onAdd = vi.fn();
    render(
      <ProblemDetailActions
        shown={problem({ id: 'p2' })} source={source} siblings={[problem({ id: 'p2' })]}
        onAdd={onAdd}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '문제지에 담기' }));

    expect(onAdd).toHaveBeenCalledTimes(1);
    expect(onAdd.mock.calls[0][0]).toEqual([expect.objectContaining({ id: 'p2', source })]);
  });

  it('이미 담긴 문항은 담김 으로 잠근다 — 같은 문항을 두 번 담지 않는다', () => {
    const onAdd = vi.fn();
    render(
      <ProblemDetailActions
        shown={problem()} source={source} siblings={[problem()]}
        addedIds={new Set(['p1'])} onAdd={onAdd}
      />,
    );

    const button = screen.getByRole('button', { name: '담김' }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });

  /** 지문에 딸린 문항은 함께 담아야 쓸모가 있다 — 하나만 담으면 나머지는 잊힌다 */
  it('형제가 여럿이면 지문째 담기가 함께 나오고 그 문항을 전부 넘긴다', () => {
    const onAdd = vi.fn();
    const siblings = [problem({ id: 'p1' }), problem({ id: 'p2', number: 2 })];
    render(
      <ProblemDetailActions shown={siblings[0]} source={source} siblings={siblings} onAdd={onAdd} />,
    );

    fireEvent.click(screen.getByRole('button', { name: '이 지문의 문항 2개 담기' }));

    expect(onAdd.mock.calls[0][0].map((r: Problem) => r.id)).toEqual(['p1', 'p2']);
  });

  /** ⚠️ 전체가 아니라 **아직 안 담긴 개수**를 적는다 — 전체로 세면 단추가 거짓말을 한다 */
  it('일부가 담겼으면 남은 개수만 적는다', () => {
    const siblings = [problem({ id: 'p1' }), problem({ id: 'p2', number: 2 })];
    render(
      <ProblemDetailActions
        shown={siblings[0]} source={source} siblings={siblings}
        addedIds={new Set(['p1'])} onAdd={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: '이 지문의 문항 1개 담기' })).toBeTruthy();
  });

  it('지문 문항이 다 담겼으면 잠근다', () => {
    const siblings = [problem({ id: 'p1' }), problem({ id: 'p2', number: 2 })];
    render(
      <ProblemDetailActions
        shown={siblings[0]} source={source} siblings={siblings}
        addedIds={new Set(['p1', 'p2'])} onAdd={vi.fn()}
      />,
    );

    const button = screen.getByRole('button', { name: '이 지문 모두 담김' }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });

  it('지문이 없으면(형제가 자기뿐) 지문째 담기는 안 나온다', () => {
    render(
      <ProblemDetailActions
        shown={problem({ passage_id: null })} source={source}
        siblings={[problem({ passage_id: null })]} onAdd={vi.fn()}
      />,
    );

    expect(screen.queryByRole('button', { name: /이 지문/ })).toBeNull();
  });
});
