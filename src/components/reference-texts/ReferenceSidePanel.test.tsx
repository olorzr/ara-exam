import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { buildReferenceGrammarTree } from '@/lib/reference-texts/browse-trees';
import type { ReferenceFacetRow } from '@/lib/reference-texts/facets';
import { ALL_REFERENCE_TEXTS, type ReferenceBrowseAxis } from '@/lib/reference-texts/filters';
import { buildReferenceUnitTree } from '@/lib/reference-texts/unit-browse-tree';
import type { ReferenceUnit } from '@/types/reference-text';
import ReferenceSidePanel from './ReferenceSidePanel';

const unit: ReferenceUnit = {
  grade: '중2', textbook: '천재(노미숙)', semester: '1학기', unit_path: ['1. 문학'],
};
const ROWS: ReferenceFacetRow[] = [
  { id: 'a', title: '봄봄', author: '김유정', units: [unit], grammar_paths: [] },
  { id: 'b', title: '봄봄', author: '김유정', units: [], grammar_paths: ['담화'] },
];

function renderPanel(axis: ReferenceBrowseAxis = ALL_REFERENCE_TEXTS) {
  const onChange = vi.fn<(axis: ReferenceBrowseAxis) => void>();
  render(
    <ReferenceSidePanel
      axis={axis}
      rows={ROWS}
      unitTree={buildReferenceUnitTree(ROWS)}
      grammarTree={buildReferenceGrammarTree(ROWS)}
      onChange={onChange}
    />,
  );
  return onChange;
}

/** 접혀 있으면 펼치고, 잎이면 누른다 */
function open(label: string) {
  const node = screen.getByText(label).closest('[role="button"]')!;
  if (node.getAttribute('aria-expanded') !== 'true') fireEvent.click(node);
}

describe('ReferenceSidePanel', () => {
  it('교과서 탭에서 단원 잎을 누르면 그 단원 축을 건다', () => {
    const onChange = renderPanel();
    for (const label of ['중2 (1)', '천재(노미숙) (1)', '1학기 (1)', '1. 문학 (1)']) open(label);
    expect(onChange).toHaveBeenCalledWith({ kind: 'unit', unit });
  });

  it('단원 없는 전문은 "분류 없음" 으로 찾는다', () => {
    const onChange = renderPanel();
    open('분류 없음 (1)');
    expect(onChange).toHaveBeenCalledWith({ kind: 'unit-none' });
  });

  it('걸린 축의 탭을 열고 그 잎을 강조한다 — 같은 작품의 판본 둘은 한 잎에 (2)', () => {
    renderPanel({ kind: 'work', title: '봄봄' });
    const leaf = screen.getByText('봄봄 (2)').closest('[role="button"]')!;
    expect(leaf.className).toContain('bg-primary/10');
  });

  it('축이 걸린 탭에서는 해제로 풀 수 있다', () => {
    const onChange = renderPanel({ kind: 'unit-none' });
    fireEvent.click(screen.getByText('해제'));
    expect(onChange).toHaveBeenCalledWith(ALL_REFERENCE_TEXTS);
  });

  it('축이 없으면 해제가 없다', () => {
    renderPanel();
    expect(screen.queryByText('해제')).toBeNull();
  });
});
