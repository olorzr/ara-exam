import { describe, it, expect } from 'vitest';
import { UNSPECIFIED_OPTION } from '@/lib/external-category';
import {
  assignPage, assignPages, assignedPages, bundleColor, BUNDLE_COLORS,
  newBundleDraft, pagesOfBundle, unassignBundle, type BundleDraft, type PageAssignment,
} from './bundles';

const draft = (over: Partial<BundleDraft> = {}): BundleDraft => ({
  localId: 'b1', name: '문학 프린트', schoolId: 's1', schoolName: '상현중',
  year: '2026', grade: '중2', includeHandwriting: false, registerWords: false, ...over,
});

describe('newBundleDraft', () => {
  it('앞 묶음의 학교·년도·학년을 물려받는다 — 같은 값을 대여섯 번 고르게 하지 않는다', () => {
    const next = newBundleDraft('b2', draft(), '2025');
    expect(next.schoolId).toBe('s1');
    expect(next.schoolName).toBe('상현중');
    expect(next.year).toBe('2026');
    expect(next.grade).toBe('중2');
  });

  it('프린트명·손글씨·단어 등록은 물려받지 않는다 — 프린트마다 다르고 돈이 드는 쪽이다', () => {
    const next = newBundleDraft(
      'b2', draft({ includeHandwriting: true, registerWords: true }), '2025',
    );
    expect(next.name).toBe('');
    expect(next.includeHandwriting).toBe(false);
    expect(next.registerWords).toBe(false);
  });

  it('앞 묶음이 없으면 올해와 미지정으로 시작한다', () => {
    const first = newBundleDraft('b1', null, '2026');
    expect(first.year).toBe('2026');
    expect(first.grade).toBe(UNSPECIFIED_OPTION);
    expect(first.schoolName).toBe('');
  });
});

describe('쪽 배정', () => {
  const base: PageAssignment = new Map([[1, 'b1'], [2, 'b1'], [3, 'b2']]);

  it('쪽을 넣고 뺀다 — 뺀 쪽은 건너뛰는 쪽이 된다(기본이 안 읽음)', () => {
    expect(assignPage(base, 4, 'b2').get(4)).toBe('b2');
    expect(assignPage(base, 1, null).has(1)).toBe(false);
  });

  it('원본 Map 을 건드리지 않는다', () => {
    assignPage(base, 9, 'b1');
    expect(base.has(9)).toBe(false);
  });

  it('여러 쪽을 한 번에 넣거나 뺀다', () => {
    const next = assignPages(base, [5, 6], 'b2');
    expect(pagesOfBundle(next, 'b2')).toEqual([3, 5, 6]);
    expect(assignPages(base, [1, 2], null).size).toBe(1);
  });

  it('묶음을 지우면 그 쪽 배정이 전부 풀린다', () => {
    const next = unassignBundle(base, 'b1');
    expect(pagesOfBundle(next, 'b1')).toEqual([]);
    expect(pagesOfBundle(next, 'b2')).toEqual([3]);
  });

  it('쪽 목록은 늘 오름차순이다 — 이 순서가 읽는 순서이자 시험지 순서다', () => {
    const shuffled: PageAssignment = new Map([[7, 'b1'], [2, 'b1'], [5, 'b1']]);
    expect(pagesOfBundle(shuffled, 'b1')).toEqual([2, 5, 7]);
    expect(assignedPages(shuffled)).toEqual([2, 5, 7]);
  });
});

describe('bundleColor', () => {
  it('묶음이 색 수를 넘으면 색이 돈다 — 번호가 본체이고 색은 보조다', () => {
    expect(bundleColor(0)).toBe(BUNDLE_COLORS[0]);
    expect(bundleColor(BUNDLE_COLORS.length)).toBe(BUNDLE_COLORS[0]);
  });
});
