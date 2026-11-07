import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { ReferenceText } from '@/types/reference-text';
import ReferenceTextView from './ReferenceTextView';

vi.mock('./ReferenceBodyView', () => ({ default: () => <div>본문</div> }));

const row: ReferenceText = {
  id: 'r1', title: '효과적으로 듣고 말하기 — 핵심 개념', author: '', body: '<p>본문</p>', kind: '개념', format: 'html',
  seq: 10, tags: ['핵심 정리'], source_key: null, part_of: null, char_count: 2, units: [], grammar_paths: [], note: '',
  user_id: 'u', updated_by: null, created_at: '2026-11-07T00:00:00Z', updated_at: '2026-11-07T00:00:00Z',
};

describe('ReferenceTextView — 묶음의 부분', () => {
  it('부분이면 묶음으로 가는 길을 준다', () => {
    render(<ReferenceTextView row={{ ...row, part_of: 'b1' }} backHref="/reference-texts" />);
    const link = screen.getByRole('link', { name: '묶음 보기' });
    expect(link.getAttribute('href')).toBe('/reference-texts/b1');
  });

  it('부분이 아니면 안내가 없다', () => {
    render(<ReferenceTextView row={row} backHref="/reference-texts" />);
    expect(screen.queryByRole('link', { name: '묶음 보기' })).toBeNull();
  });
});
