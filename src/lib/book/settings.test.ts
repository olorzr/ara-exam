import { describe, expect, it } from 'vitest';
import { bookLayoutKeyFor } from './layout';
import {
  bookLayoutKey, DEFAULT_BOOK_SETTINGS, EDITION_SUFFIX, MANUAL_PAGES_MAX, normalizeBookSettings, normalizePageCounts,
} from './settings';
import { chapterTitleOf, normalizeBookKind, type Book } from './types';

describe('normalizeBookSettings', () => {
  it('빈 값·옛 행은 기본 설정', () => {
    expect(normalizeBookSettings(null)).toEqual(DEFAULT_BOOK_SETTINGS);
    expect(normalizeBookSettings({})).toEqual(DEFAULT_BOOK_SETTINGS);
  });

  it('저장값은 존중하고 모르는 값만 기본으로', () => {
    const s = normalizeBookSettings({
      innerPaper: '1023', columns: 1, chapterStart: 'page', trimWorks: false,
      spineColor: '#ABCDEF', spineText: '  국어  ', backFill: 'spine',
    });
    expect(s).toEqual({
      innerPaper: '1023', columns: 1, chapterStart: 'page', trimWorks: false,
      spineColor: '#abcdef', spineText: '국어', backFill: 'spine', manualPages: {},
    });
    const bad = normalizeBookSettings({ innerPaper: '9', columns: 3, chapterStart: 'x', spineColor: 'red', backFill: 1 });
    expect(bad.innerPaper).toBe(DEFAULT_BOOK_SETTINGS.innerPaper);
    expect(bad.columns).toBe(2);
    expect(bad.chapterStart).toBe('odd');
    expect(bad.spineColor).toBe(DEFAULT_BOOK_SETTINGS.spineColor);
    expect(bad.backFill).toBe('white');
  });

  it('직접 넣은 쪽 수는 알려진 판의 양의 정수·상한 안만 남긴다', () => {
    const s = normalizeBookSettings({
      manualPages: { student: 120, teacher: 0, key: 12.5, other: 40 },
    });
    expect(s.manualPages).toEqual({ student: 120 });
    expect(normalizeBookSettings({ manualPages: { student: MANUAL_PAGES_MAX } }).manualPages).toEqual({ student: MANUAL_PAGES_MAX });
    expect(normalizeBookSettings({ manualPages: { student: MANUAL_PAGES_MAX + 1 } }).manualPages).toEqual({});
    expect(normalizeBookSettings({ manualPages: 'x' }).manualPages).toEqual({});
    expect(normalizeBookSettings({ manualPages: { teacher: '40' } }).manualPages).toEqual({});
  });
});

describe('normalizeBookKind', () => {
  it('표지만은 cover, 나머지(빈 값·모르는 값)는 책', () => {
    expect(normalizeBookKind('cover')).toBe('cover');
    expect(normalizeBookKind('book')).toBe('book');
    expect(normalizeBookKind(null)).toBe('book');
    expect(normalizeBookKind('inner')).toBe('book');
  });
});

describe('normalizePageCounts', () => {
  it('모양이 맞는 판만 남긴다', () => {
    expect(normalizePageCounts({
      student: { pages: 120, key: 'abc' },
      teacher: { pages: 0, key: 'x' },
      key: { pages: 12.5, key: 'y' },
      other: { pages: 4, key: 'z' },
    })).toEqual({ student: { pages: 120, key: 'abc' } });
    expect(normalizePageCounts('nope')).toEqual({});
  });
});

describe('bookLayoutKey', () => {
  const input = {
    edition: 'student' as const,
    title: '국어 문학',
    settings: { columns: 2 as const, chapterStart: 'odd' as const, trimWorks: true },
    chapters: [{ paperId: 'a', title: '1단원' }, { paperId: 'b', title: '2단원' }],
  };

  it('같은 입력이면 같은 지문, 8자리 16진수', () => {
    expect(bookLayoutKey(input)).toBe(bookLayoutKey({ ...input, chapters: [...input.chapters] }));
    expect(bookLayoutKey(input)).toMatch(/^[0-9a-f]{8}$/);
  });

  it('쪽 수를 바꾸는 값이 하나라도 다르면 다른 지문', () => {
    const base = bookLayoutKey(input);
    expect(bookLayoutKey({ ...input, edition: 'teacher' })).not.toBe(base);
    expect(bookLayoutKey({ ...input, title: '국어 독서' })).not.toBe(base);
    expect(bookLayoutKey({ ...input, settings: { ...input.settings, columns: 1 } })).not.toBe(base);
    expect(bookLayoutKey({ ...input, settings: { ...input.settings, chapterStart: 'page' } })).not.toBe(base);
    expect(bookLayoutKey({ ...input, settings: { ...input.settings, trimWorks: false } })).not.toBe(base);
    expect(bookLayoutKey({ ...input, chapters: [...input.chapters].reverse() })).not.toBe(base);
    expect(bookLayoutKey({ ...input, chapters: [input.chapters[0], { paperId: 'b', title: '둘째' }] })).not.toBe(base);
  });
});

describe('내지 구성 지문은 표지 쪽 설정에 흔들리지 않는다', () => {
  it('직접 넣은 쪽 수·책등 색·내지 용지가 달라도 지문이 같다', () => {
    const book: Book = {
      id: 'b', title: '책', kind: 'book', finishedAt: null, settings: DEFAULT_BOOK_SETTINGS, pageCounts: {}, cover: null,
      userId: 'u', createdAt: '', updatedAt: '',
    };
    const other: Book = {
      ...book,
      settings: { ...book.settings, manualPages: { student: 99 }, spineColor: '#000000', innerPaper: '1023' },
    };
    expect(bookLayoutKeyFor(other, [], 'student')).toBe(bookLayoutKeyFor(book, [], 'student'));
  });
});

describe('판 꼬리 · 장 제목', () => {
  it('판마다 표지·머리글 꼬리', () => {
    expect(EDITION_SUFFIX).toEqual({ student: '', teacher: ' - 교사용', key: ' - 정답 및 해설' });
  });

  it('적은 장 제목이 있으면 그것, 없으면 문제지 제목', () => {
    const paper = { title: ' 문제지 ' } as never;
    expect(chapterTitleOf({ titleOverride: '  ', paper })).toBe('문제지');
    expect(chapterTitleOf({ titleOverride: '1장 현대시', paper })).toBe('1장 현대시');
    expect(chapterTitleOf({ titleOverride: '', paper: null })).toBe('');
  });
});
