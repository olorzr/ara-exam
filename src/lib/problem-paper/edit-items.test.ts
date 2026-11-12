import { describe, expect, it } from 'vitest';
import {
  isPaperEditDirty, refreshClash, refreshGroupItems, sameCanvas, storedItemKey, toCanvasItems, toEditEntries, type StoredPaperItem,
} from './edit-items';
import { DEFAULT_PAPER_SETTINGS } from './settings';
import type { PaperItemSnapshot } from '@/types/problem-bank';

const snap = (passageId: string | null) => ({
  passage: passageId ? { id: passageId } : null,
}) as unknown as PaperItemSnapshot;

const stored: StoredPaperItem[] = [
  { id: 'i1', orderIndex: 0, problemId: 'p1', snapshot: snap('X') },
  { id: 'i2', orderIndex: 1, problemId: null, snapshot: snap('X') },
  { id: 'i3', orderIndex: 2, problemId: 'p3', snapshot: snap(null) },
];

describe('storedItemKey', () => {
  it('원본이 살아 있으면 문항 id, 지워졌으면 item: 앞머리', () => {
    expect(storedItemKey(stored[0])).toBe('p1');
    expect(storedItemKey(stored[1])).toBe('item:i2');
  });
});

describe('toCanvasItems', () => {
  it('지문은 **스냅샷의 지문 id** 로 묶고 항목 id 를 단다', () => {
    expect(toCanvasItems(stored)).toEqual([
      { problemId: 'p1', passageId: 'X', itemId: 'i1' },
      { problemId: 'item:i2', passageId: 'X', itemId: 'i2' },
      { problemId: 'p3', passageId: null, itemId: 'i3' },
    ]);
  });
});

describe('toEditEntries', () => {
  it('기존 항목은 { item }, 새 문항은 { problem } — 차례 그대로', () => {
    const canvas = [...toCanvasItems(stored).slice(0, 2), { problemId: 'new-1', passageId: 'X' }];
    expect(toEditEntries(canvas)).toEqual([{ item: 'i1' }, { item: 'i2' }, { problem: 'new-1' }]);
  });
});

describe('sameCanvas · isPaperEditDirty', () => {
  const items = toCanvasItems(stored);
  const base = { items, title: '문제지', settings: DEFAULT_PAPER_SETTINGS };

  it('차례·항목이 같으면 같다', () => {
    expect(sameCanvas(items, [...items])).toBe(true);
    expect(sameCanvas(items, [items[1], items[0], items[2]])).toBe(false);
    expect(sameCanvas(items, items.slice(0, 2))).toBe(false);
  });

  it('뺐다가 같은 자리에 되살리면(같은 항목 id) 고친 것이 아니다', () => {
    expect(isPaperEditDirty(base, { ...base, items: items.map((i) => ({ ...i })) })).toBe(false);
  });

  it('같은 문항을 새로 굳히면(항목 id 없음) 고친 것이다', () => {
    const fresh = [{ problemId: 'p1', passageId: 'X' }, items[1], items[2]];
    expect(isPaperEditDirty(base, { ...base, items: fresh })).toBe(true);
  });

  it('제목(앞뒤 공백 무시)·단 수·출처 숨기기를 본다', () => {
    expect(isPaperEditDirty(base, { ...base, title: ' 문제지 ' })).toBe(false);
    expect(isPaperEditDirty(base, { ...base, title: '새 제목' })).toBe(true);
    expect(isPaperEditDirty(base, { ...base, settings: { ...base.settings, columns: 1 } })).toBe(true);
    expect(isPaperEditDirty(base, { ...base, settings: { ...base.settings, showSource: false } })).toBe(true);
  });
});

describe('refreshGroupItems — 최신 지문으로', () => {
  it('항목 id 를 떼고 지금 지문 id 로 다시 묶는다 — 지문이 합쳐졌으면 그 묶음 끝으로 붙는다', () => {
    const canvas = [
      { problemId: 'a', passageId: 'OLD', itemId: 'i1' },
      { problemId: 'b', passageId: 'OLD', itemId: 'i2' },
      { problemId: 'c', passageId: null, itemId: 'i3' },
      { problemId: 'd', passageId: 'NEW', itemId: 'i4' },
    ];
    const out = refreshGroupItems(canvas, new Set(['i1', 'i2']), new Map([['a', 'NEW'], ['b', 'NEW']]));
    expect(out).toEqual([
      { problemId: 'c', passageId: null, itemId: 'i3' },
      { problemId: 'd', passageId: 'NEW', itemId: 'i4' },
      { problemId: 'a', passageId: 'NEW' },
      { problemId: 'b', passageId: 'NEW' },
    ]);
  });

  it('지문이 그대로면 제자리에서 항목 id 만 뗀다, 원본이 사라진 항목은 그대로 둔다', () => {
    const canvas = [
      { problemId: 'c', passageId: null, itemId: 'i3' },
      { problemId: 'a', passageId: 'P', itemId: 'i1' },
      { problemId: 'b', passageId: 'P', itemId: 'i2' },
    ];
    expect(refreshGroupItems(canvas, new Set(['i1', 'i2']), new Map([['a', 'P']]))).toEqual([
      { problemId: 'c', passageId: null, itemId: 'i3' },
      { problemId: 'b', passageId: 'P', itemId: 'i2' },
      { problemId: 'a', passageId: 'P' },
    ]);
  });
});

describe('refreshClash — 합쳐진 지문의 다른 저장 묶음', () => {
  const canvas = [
    { problemId: 'a', passageId: 'A', itemId: 'i1' },
    { problemId: 'c', passageId: null, itemId: 'i3' },
    { problemId: 'b', passageId: 'B', itemId: 'i2' },
    { problemId: 'n', passageId: 'B' },
  ];
  const live = (p: string | null) => new Map([['a', p]]);

  it('옮겨 갈 지문 묶음의 저장 항목을 함께 새로 굳힌다(새로 담은 문항은 상관없다)', () => {
    expect(refreshClash(canvas, new Set(['i1']), live('B'), () => true))
      .toEqual({ items: [{ problemId: 'b', passageId: 'B', itemId: 'i2' }], orphan: false });
  });

  it('지문이 그대로면 아무것도 없다, 원본이 지워진 저장 항목이 끼면 막는다', () => {
    expect(refreshClash(canvas, new Set(['i1']), live('A'), () => true)).toEqual({ items: [], orphan: false });
    expect(refreshClash(canvas, new Set(['i1']), live('B'), (i) => i.itemId !== 'i2').orphan).toBe(true);
  });
});

