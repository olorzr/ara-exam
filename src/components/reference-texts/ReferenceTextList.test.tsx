import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { ReferenceTextListItem } from '@/types/reference-text';
import ReferenceTextList from './ReferenceTextList';

const row: ReferenceTextListItem = {
  id: 'r1', title: '저녁 항구', author: '함기석', kind: '작품', format: 'html', seq: 30, tags: ['제재'],
  source_key: null, char_count: 120, units: [], grammar_paths: [], note: '', user_id: 'u',
  updated_by: null, created_at: '2026-10-28T00:00:00Z', updated_at: '2026-10-28T00:00:00Z',
};

describe('ReferenceTextList', () => {
  it('원장(onDelete 있음)에게만 지우기 단추가 있다', () => {
    const onDelete = vi.fn();
    render(<ReferenceTextList rows={[row]} busyId={null} onDelete={onDelete} />);
    fireEvent.click(screen.getByRole('button', { name: '저녁 항구 지우기' }));
    expect(onDelete).toHaveBeenCalledWith(row);
  });

  it('선생님(onDelete 없음)에게는 단추 자체가 없다 — 눌리는데 조용한 단추를 두지 않는다', () => {
    render(<ReferenceTextList rows={[row]} busyId={null} />);
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByRole('link').getAttribute('href')).toBe('/reference-texts/r1');
  });
});
