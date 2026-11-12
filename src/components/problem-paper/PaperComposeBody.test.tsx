import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

/**
 * 조합 몸통의 저장 잠금(코덱스 P2) — 담는 중에는 저장하지 않고, 저장하는 동안은 화면 전체를 잠근다.
 * 저장한 뒤에는 화면을 떠나므로, 그 사이 고친 것·늦게 들어온 담기는 저장되지 않은 채 사라진다.
 */

let bulkBusy = false;
let canvasProps: Record<string, unknown> = {};

vi.mock('@/hooks/useProblemArchive', () => ({
  useProblemArchive: () => ({ filters: { exclude_papers: [], answered_only: true }, facets: {}, rows: [], total: 0, failed: null, loading: false }),
}));
vi.mock('@/hooks/usePaperBulkAdd', () => ({ usePaperBulkAdd: () => ({ selection: {}, bulkBusy, patch: vi.fn() }) }));
vi.mock('@/hooks/usePaperTypeMix', () => ({ usePaperTypeMix: () => ({ busy: false }) }));
vi.mock('@/hooks/useListDrag', () => ({ useListDrag: () => ({ handlers: {}, dragging: false }) }));
vi.mock('@/hooks/useSignedImageUrls', () => ({ useSignedImageUrls: () => ({ urls: new Map() }) }));
vi.mock('@/components/problem-paper/PaperCanvasColumn', () => ({
  default: (props: Record<string, unknown>) => { canvasProps = props; return null; },
}));
for (const path of [
  '@/components/problem-bank/ArchiveSidePanel', '@/components/problem-bank/ProblemDetailDialog',
  '@/components/problem-paper/PaperArchiveColumn', '@/components/problem-paper/TypeMixDialog',
]) vi.doMock(path, () => ({ default: () => null }));

const { default: PaperComposeBody } = await import('./PaperComposeBody');
const basePaper = { items: [], added: new Set(), rows: new Map(), stored: new Map(), settings: {}, refreshing: false };
let paper = basePaper as never;

beforeEach(() => { bulkBusy = false; canvasProps = {}; paper = basePaper as never; });

function draw(saving: boolean, onSave = vi.fn()) {
  render(<PaperComposeBody withWorkbook={false} paper={paper} header={<h1>머리</h1>} saving={saving} onSave={onSave} />);
  return onSave;
}

describe('PaperComposeBody 저장 잠금', () => {
  it('저장하는 동안 화면 전체를 잠근다(inert)', () => {
    draw(true);
    const root = screen.getByRole('heading', { name: '머리' }).parentElement as HTMLElement;
    expect(root.hasAttribute('inert')).toBe(true);
    expect(root.getAttribute('aria-busy')).toBe('true');
  });

  it('저장 중이 아니면 잠그지 않는다', () => {
    draw(false);
    const root = screen.getByRole('heading', { name: '머리' }).parentElement as HTMLElement;
    expect(root.hasAttribute('inert')).toBe(false);
  });

  it('담는 중이면 저장 단추를 잠그고, 눌려도 저장하지 않는다', () => {
    bulkBusy = true;
    const onSave = draw(false);
    expect(canvasProps.saveBlocked).toBe(true);
    (canvasProps.onSave as () => void)();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('담는 중이 아니면 저장한다', () => {
    const onSave = draw(false);
    (canvasProps.onSave as () => void)();
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it('\'최신 지문으로\' 가 지금 지문을 읽는 중이어도 저장을 잠근다', () => {
    paper = { ...basePaper, refreshing: true } as never;
    const onSave = draw(false);
    expect(canvasProps.saveBlocked).toBe(true);
    (canvasProps.onSave as () => void)();
    expect(onSave).not.toHaveBeenCalled();
  });
});

