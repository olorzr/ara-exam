import { describe, it, expect } from 'vitest';
import { pgArrayLiteral } from './pg-array-literal';

describe('pgArrayLiteral', () => {
  it('쉼표가 든 원소를 한 원소로 지킨다 — 「소녀, 두드리다」가 0건이 되던 자리', () => {
    expect(pgArrayLiteral(['소녀, 두드리다'])).toBe('{"소녀, 두드리다"}');
  });

  it('원소마다 큰따옴표를 감싸고 쉼표로 잇는다', () => {
    expect(pgArrayLiteral(['동백꽃', '봄봄'])).toBe('{"동백꽃","봄봄"}');
  });

  it('큰따옴표와 역슬래시는 역슬래시로 이스케이프한다', () => {
    expect(pgArrayLiteral(['a"b'])).toBe('{"a\\"b"}');
    expect(pgArrayLiteral(['c\\d'])).toBe('{"c\\\\d"}');
    // 역슬래시 뒤에 따옴표가 와도 각자 한 번씩만 이스케이프된다
    expect(pgArrayLiteral(['\\"'])).toBe('{"\\\\\\""}');
  });

  it('중괄호·앞뒤 공백은 따옴표 안에 그대로 남는다', () => {
    expect(pgArrayLiteral(['a{b}c'])).toBe('{"a{b}c"}');
    expect(pgArrayLiteral([' 동백꽃 '])).toBe('{" 동백꽃 "}');
  });

  it('빈 배열은 빈 리터럴이다', () => {
    expect(pgArrayLiteral([])).toBe('{}');
  });

  it('문법 경로처럼 `>` 와 공백이 든 원소도 그대로 담는다', () => {
    expect(pgArrayLiteral(['단어 > 품사 > 명사', '단어 > 품사 > 대명사']))
      .toBe('{"단어 > 품사 > 명사","단어 > 품사 > 대명사"}');
  });
});
