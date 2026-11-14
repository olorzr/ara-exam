import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import FacetTree from '@/components/problem-bank/FacetTree';
import type { FacetTreeNode } from '@/lib/problem-bank/school-exam-tree';
import { SIDE_PAPER_CLASS, TreeFrame, TreeRow } from '.';

/**
 * 트리 모양 — 기출 공유 사이트 문제 찾기 트리와 같은 결(2026-11-14 원장님 "문제은행 구독 시스템의 tree 가 디자인도
 * 예뻐 이것처럼 우리도 해줘"). 폴더·문서 그림 없이 작은 화살표 · 이름 · 오른쪽 숫자, 고른 줄은 연한 민트.
 */

const leaf = (id: string, label: string, count?: number): FacetTreeNode<string> =>
  ({ id, label, children: [], value: id, ...(count === undefined ? {} : { count }) });
const folder = (id: string, label: string, children: FacetTreeNode<string>[]): FacetTreeNode<string> =>
  ({ id, label, children });

describe('TreeRow', () => {
  it('건수는 오른쪽 칸에 숫자로 따로 찍고, 줄 이름은 "이름 (n)" 이다', () => {
    render(<TreeRow depth={0} label="동백꽃" count={1234} onActivate={() => undefined} />);
    const row = screen.getByRole('button', { name: '동백꽃 (1234)' });
    const spans = [...row.querySelectorAll('span')].map((s) => s.textContent);
    expect(spans).toContain('동백꽃');
    expect(spans).toContain('1,234');
    expect(row.textContent).not.toContain('(');
  });

  it('0건은 흐리지만 숫자 0 이 남는다 — 색만으로 알리지 않는다', () => {
    render(<TreeRow depth={0} label="대명사" count={0} dimmed onActivate={() => undefined} />);
    const row = screen.getByRole('button', { name: '대명사 (0)' });
    expect(row.textContent).toContain('0');
    expect(screen.getByText('대명사').className).toContain('text-gray-400');
  });

  it('폴더·문서 그림이 없다 — 가지만 작은 화살표, 펼치면 돈다', () => {
    const { container, rerender } = render(<TreeRow depth={1} label="중등" expanded={false} onActivate={() => undefined} />);
    expect(container.querySelectorAll('svg')).toHaveLength(1);
    expect(container.querySelector('svg')?.getAttribute('class')).not.toContain('rotate-90');
    rerender(<TreeRow depth={1} label="중등" expanded onActivate={() => undefined} />);
    expect(container.querySelector('svg')?.getAttribute('class')).toContain('rotate-90');
    rerender(<TreeRow depth={1} label="1학기" onActivate={() => undefined} />);
    expect(container.querySelectorAll('svg')).toHaveLength(0);
  });

  it('긴 이름은 말줄임 없이 줄을 바꾼다(휴대폰에서는 title 을 열 길이 없다)', () => {
    render(<TreeRow depth={0} label="아주긴학교이름고등학교부설방송통신고등학교" onActivate={() => undefined} />);
    const name = screen.getByText('아주긴학교이름고등학교부설방송통신고등학교');
    expect(name.className).toContain('[overflow-wrap:anywhere]');
    expect(name.className).not.toContain('truncate');
  });

  it('고른 줄은 연한 민트 + 굵게, 표시도 단다', () => {
    render(<TreeRow depth={0} label="무학중" selected onActivate={() => undefined} />);
    const row = screen.getByRole('button', { name: '무학중' });
    expect(row.getAttribute('data-selected')).toBe('true');
    expect(row.className).toContain('bg-accent-soft');
    expect(row.className).toContain('font-bold');
  });

  it('Enter·Space 로도 누른다', () => {
    const onActivate = vi.fn();
    render(<TreeRow depth={0} label="무학중" onActivate={onActivate} />);
    const row = screen.getByRole('button', { name: '무학중' });
    fireEvent.keyDown(row, { key: 'Enter' });
    fireEvent.keyDown(row, { key: ' ' });
    fireEvent.keyDown(row, { key: 'a' });
    expect(onActivate).toHaveBeenCalledTimes(2);
  });
});

describe('TreeFrame · 종이', () => {
  it('테두리 상자 없이 머리글을 늘 두고, 축이 걸렸을 때만 해제', () => {
    const onClear = vi.fn();
    const { container, rerender } = render(<TreeFrame title="기출" active={false} onClear={onClear}><p>트리</p></TreeFrame>);
    expect(screen.getByRole('region', { name: '기출' })).toBeTruthy();
    expect(screen.queryByText('해제')).toBeNull();
    expect(container.innerHTML).not.toContain('rounded-lg border');
    rerender(<TreeFrame title="기출" active onClear={onClear}><p>트리</p></TreeFrame>);
    fireEvent.click(screen.getByText('해제'));
    expect(onClear).toHaveBeenCalled();
  });

  it('왼쪽 패널 종이는 위 잉크 줄 + 흰 바탕', () => {
    expect(SIDE_PAPER_CLASS).toContain('border-t-2');
    expect(SIDE_PAPER_CLASS).toContain('border-ink');
    expect(SIDE_PAPER_CLASS).toContain('bg-card');
  });
});

describe('FacetTree 찾기 · 펼침', () => {
  const TREE = [
    folder('high', '고등', [
      folder('mh', '무학여고', [leaf('mh-1', '1학기 중간고사')]),
      folder('ss', '성수고', [leaf('ss-1', '1학기 기말고사')]),
    ]),
  ];

  it('찾기 칸에 치면 맞는 가지만 남기고 다 펼친다, 지우면 처음 모양', () => {
    render(<FacetTree nodes={TREE} onSelect={() => undefined} defaultExpandedDepth={1} searchPlaceholder="학교 이름 찾기" />);
    expect(screen.queryByText('1학기 중간고사')).toBeNull();
    fireEvent.change(screen.getByRole('searchbox', { name: '학교 이름 찾기' }), { target: { value: '무학' } });
    expect(screen.getByText('1학기 중간고사')).toBeTruthy();
    expect(screen.queryByText('성수고')).toBeNull();
    fireEvent.change(screen.getByRole('searchbox', { name: '학교 이름 찾기' }), { target: { value: '' } });
    expect(screen.getByText('성수고')).toBeTruthy();
    expect(screen.queryByText('1학기 중간고사')).toBeNull();
  });

  it('맞는 것이 없으면 그렇게 알린다', () => {
    render(<FacetTree nodes={TREE} onSelect={() => undefined} searchPlaceholder="학교 이름 찾기" emptyText="비었어요" />);
    fireEvent.change(screen.getByRole('searchbox', { name: '학교 이름 찾기' }), { target: { value: '없는학교' } });
    expect(screen.getByText('찾는 이름이 없어요.')).toBeTruthy();
    expect(screen.queryByText('비었어요')).toBeNull();
  });

  it('손으로 편 가지는 찾기를 다녀와도 그대로다', () => {
    render(<FacetTree nodes={TREE} onSelect={() => undefined} defaultExpandedDepth={1} searchPlaceholder="학교 이름 찾기" />);
    fireEvent.click(screen.getByRole('button', { name: '성수고' }));
    expect(screen.getByText('1학기 기말고사')).toBeTruthy();
    const box = screen.getByRole('searchbox', { name: '학교 이름 찾기' });
    fireEvent.change(box, { target: { value: '무학' } });
    fireEvent.change(box, { target: { value: '' } });
    expect(screen.getByText('1학기 기말고사')).toBeTruthy();
    expect(screen.queryByText('1학기 중간고사')).toBeNull();
  });

  it('찾는 동안 접고 편 것은 찾기에만 남는다 — 지우면 처음 모양(코덱스 1R)', () => {
    render(<FacetTree nodes={TREE} onSelect={() => undefined} defaultExpandedDepth={0} searchPlaceholder="학교 이름 찾기" />);
    const box = screen.getByRole('searchbox', { name: '학교 이름 찾기' });
    expect(screen.getByRole('button', { name: '고등' }).getAttribute('aria-expanded')).toBe('false');
    fireEvent.change(box, { target: { value: '무학' } });
    // 찾는 중에도 가지를 접을 수 있다(죽은 단추가 아니다)
    fireEvent.click(screen.getByRole('button', { name: '고등' }));
    expect(screen.getByRole('button', { name: '고등' }).getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByText('무학여고')).toBeNull();
    // 찾는 말이 바뀌면 다시 다 펼친다
    fireEvent.change(box, { target: { value: '무학여' } });
    expect(screen.getByText('무학여고')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '고등' }));
    fireEvent.click(screen.getByRole('button', { name: '고등' }));
    fireEvent.change(box, { target: { value: '' } });
    // 원래 접혀 있던 가지는 접힌 채다
    expect(screen.getByRole('button', { name: '고등' }).getAttribute('aria-expanded')).toBe('false');
  });

  it('늦게 온 노드도 기본 깊이만큼 펼쳐진다 — 처음엔 비어 있다가 패싯이 와도', () => {
    const { rerender } = render(<FacetTree nodes={[]} onSelect={() => undefined} defaultExpandedDepth={1} emptyText="비었어요" />);
    expect(screen.getByText('비었어요')).toBeTruthy();
    rerender(<FacetTree nodes={TREE} onSelect={() => undefined} defaultExpandedDepth={1} emptyText="비었어요" />);
    expect(screen.getByRole('button', { name: '고등' }).getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('button', { name: '무학여고' }).getAttribute('aria-expanded')).toBe('false');
  });

  it('비어 있으면 찾기 칸을 내지 않는다', () => {
    render(<FacetTree nodes={[]} onSelect={() => undefined} searchPlaceholder="학교 이름 찾기" />);
    expect(screen.queryByRole('searchbox')).toBeNull();
  });

  it('잎을 누르면 값을 넘기고 그 잎을 강조한다', () => {
    const onSelect = vi.fn();
    const { rerender } = render(<FacetTree nodes={TREE} onSelect={onSelect} defaultExpandedDepth={9} />);
    fireEvent.click(screen.getByRole('button', { name: '1학기 기말고사' }));
    expect(onSelect).toHaveBeenCalledWith('ss-1');
    rerender(<FacetTree nodes={TREE} onSelect={onSelect} defaultExpandedDepth={9} selectedId="ss-1" />);
    expect(screen.getByRole('button', { name: '1학기 기말고사' }).getAttribute('data-selected')).toBe('true');
  });
});
