import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { ReferenceTextListItem } from '@/types/reference-text';
import ReferenceTextList from './ReferenceTextList';

const row: ReferenceTextListItem = {
  id: 'r1', title: '저녁 항구', author: '함기석', kind: '작품', format: 'html', seq: 30, tags: ['제재'],
  source_key: null, part_of: null, attached_to: null, char_count: 120, units: [], grammar_paths: [], note: '', user_id: 'u',
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

  it('긴 단원·태그는 잘리지 않고 줄을 바꿔 다 보인다 — 말줄임 + title 은 터치에서 전체를 못 본다(코덱스 1·2R)', () => {
    const long = '1. 문학의 즐거움과 삶의 성찰을 함께 읽기 — 아주 긴 대단원 이름';
    render(<ReferenceTextList
      busyId={null}
      rows={[{ ...row, tags: ['가'.repeat(30)], units: [{ grade: '중2', textbook: '비상(박영민)', semester: '2학기', unit_path: [long, '(1) 소단원'] }] }]}
    />);
    const unit = screen.getByText((text) => text.includes(long));
    const tag = screen.getByText(`#${'가'.repeat(30)}`);
    for (const el of [unit, tag]) {
      expect(el.className).toContain('whitespace-normal');
      expect(el.className).not.toContain('truncate');
      expect(el.parentElement!.className).toContain('max-w-full');
    }
  });

  it('판본 메모도 띄어쓰기 없는 긴 글이면 칸 안에서 줄을 바꾼다(코덱스 3R)', () => {
    const note = 'A'.repeat(200);
    render(<ReferenceTextList busyId={null} rows={[{ ...row, note }]} />);
    const el = screen.getByText(note);
    expect(el.className).toContain('min-w-0');
    expect(el.className).toContain('[overflow-wrap:anywhere]');
  });
});
