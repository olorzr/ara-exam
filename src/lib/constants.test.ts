import { describe, it, expect } from 'vitest';
import {
  COLOR_PRIMARY,
  DEFAULT_PASS_PERCENTAGE,
  PERCENTAGE_BASE,
  PASSWORD_MIN_LENGTH,
  MIDDLE_SCHOOL_GRADES,
  HIGH_SCHOOL_GRADES,
  ADMIN_EMAIL,
  isAdminEmail,
} from './constants';

describe('constants', () => {
  it('포인트 컬러가 올바른 값이다', () => {
    expect(COLOR_PRIMARY).toBe('#81D8D0');
  });

  it('기본 합격 기준이 80%이다', () => {
    expect(DEFAULT_PASS_PERCENTAGE).toBe(80);
  });

  it('퍼센트 기준값이 100이다', () => {
    expect(PERCENTAGE_BASE).toBe(100);
  });

  it('비밀번호 최소 길이가 6이다', () => {
    expect(PASSWORD_MIN_LENGTH).toBe(6);
  });

  it('중등 학년이 3개이다', () => {
    expect(MIDDLE_SCHOOL_GRADES).toHaveLength(3);
    expect(MIDDLE_SCHOOL_GRADES).toContain('중1');
  });

  it('고등 학년이 3개이다', () => {
    expect(HIGH_SCHOOL_GRADES).toHaveLength(3);
    expect(HIGH_SCHOOL_GRADES).toContain('고1');
  });
});

describe('isAdminEmail', () => {
  it('관리자 이메일만 true 다', () => {
    expect(isAdminEmail(ADMIN_EMAIL)).toBe(true);
    expect(isAdminEmail('someone@araeducation.co.kr')).toBe(false);
    expect(isAdminEmail(null)).toBe(false);
    expect(isAdminEmail(undefined)).toBe(false);
  });
});
