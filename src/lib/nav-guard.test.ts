import { describe, it, expect } from 'vitest';
import { leavesCurrentPage } from './nav-guard';

const HERE = 'https://test.araeducation.co.kr/problems/quiz';
const link = (over: Partial<Parameters<typeof leavesCurrentPage>[0]> = {}) => ({
  href: 'https://test.araeducation.co.kr/problems/archive', target: '', download: false, ...over,
});
const plain = { metaKey: false, ctrlKey: false, shiftKey: false, altKey: false };

describe('leavesCurrentPage', () => {
  it('같은 사이트의 다른 화면으로 가면 떠나는 것이다', () => {
    expect(leavesCurrentPage(link(), plain, HERE)).toBe(true);
  });

  it('같은 쪽 앵커는 떠나는 것이 아니다', () => {
    expect(leavesCurrentPage(link({ href: `${HERE}#top` }), plain, HERE)).toBe(false);
    expect(leavesCurrentPage(link({ href: HERE }), plain, HERE)).toBe(false);
  });

  it('새 탭·새 창으로 여는 누름은 지금 화면을 두고 간다', () => {
    expect(leavesCurrentPage(link({ target: '_blank' }), plain, HERE)).toBe(false);
    expect(leavesCurrentPage(link(), { ...plain, metaKey: true }, HERE)).toBe(false);
    expect(leavesCurrentPage(link(), { ...plain, ctrlKey: true }, HERE)).toBe(false);
  });

  it('내려받기 링크는 화면을 바꾸지 않는다', () => {
    expect(leavesCurrentPage(link({ download: true }), plain, HERE)).toBe(false);
  });

  it('바깥 사이트는 beforeunload 가 맡는다 — 여기서 두 번 묻지 않는다', () => {
    expect(leavesCurrentPage(link({ href: 'https://www.google.com' }), plain, HERE)).toBe(false);
  });

  it('주소로 읽을 수 없는 값은 막지 않는다', () => {
    expect(leavesCurrentPage(link({ href: 'javascript:void(0)' }), plain, HERE)).toBe(false);
  });

  it('같은 경로라도 검색값이 다르면 다른 화면이다', () => {
    expect(leavesCurrentPage(link({ href: `${HERE}?mode=key` }), plain, HERE)).toBe(true);
  });
});
