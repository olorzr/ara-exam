import { describe, it, expect } from 'vitest';
import { passagePickName } from './passage-search';

describe('passagePickName', () => {
  it('제목이 없으면 머리글 범위로, 그것도 없으면 기본 이름으로 보여 준다', () => {
    expect(passagePickName({ title: '진달래꽃', label: '[1~3]' })).toBe('진달래꽃');
    expect(passagePickName({ title: '  ', label: '[1~3]' })).toBe('[1~3]');
    expect(passagePickName({ title: '', label: '' })).toBe('제목 없는 지문');
  });
});
