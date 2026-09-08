import { describe, it, expect } from 'vitest';
import { extractBearerToken } from './bearer-token';

describe('extractBearerToken', () => {
  it('Bearer 토큰을 꺼낸다', () => {
    expect(extractBearerToken('Bearer abc.def.ghi')).toBe('abc.def.ghi');
  });

  it('스킴 대소문자를 가리지 않는다 (RFC 7235)', () => {
    expect(extractBearerToken('bearer abc')).toBe('abc');
    expect(extractBearerToken('BEARER abc')).toBe('abc');
  });

  it('앞뒤 공백을 무시한다', () => {
    expect(extractBearerToken('  Bearer   abc  ')).toBe('abc');
  });

  it('헤더가 없거나 비면 빈 문자열', () => {
    expect(extractBearerToken(null)).toBe('');
    expect(extractBearerToken(undefined)).toBe('');
    expect(extractBearerToken('')).toBe('');
    expect(extractBearerToken('   ')).toBe('');
  });

  it('다른 스킴은 받지 않는다', () => {
    expect(extractBearerToken('Basic abc')).toBe('');
    expect(extractBearerToken('abc')).toBe('');
  });

  it('토큰이 비어 있으면 빈 문자열 — 빈 토큰으로 getUser 를 부르지 않게 한다', () => {
    expect(extractBearerToken('Bearer')).toBe('');
    expect(extractBearerToken('Bearer ')).toBe('');
    expect(extractBearerToken('Bearer    ')).toBe('');
  });
});
