import { describe, expect, it } from 'vitest';
import { bookLayoutKeyFor } from './layout';
import {
  BOOK_RENDER_REVISION, bookLayoutKey, DEFAULT_BOOK_SETTINGS, EDITION_SUFFIX, MANUAL_PAGES_MAX, normalizeBookSettings, normalizePageCounts,
  SPINE_COLOR_PRESETS, SPINE_INK_PRESETS,
} from './settings';
import { spineInkFor } from './spine';
import { DEFAULT_SPINE_FONT } from './spine-fonts';
import { chapterTitleOf, normalizeBookKind, type Book } from './types';

describe('normalizeBookSettings', () => {
  it('빈 값·옛 행은 기본 설정', () => {
    expect(normalizeBookSettings(null)).toEqual(DEFAULT_BOOK_SETTINGS);
    expect(normalizeBookSettings({})).toEqual(DEFAULT_BOOK_SETTINGS);
  });

  it('저장값은 존중하고 모르는 값만 기본으로', () => {
    const s = normalizeBookSettings({
      innerPaper: '1023', columns: 1, chapterStart: 'page', trimWorks: false, toc: false,
      spineColor: '#ABCDEF', spineInk: '#A8325E', spineText: '  국어  ', spineFont: 'jua', backFill: 'spine',
    });
    expect(s).toEqual({
      innerPaper: '1023', columns: 1, chapterStart: 'page', trimWorks: false, toc: false,
      spineColor: '#abcdef', spineInk: '#a8325e', spineText: '국어', spineFont: 'jua', backFill: 'spine', manualPages: {},
    });
    const bad = normalizeBookSettings({
      innerPaper: '9', columns: 3, chapterStart: 'x', spineColor: 'red', backFill: 1, toc: 'yes', spineFont: 'comic',
      spineInk: 'pink',
    });
    expect(bad.innerPaper).toBe(DEFAULT_BOOK_SETTINGS.innerPaper);
    expect(bad.columns).toBe(2);
    expect(bad.chapterStart).toBe('odd');
    expect(bad.spineColor).toBe(DEFAULT_BOOK_SETTINGS.spineColor);
    expect(bad.backFill).toBe('white');
    expect(bad.toc).toBe(true);
    expect(bad.spineFont).toBe(DEFAULT_SPINE_FONT);
    expect(bad.spineInk).toBe('auto');
    // 0.9.59 에 잠깐 있던 글꼴(동글)은 목록에서 빠져 기본 글꼴로 읽는다
    expect(normalizeBookSettings({ spineFont: 'dongle' }).spineFont).toBe(DEFAULT_SPINE_FONT);
  });

  it('새 책은 목차를 넣고, 책등은 파스텔 첫 색 · 지마켓 산스', () => {
    expect(DEFAULT_BOOK_SETTINGS.toc).toBe(true);
    expect(DEFAULT_BOOK_SETTINGS.spineColor).toBe('#f6c6d0');
    expect(DEFAULT_BOOK_SETTINGS.spineFont).toBe('gmarket');
    expect(DEFAULT_BOOK_SETTINGS.spineInk).toBe('auto');
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
    settings: { columns: 2 as const, chapterStart: 'odd' as const, trimWorks: true, toc: true },
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
    expect(bookLayoutKey({ ...input, settings: { ...input.settings, toc: false } })).not.toBe(base);
    expect(bookLayoutKey({ ...input, chapters: [...input.chapters].reverse() })).not.toBe(base);
    expect(bookLayoutKey({ ...input, chapters: [input.chapters[0], { paperId: 'b', title: '둘째' }] })).not.toBe(base);
  });

  it('인쇄 모양 개정 번호가 지문에 든다 — 올리면 이미 잰 책이 모두 다시 재라고 막힌다', () => {
    // 개정 번호를 빼고 같은 식으로 만든 지문과 달라야 한다(빠지면 글자 크기가 바뀌어도 옛 쪽 수가 '최신' 이다)
    const text = JSON.stringify([
      input.edition, input.title, input.settings.columns, input.settings.chapterStart, input.settings.trimWorks,
      input.chapters.map((c) => [c.paperId, c.title]), input.settings.toc,
    ]);
    let hash = 0x811c9dc5;
    for (let i = 0; i < text.length; i += 1) { hash ^= text.charCodeAt(i); hash = Math.imul(hash, 0x01000193) >>> 0; }
    expect(bookLayoutKey(input)).not.toBe(hash.toString(16).padStart(8, '0'));
    expect(BOOK_RENDER_REVISION).toBeGreaterThanOrEqual(2);
  });
});

describe('내지 구성 지문은 표지 쪽 설정에 흔들리지 않는다', () => {
  it('직접 넣은 쪽 수·책등 색·글꼴·글자·내지 용지가 달라도 지문이 같다', () => {
    const book: Book = {
      id: 'b', title: '책', kind: 'book', finishedAt: null, settings: DEFAULT_BOOK_SETTINGS, pageCounts: {}, cover: null,
      userId: 'u', createdAt: '', updatedAt: '',
    };
    const other: Book = {
      ...book,
      settings: {
        ...book.settings, manualPages: { student: 99 }, spineColor: '#000000', innerPaper: '1023',
        spineFont: 'nanumpen', spineInk: '#a8325e', spineText: '다른 글자', backFill: 'spine',
      },
    };
    expect(bookLayoutKeyFor(other, [], 'student')).toBe(bookLayoutKeyFor(book, [], 'student'));
  });
});

describe('책등 색 바로 고르기', () => {
  it('값은 소문자 #rrggbb(고른 칸 표시가 글자 그대로 견준다), 이름이 겹치지 않는다', () => {
    for (const c of SPINE_COLOR_PRESETS) expect(c.value).toMatch(/^#[0-9a-f]{6}$/);
    expect(new Set(SPINE_COLOR_PRESETS.map((c) => c.value)).size).toBe(SPINE_COLOR_PRESETS.length);
    expect(new Set(SPINE_COLOR_PRESETS.map((c) => c.label)).size).toBe(SPINE_COLOR_PRESETS.length);
  });

  it('글자색 바로 고르기도 소문자 #rrggbb 이고 이름이 겹치지 않는다', () => {
    for (const c of SPINE_INK_PRESETS) expect(c.value).toMatch(/^#[0-9a-f]{6}$/);
    expect(new Set(SPINE_INK_PRESETS.map((c) => c.label)).size).toBe(SPINE_INK_PRESETS.length);
  });

  it('파스텔 여덟은 검은 글자, 진한 둘(남색·먹색)은 흰 글자가 읽힌다', () => {
    const inks = SPINE_COLOR_PRESETS.map((c) => spineInkFor(c.value));
    expect(inks.slice(0, 8)).toEqual(Array(8).fill('#111111'));
    expect(inks.slice(8)).toEqual(['#ffffff', '#ffffff']);
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
