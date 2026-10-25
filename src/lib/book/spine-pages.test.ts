import { describe, expect, it } from 'vitest';
import { bookLayoutKeyFor } from './layout';
import { DEFAULT_BOOK_SETTINGS } from './settings';
import { spineWidthMm } from './spine';
import { resolveSpinePages, spineMmOf, storedSpinePages } from './spine-pages';
import { innerPaperOf } from './inner-papers';
import type { Book, BookChapter } from './types';

const base: Book = {
  id: 'b', title: '책', kind: 'book', finishedAt: null, settings: DEFAULT_BOOK_SETTINGS, pageCounts: {}, cover: null,
  userId: 'u', createdAt: '', updatedAt: '',
};
const chapters: BookChapter[] = [{ id: 'c', bookId: 'b', paperId: 'p', orderIndex: 0, titleOverride: '1장', paper: null }];

describe('resolveSpinePages — 표지만', () => {
  const cover: Book = { ...base, kind: 'cover', settings: { ...base.settings, manualPages: { student: 98, key: 120 } } };

  it('직접 넣은 쪽 수를 4의 배수로 올린다', () => {
    expect(resolveSpinePages(cover, [], 'student')).toEqual({ pages: 100, source: 'manual' });
    expect(resolveSpinePages(cover, [], 'key')).toEqual({ pages: 120, source: 'manual' });
  });

  it('안 넣은 판은 못 그린다 — 잰 쪽 수가 남아 있어도 쓰지 않는다', () => {
    const stale = { ...cover, pageCounts: { teacher: { pages: 40, key: 'x' } } };
    expect(resolveSpinePages(stale, [], 'teacher')).toBeNull();
  });
});

describe('resolveSpinePages — 책', () => {
  it('지금 구성에서 잰 쪽 수만 쓴다', () => {
    const key = bookLayoutKeyFor(base, chapters, 'student');
    const fresh = { ...base, pageCounts: { student: { pages: 80, key } } };
    expect(resolveSpinePages(fresh, chapters, 'student')).toEqual({ pages: 80, source: 'measured' });
    // 장이 바뀌었으면(지문이 다르면) 쓰지 않는다
    expect(resolveSpinePages(fresh, [], 'student')).toBeNull();
    // 잰 적이 없으면 못 그린다
    expect(resolveSpinePages(base, chapters, 'student')).toBeNull();
  });

  it('직접 넣은 쪽 수는 책에서 쓰지 않는다', () => {
    const typed = { ...base, settings: { ...base.settings, manualPages: { student: 100 } } };
    expect(resolveSpinePages(typed, chapters, 'student')).toBeNull();
  });
});

describe('storedSpinePages · spineMmOf', () => {
  it('목록용은 지문을 보지 않고 저장된 값을 그대로', () => {
    const stale = { ...base, pageCounts: { student: { pages: 80, key: 'old' } } };
    expect(storedSpinePages(stale, 'student')).toEqual({ pages: 80, source: 'measured' });
    expect(storedSpinePages(base, 'student')).toBeNull();
    const cover: Book = { ...base, kind: 'cover', settings: { ...base.settings, manualPages: { teacher: 41 } } };
    expect(storedSpinePages(cover, 'teacher')).toEqual({ pages: 44, source: 'manual' });
  });

  it('책등 폭은 그 항목의 내지 용지 두께로 잰다', () => {
    expect(spineMmOf(base, 200)).toBe(spineWidthMm(200, innerPaperOf(DEFAULT_BOOK_SETTINGS.innerPaper).thicknessMm));
  });
});
