import { describe, expect, it } from 'vitest';
import { applyOwnerScope, OWNER_SCOPES, parseOwnerScope } from './owner-scope';

/** 건 조건을 적어 두는 가짜 빌더 */
class FakeRequest {
  calls: string[] = [];
  eq(column: string, value: string): FakeRequest { this.calls.push(`${column}=eq.${value}`); return this; }
  neq(column: string, value: string): FakeRequest { this.calls.push(`${column}=neq.${value}`); return this; }
}

describe('applyOwnerScope', () => {
  it('내 것은 내 id 와 같은 행, 다른 선생님 것은 다른 행', () => {
    expect(applyOwnerScope(new FakeRequest(), 'mine', 'u1').calls).toEqual(['user_id=eq.u1']);
    expect(applyOwnerScope(new FakeRequest(), 'others', 'u1').calls).toEqual(['user_id=neq.u1']);
  });
});

describe('parseOwnerScope', () => {
  it('아는 값만 받고 null·모르는 값은 버린다', () => {
    expect(parseOwnerScope('mine')).toBe('mine');
    expect(parseOwnerScope('others')).toBe('others');
    expect(parseOwnerScope(null)).toBeNull();
    expect(parseOwnerScope('all')).toBeNull();
  });

  it('첫 탭(기본)은 내 것이다', () => {
    expect(OWNER_SCOPES[0]).toBe('mine');
  });
});
