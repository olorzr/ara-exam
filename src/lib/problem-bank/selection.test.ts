import { describe, it, expect } from 'vitest';
import {
  bulkDeleteConfirmMessage, pageAfterDelete, toggleAllVisible, toggleId, visibleSelection,
} from './selection';

describe('visibleSelection', () => {
  it('보이지 않는 id 는 뺀다 — 다른 쪽 문항을 몰래 지우면 안 된다', () => {
    expect(visibleSelection(new Set(['a', 'z']), ['a', 'b'])).toEqual(['a']);
  });

  it('보이는 행 순서를 따른다', () => {
    expect(visibleSelection(new Set(['c', 'a']), ['a', 'b', 'c'])).toEqual(['a', 'c']);
  });

  it('선택이 비면 빈 배열', () => {
    expect(visibleSelection(new Set(), ['a', 'b'])).toEqual([]);
  });
});

describe('toggleId', () => {
  it('없으면 넣고 있으면 뺀다', () => {
    expect([...toggleId(new Set(), 'a')]).toEqual(['a']);
    expect([...toggleId(new Set(['a']), 'a')]).toEqual([]);
  });

  it('원본 집합을 바꾸지 않는다', () => {
    const before = new Set(['a']);
    toggleId(before, 'b');
    expect([...before]).toEqual(['a']);
  });
});

describe('toggleAllVisible', () => {
  it('일부만 선택돼 있으면 보이는 행 전부를 켠다', () => {
    expect([...toggleAllVisible(new Set(['a']), ['a', 'b'])]).toEqual(['a', 'b']);
  });

  it('보이는 행이 전부 선택돼 있으면 비운다', () => {
    expect([...toggleAllVisible(new Set(['a', 'b']), ['a', 'b'])]).toEqual([]);
  });

  it('보이는 행이 없으면 빈 집합', () => {
    expect([...toggleAllVisible(new Set(['a']), [])]).toEqual([]);
  });
});

describe('pageAfterDelete', () => {
  it('마지막 쪽을 다 지우면 앞 쪽으로 간다', () => {
    // 3쪽(0,1,2) 중 마지막 쪽의 5개를 전부 지우면 2쪽 분량만 남는다
    expect(pageAfterDelete({ page: 2, pageSize: 60, total: 125, deleted: 5 })).toBe(1);
  });

  it('첫 쪽은 0 에 머문다', () => {
    expect(pageAfterDelete({ page: 0, pageSize: 60, total: 10, deleted: 10 })).toBe(0);
  });

  it('중간 쪽을 다 지워도 그 쪽에 머문다 — 뒤 쪽이 당겨진다', () => {
    expect(pageAfterDelete({ page: 1, pageSize: 60, total: 200, deleted: 60 })).toBe(1);
  });

  it('전부 지우면 첫 쪽', () => {
    expect(pageAfterDelete({ page: 3, pageSize: 60, total: 200, deleted: 200 })).toBe(0);
  });
});

describe('bulkDeleteConfirmMessage', () => {
  it('문제지에 담긴 것이 있으면 개수와 스냅샷 규약을 알린다', () => {
    const message = bulkDeleteConfirmMessage(3, 2);
    expect(message).toContain('3개 문항을 지울까요?');
    expect(message).toContain('문제지 2개');
    expect(message).toContain('스냅샷');
  });

  it('담긴 문제지가 없으면 한 줄이다', () => {
    expect(bulkDeleteConfirmMessage(1, 0)).toBe('선택한 1개 문항을 지울까요?');
  });
});
