import { describe, expect, it } from 'vitest';
import { hasLabelBefore } from './label';
import { foldPlain, locateAll } from './place';

/** 그 물음이 있는 자리 */
const spanOf = (plain: string, text: string) => {
  const start = plain.indexOf(text);
  return { start, end: start + text.length };
};

describe('hasLabelBefore', () => {
  it('⚠️ 번호 1 은 11 에 걸리지 않는다 — 숫자 묶음을 통째로 견준다 (Stop 게이트)', () => {
    const plain = '11. 표현법은?';
    expect(hasLabelBefore(plain, spanOf(plain, '표현법은?'), '1')).toBe(false);
    expect(hasLabelBefore(plain, spanOf(plain, '표현법은?'), '11')).toBe(true);
  });

  it('기호가 달라도 숫자가 같으면 같은 번호다', () => {
    const plain = '(1) 표현법은?';
    expect(hasLabelBefore(plain, spanOf(plain, '표현법은?'), '1')).toBe(true);
    expect(hasLabelBefore(plain, spanOf(plain, '표현법은?'), '(1)')).toBe(true);
  });

  it("'3-1' 은 숫자 둘을 다 맞춰야 한다", () => {
    const plain = '3-1. 표현법은?';
    expect(hasLabelBefore(plain, spanOf(plain, '표현법은?'), '3-1')).toBe(true);
    expect(hasLabelBefore(plain, spanOf(plain, '표현법은?'), '3')).toBe(false);
  });

  it("'문 2)' 처럼 글자가 섞여도 숫자로 맞춘다", () => {
    const plain = '문 2) 표현법은?';
    expect(hasLabelBefore(plain, spanOf(plain, '표현법은?'), '2')).toBe(true);
  });

  it('숫자가 없는 번호는 앞머리 끝 글자로 견준다', () => {
    const plain = '가. 표현법은?';
    expect(hasLabelBefore(plain, spanOf(plain, '표현법은?'), '가')).toBe(true);
    expect(hasLabelBefore(plain, spanOf(plain, '표현법은?'), '나')).toBe(false);
  });

  it('⚠️ 괄호를 쓴 번호도 맞춘다 — 한쪽만 벗기면 어느 자리에도 못 앉는다 (코덱스 8R)', () => {
    const plain = '(가) 표현법은?';
    expect(hasLabelBefore(plain, spanOf(plain, '표현법은?'), '(가)')).toBe(true);
    expect(hasLabelBefore(plain, spanOf(plain, '표현법은?'), '가')).toBe(true);
    expect(hasLabelBefore(plain, spanOf(plain, '표현법은?'), '(나)')).toBe(false);
  });

  it('앞머리가 길면 번호 자리가 아니다 — 글 한복판이다', () => {
    const plain = '이 작품은 1930년대에 발표되었는데 표현법은?';
    expect(hasLabelBefore(plain, spanOf(plain, '표현법은?'), '1930')).toBe(false);
  });

  it('번호가 비어 있으면 언제나 false', () => {
    const plain = '1. 표현법은?';
    expect(hasLabelBefore(plain, spanOf(plain, '표현법은?'), '')).toBe(false);
  });
});

describe('locateAll', () => {
  it('나오는 자리를 앞에서부터 모두 준다', () => {
    const plain = '가나\n가나\n가나';
    expect(locateAll(foldPlain(plain), '가나')).toHaveLength(3);
  });

  it('없으면 빈 배열 — 접어서 빈 말도 마찬가지다', () => {
    expect(locateAll(foldPlain('가나'), '다라')).toEqual([]);
    expect(locateAll(foldPlain('가나'), '  ')).toEqual([]);
  });
});
