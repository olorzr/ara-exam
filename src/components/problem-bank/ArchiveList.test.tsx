import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import type { ArchiveRow } from '@/hooks/useProblemArchive';

const heads = vi.fn();
const bodies = vi.fn();

vi.mock('@/lib/problem-bank/detail-queries', () => ({
  fetchPassageHeadsByIds: (ids: string[]) => heads(ids),
  fetchPassagesByIds: (ids: string[]) => bodies(ids),
}));
vi.mock('@/hooks/useSignedImageUrls', () => ({
  useSignedImageUrls: () => ({ urls: new Map<string, string>() }),
}));

const { default: ArchiveList } = await import('./ArchiveList');

function row(id: string, passageId: string | null, over: Partial<ArchiveRow> = {}): ArchiveRow {
  return {
    id, source_id: 's1', passage_id: passageId, number: 1, question_type: '객관식',
    stem_html: `<p>${id} 물음</p>`, choices: [], answer: '1', score: null, explanation_html: '',
    area_path: [], unit_path: [], grammar_paths: [], work_titles: [], work_title: '', tags: [],
    page_no: 1, bbox: null, image_path: '', figure_paths: [], render_mode: 'text',
    status: '검수완료', verified_by: null, verified_at: null, search_text: '',
    user_id: 'u1', updated_by: null, created_at: '', updated_at: '',
    source: { id: 's1', title: '상현중' },
    ...over,
  } as unknown as ArchiveRow;
}

const head = (id: string) => ({ id, label: '[1~2]', works: [], title: '', author: '' });
const card = (r: ArchiveRow) => <div key={r.id} data-testid={`card-${r.id}`}>{r.id}</div>;

describe('ArchiveList', () => {
  /** 목록만 보고는 어느 문항이 같은 지문에 딸린 것인지 알 수 없던 것이 이 묶음의 까닭이다 */
  it('이웃한 같은 지문은 한 묶음으로 묶고 문항 수를 적는다', async () => {
    heads.mockResolvedValue([head('g1')]);
    render(
      <ArchiveList
        rows={[row('a', 'g1'), row('b', 'g1')]} loading={false} renderCard={card}
      />,
    );

    expect(await screen.findByText('문항 2')).toBeTruthy();
    expect(screen.getByTestId('card-a')).toBeTruthy();
    expect(screen.getByTestId('card-b')).toBeTruthy();
  });

  /** 목록 한 쪽이 60행이라 본문까지 받으면 지문 60편을 함께 받게 된다 */
  it('작품 조건이 아니면 지문 머리만 읽어 온다', async () => {
    heads.mockResolvedValue([head('g1')]);
    render(<ArchiveList rows={[row('a', 'g1')]} loading={false} renderCard={card} />);

    await waitFor(() => expect(heads).toHaveBeenCalledWith(['g1']));
    expect(bodies).not.toHaveBeenCalled();
  });

  it('작품으로 훑을 때는 본문까지 읽어 온다 — 어느 대목인지 펼쳐 봐야 한다', async () => {
    bodies.mockResolvedValue([]);
    render(
      <ArchiveList rows={[row('a', 'g1')]} loading={false} renderCard={card} workTitle="진달래꽃" />,
    );

    await waitFor(() => expect(bodies).toHaveBeenCalledWith(['g1']));
  });

  it('지문 없는 문항은 머리 없이 카드만 그린다', async () => {
    heads.mockResolvedValue([]);
    render(<ArchiveList rows={[row('a', null)]} loading={false} renderCard={card} />);

    expect(screen.getByTestId('card-a')).toBeTruthy();
    expect(screen.queryByText(/문항 1$/)).toBeNull();
    expect(screen.queryByText('지문 없는 문항')).toBeNull();
  });

  /** ⚠️ 상자가 둘이면 같은 지문 머리가 두 번 나오고 묶음째 담기가 일부만 담는 것처럼 보인다 */
  it('떨어져 있는 같은 지문도 한 상자로 모은다', async () => {
    heads.mockResolvedValue([head('g1'), head('g2')]);
    render(
      <ArchiveList
        rows={[row('a', 'g1'), row('b', 'g2'), row('c', 'g1')]} loading={false} renderCard={card}
      />,
    );

    expect(await screen.findByText('문항 2')).toBeTruthy();
    expect(screen.getAllByText(/^문항 \d+$/).map((el) => el.textContent))
      .toEqual(['문항 2', '문항 1']);
  });

  it('묶음 머리의 조작은 지문이 있는 묶음에만 붙는다', async () => {
    heads.mockResolvedValue([head('g1')]);
    const action = vi.fn((group: { passageId: string; rows: ArchiveRow[] }) => (
      <button type="button" data-passage={group.passageId}>이 지문 담기</button>
    ));
    render(
      <ArchiveList
        rows={[row('a', 'g1'), row('b', null)]} loading={false} renderCard={card}
        renderGroupAction={action}
      />,
    );

    await screen.findByRole('button', { name: '이 지문 담기' });
    // 렌더가 여러 번 돌 수 있으니 횟수가 아니라 **무엇으로 불렸는지**를 본다
    expect(action.mock.calls.length).toBeGreaterThan(0);
    for (const [group] of action.mock.calls) {
      expect(group.passageId).toBe('g1');
      expect(group.rows.map((r) => r.id)).toEqual(['a']);
    }
  });

  /** ⚠️ 못 읽은 것과 읽는 중을 가려 말해야 한다 — 매 쪽마다 실패 문구가 번쩍이던 자리다 */
  it('지문을 읽어 오는 동안에는 못 읽었다고 하지 않는다', () => {
    heads.mockReturnValue(new Promise(() => {}));
    render(<ArchiveList rows={[row('a', 'g1')]} loading={false} renderCard={card} />);

    expect(screen.getByText(/지문 불러오는 중/)).toBeTruthy();
    expect(screen.queryByText(/불러오지 못했어요/)).toBeNull();
  });

  /** ⚠️ 앞 조회의 값이 새 조회 자리에 서면 실패가 '아무 일 없음' 으로 보인다(코덱스 7R) */
  it('조회가 실패하면 앞서 받아 둔 지문을 그 자리에 세우지 않는다', async () => {
    heads.mockResolvedValue([head('g1')]);
    const { rerender } = render(
      <ArchiveList rows={[row('a', 'g1')]} loading={false} renderCard={card} />,
    );
    await screen.findByText('문항 1');

    bodies.mockRejectedValue(new Error('네트워크'));
    rerender(
      <ArchiveList rows={[row('a', 'g1')]} loading={false} renderCard={card} workTitle="진달래꽃" />,
    );

    expect(await screen.findByText(/불러오지 못했어요/)).toBeTruthy();
  });

  it('조건에 걸린 문항이 없으면 그렇게 말한다', () => {
    render(<ArchiveList rows={[]} loading={false} renderCard={card} />);

    expect(screen.getByText('조건에 맞는 문항이 없어요.')).toBeTruthy();
  });
});
