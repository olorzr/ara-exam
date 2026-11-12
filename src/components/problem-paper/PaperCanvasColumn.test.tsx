import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { createRef } from 'react';
import PaperCanvasColumn from './PaperCanvasColumn';
import { DEFAULT_PAPER_SETTINGS } from '@/lib/problem-paper/settings';
import type { PaperComposer } from '@/hooks/usePaperComposer';

/** '최신 지문으로' 는 고치기 화면의, 원본이 살아 있는 저장 항목만으로 된 지문 묶음에만 나온다 */
function draw(over: Partial<PaperComposer>, edit = true) {
  const refreshGroup = vi.fn();
  const paper = {
    title: '문제지', settings: DEFAULT_PAPER_SETTINGS, omrPlan: null, rows: new Map(), added: new Set(),
    setTitle: vi.fn(), setSettings: vi.fn(), shuffle: vi.fn(), clear: vi.fn(), remove: vi.fn(), move: vi.fn(),
    moveWholeGroup: vi.fn(), refreshGroup, items: [], stored: new Map(), ...over,
  } as unknown as PaperComposer;
  render(
    <PaperCanvasColumn
      paper={paper} drag={{ handlers: {}, dragging: false } as never} canvasRef={createRef()} preview={null}
      displayFor={() => undefined} saving={false} edit={edit ? { dirty: false, onReset: vi.fn() } : undefined}
      onStartMove={vi.fn()} onSave={vi.fn()}
    />,
  );
  return refreshGroup;
}

const stored = (id: string, problemId: string | null) => [id, { id, orderIndex: 0, problemId, snapshot: {} as never }] as const;

describe('PaperCanvasColumn — 최신 지문으로', () => {
  it('저장 항목만으로 된 지문 묶음이면 그 묶음 범위로 바꾼다', () => {
    const refresh = draw({
      items: [
        { problemId: 'a', passageId: 'P', itemId: 'i1' }, { problemId: 'b', passageId: 'P', itemId: 'i2' },
        { problemId: 'c', passageId: null, itemId: 'i3' },
      ],
      stored: new Map([stored('i1', 'a'), stored('i2', 'b'), stored('i3', 'c')]),
    });
    const buttons = screen.getAllByRole('button', { name: '최신 지문으로' });
    expect(buttons).toHaveLength(1); // 지문 없는 문항에는 없다
    fireEvent.click(buttons[0]);
    expect(refresh).toHaveBeenCalledWith(0, 1);
  });

  it('원본이 지워진 항목이나 새로 담은 문항이 섞인 묶음에는 내지 않는다', () => {
    draw({
      items: [
        { problemId: 'a', passageId: 'P', itemId: 'i1' }, { problemId: 'item:i2', passageId: 'P', itemId: 'i2' },
        { problemId: 'c', passageId: 'Q', itemId: 'i3' }, { problemId: 'd', passageId: 'Q' },
      ],
      stored: new Map([stored('i1', 'a'), stored('i2', null), stored('i3', 'c')]),
    });
    expect(screen.queryByRole('button', { name: '최신 지문으로' })).toBeNull();
  });

  it('만들기 화면에서는 내지 않는다', () => {
    draw({ items: [{ problemId: 'a', passageId: 'P' }] }, false);
    expect(screen.queryByRole('button', { name: '최신 지문으로' })).toBeNull();
  });
});
