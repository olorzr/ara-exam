import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { ConceptSheetListItem } from '@/types';
import ConceptSheetCard from './ConceptSheetCard';

const sheet = {
  id: 's1', title: '동백꽃 핵심 개념', level: '외부지문 및 프린트', grade: '중2', publisher: '비상(박영민)', semester: '2학기',
  unit: '2. 문학의 갈래', subunit: '(1) 동백꽃', marks: [{}, {}, {}], updated_at: '2026-11-12T03:00:00Z',
} as unknown as ConceptSheetListItem;

describe('ConceptSheetCard', () => {
  it('제목이 편집 화면 링크이고, 지우기 단추는 링크 밖에 있다(링크 안 단추는 잘못된 HTML)', () => {
    const onDelete = vi.fn();
    render(<ConceptSheetCard sheet={sheet} onDelete={onDelete} />);
    const link = screen.getByRole('link');
    expect(link.getAttribute('href')).toBe('/exam/builder/s1');
    // 제목은 h3 그대로 — 제목 탐색에서 꼭지마다 잡힌다(코덱스 2R)
    expect(screen.getByRole('heading', { level: 3 }).contains(link)).toBe(true);
    expect(link.textContent).toContain('동백꽃 핵심 개념');
    const del = screen.getByRole('button', { name: '동백꽃 핵심 개념 삭제' });
    expect(link.contains(del)).toBe(false);
    fireEvent.click(del);
    expect(onDelete).toHaveBeenCalledWith('s1', '동백꽃 핵심 개념');
  });

  it('지우기 단추는 늘 보인다(마우스를 올려야 보이면 태블릿에서 못 지운다), 마킹 수를 꼬리표로', () => {
    render(<ConceptSheetCard sheet={sheet} onDelete={vi.fn()} />);
    expect(screen.getByRole('button').className).not.toContain('opacity-0');
    expect(screen.getByText('마킹 3개')).toBeTruthy();
    expect(screen.getByText('외부지문 및 프린트')).toBeTruthy();
  });
});
