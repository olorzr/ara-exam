import { describe, it, expect } from 'vitest';
import { isDuplicateUploadError } from './storage-errors';

describe('isDuplicateUploadError', () => {
  it('409 는 중복이다 (문자열·숫자 둘 다 온다)', () => {
    expect(isDuplicateUploadError({ statusCode: '409', message: 'The resource already exists' })).toBe(true);
    expect(isDuplicateUploadError({ status: 409 })).toBe(true);
  });

  it("error: 'Duplicate' 도 중복이다", () => {
    expect(isDuplicateUploadError({ error: 'Duplicate', message: '' })).toBe(true);
  });

  it('메시지만 와도 알아본다', () => {
    expect(isDuplicateUploadError({ message: 'The resource already exists' })).toBe(true);
  });

  it('⚠️ 네트워크·권한·용량 실패를 중복으로 치지 않는다', () => {
    expect(isDuplicateUploadError({ statusCode: '403', message: 'new row violates row-level security policy' })).toBe(false);
    expect(isDuplicateUploadError({ statusCode: '413', message: 'Payload too large' })).toBe(false);
    expect(isDuplicateUploadError(new TypeError('Failed to fetch'))).toBe(false);
    expect(isDuplicateUploadError({ statusCode: '500' })).toBe(false);
  });

  it('오류가 아닌 것에도 안전하다', () => {
    expect(isDuplicateUploadError(null)).toBe(false);
    expect(isDuplicateUploadError(undefined)).toBe(false);
    expect(isDuplicateUploadError('409')).toBe(false);
  });
});
