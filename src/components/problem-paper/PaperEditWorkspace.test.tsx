import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';

const push = vi.fn();
const guard = vi.fn();
const save = vi.fn();
let saveState = { saving: false, conflict: false, blocked: null as string | null };
let bodyProps: Record<string, unknown> = {};

vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
vi.mock('@/hooks/useUnsavedGuard', () => ({ useUnsavedGuard: (...a: unknown[]) => guard(...a) }));
vi.mock('@/hooks/usePaperEditSave', () => ({ usePaperEditSave: () => ({ ...saveState, save }) }));
vi.mock('@/components/problem-paper/PaperComposeBody', () => ({
  default: (props: Record<string, unknown>) => { bodyProps = props; return <div>{props.header as ReactNode}</div>; },
}));

const { default: PaperEditWorkspace } = await import('./PaperEditWorkspace');
const { DEFAULT_PAPER_SETTINGS } = await import('@/lib/problem-paper/settings');

const data = (omr = false) => ({
  paper: { id: 'p1', title: '저장된 제목', settings: { ...DEFAULT_PAPER_SETTINGS, omr }, updated_at: 'v1' },
  items: [{ id: 'i1', orderIndex: 0, problemId: 'q1', snapshot: { passage: null } }],
}) as unknown as Parameters<typeof PaperEditWorkspace>[0]['data'];
const state = { reason: null, inBook: false, pending: false, workbook: false };

beforeEach(() => {
  push.mockReset(); guard.mockReset(); save.mockReset();
  saveState = { saving: false, conflict: false, blocked: null };
});

describe('PaperEditWorkspace', () => {
  it('저장된 항목으로 캔버스를 열고, 고친 것이 없으면 떠나기 보호를 켜지 않는다', () => {
    render(<PaperEditWorkspace data={data()} state={state} withWorkbook={false} doneHref="/done" onReload={() => {}} />);
    const paper = bodyProps.paper as { items: unknown[] };
    expect(paper.items).toEqual([{ problemId: 'q1', passageId: null, itemId: 'i1' }]);
    expect(bodyProps.hidePaperId).toBe('p1');
    expect((bodyProps.edit as { dirty: boolean }).dirty).toBe(false);
    expect(guard).toHaveBeenLastCalledWith(false, expect.any(String));
  });

  it('고치면 떠나기 보호를 켜고, 저장에 성공하면 갈 곳으로 간다', async () => {
    render(<PaperEditWorkspace data={data()} state={state} withWorkbook={false} doneHref="/done" onReload={() => {}} />);
    act(() => { (bodyProps.paper as { setTitle: (t: string) => void }).setTitle('새 제목'); });
    expect((bodyProps.edit as { dirty: boolean }).dirty).toBe(true);
    expect(guard).toHaveBeenLastCalledWith(true, expect.any(String));
    save.mockResolvedValue(true);
    await act(async () => { await (bodyProps.onSave as () => Promise<void>)(); });
    expect(push).toHaveBeenCalledWith('/done');
  });

  it('OMR 문제지·책에 담김·충돌 띠를 보인다', () => {
    saveState = { saving: false, conflict: true, blocked: null };
    const onReload = vi.fn();
    render(
      <PaperEditWorkspace data={data(true)} state={{ ...state, inBook: true }} withWorkbook doneHref="/done" onReload={onReload} />,
    );
    expect(screen.getByText(/OMR 채점 문제지예요/)).toBeTruthy();
    expect(screen.getByText(/원장님 책에 담긴 문제지예요/)).toBeTruthy();
    act(() => { screen.getByRole('button', { name: '저장된 것 불러오기' }).click(); });
    expect(onReload).toHaveBeenCalled();
  });

  it('저장하는 동안에도 떠나기 보호를 켜 둔다(새로 고침·사이드바로 저장이 끊기지 않게)', () => {
    saveState = { saving: true, conflict: false, blocked: null };
    render(<PaperEditWorkspace data={data()} state={state} withWorkbook={false} doneHref="/done" onReload={() => {}} />);
    act(() => { (bodyProps.paper as { setTitle: (t: string) => void }).setTitle('새 제목'); });
    expect(guard).toHaveBeenLastCalledWith(true, expect.any(String));
  });
});

