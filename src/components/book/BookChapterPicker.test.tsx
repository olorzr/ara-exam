import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/lib/book', () => ({
  fetchPapersForPicker: async () => [],
  PAPER_PICKER_LIMIT: 50,
}));

const { default: BookChapterPicker } = await import('./BookChapterPicker');

describe('BookChapterPicker', () => {
  it('새 장은 책 만들기의 문제지 만들기로 보낸다 — 평가문제집은 거기서만 보인다', async () => {
    render(<BookChapterPicker open onClose={() => undefined} addedPaperIds={new Set()} busy={false} onPick={() => undefined} />);
    const link = await screen.findByRole('link', { name: '문제지 만들기' });
    expect(link.getAttribute('href')).toBe('/books/papers/new');
  });
});
