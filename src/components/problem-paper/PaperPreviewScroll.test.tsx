import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import PaperPreviewScroll from './PaperPreviewScroll';

const stubMatchMedia = (matches: boolean) => vi.stubGlobal('matchMedia', (query: string) => ({
  matches, media: query, addEventListener: () => undefined, removeEventListener: () => undefined,
}));

afterEach(() => vi.unstubAllGlobals());

describe('PaperPreviewScroll — 문제지 미리보기 가로 스크롤 상자 (2026-11-22)', () => {
  it('터치 화면이면 키보드로도 넘기게 이름 있는 구역으로 초점을 받는다(코덱스 14R)', () => {
    stubMatchMedia(true);
    render(<PaperPreviewScroll><p>문서</p></PaperPreviewScroll>);
    const region = screen.getByRole('region', { name: '문제지 미리보기' });
    expect(region.getAttribute('tabindex')).toBe('0');
    expect(region.className).toContain('a4-scroll-x');
  });

  it('마우스 화면이면 상자가 넘김을 가두지 않으니 초점 자리도 두지 않는다(코덱스 16R)', () => {
    stubMatchMedia(false);
    const { container } = render(<PaperPreviewScroll><p>문서</p></PaperPreviewScroll>);
    expect(screen.queryByRole('region')).toBeNull();
    expect(container.querySelector('.a4-scroll-x')?.hasAttribute('tabindex')).toBe(false);
  });

  it('matchMedia 가 없는 환경에서도 그린다', () => {
    vi.stubGlobal('matchMedia', undefined);
    render(<PaperPreviewScroll><p>문서</p></PaperPreviewScroll>);
    expect(screen.getByText('문서')).toBeTruthy();
  });
});
