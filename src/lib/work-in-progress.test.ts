import { describe, expect, it } from 'vitest';
import { hasWorkInProgress, holdWorkInProgress } from './work-in-progress';

describe('work-in-progress', () => {
  it('켠 것이 모두 꺼져야 없다고 답한다', () => {
    expect(hasWorkInProgress()).toBe(false);
    const a = holdWorkInProgress();
    const b = holdWorkInProgress();
    a();
    expect(hasWorkInProgress()).toBe(true);
    b();
    expect(hasWorkInProgress()).toBe(false);
  });

  it('같은 표시를 두 번 꺼도 남의 표시를 끄지 않는다', () => {
    const a = holdWorkInProgress();
    const b = holdWorkInProgress();
    a();
    a();
    expect(hasWorkInProgress()).toBe(true);
    b();
    expect(hasWorkInProgress()).toBe(false);
  });
});
