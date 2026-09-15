import { describe, it, expect } from 'vitest';
import { foldLoose, foldStrict, foldWithMap } from './fold';

describe('foldStrict', () => {
  it('칸 구분은 공백으로 — 두 칸에 걸친 뜻을 한 줄로 되돌린다', () => {
    expect(foldStrict('| 경외 | 존경하고 | 두려워함 |')).toBe('경외 존경하고 두려워함');
  });

  it('어절 경계를 지킨다 — 공백까지 지우면 "아버지 가방에" 가 "아버지가 방에" 와 같아진다', () => {
    expect(foldStrict('아버지가 방에 들어감')).not.toBe(foldStrict('아버지 가방에 들어감'));
  });

  it('원문의 기호는 남긴다 — "-3" 과 "3" 은 다른 값이다', () => {
    expect(foldStrict('값은 -3이다')).toContain('-3');
  });

  it('줄머리 기호만 걷어낸다 — 우리가 넣은 것이지 원문에 있던 글자가 아니다', () => {
    expect(foldStrict('- 표현법은 의인법이다')).toBe('표현법은 의인법이다');
    expect(foldStrict('# 제재 개관')).toBe('제재 개관');
  });
});

describe('foldLoose', () => {
  it('공백과 기호를 모두 지운다 — 표 한 행을 편집기 문서의 같은 자리와 맞추려면 필요하다', () => {
    expect(foldLoose('| 시어 | 꿈을 지닌 대상 |')).toBe('시어꿈을지닌대상');
  });
});

describe('foldWithMap', () => {
  it('접은 글자가 원본 어디에서 왔는지 남긴다 — 힌트가 덮는 구간을 되찾는 재료다', () => {
    const folded = foldWithMap('가 나다', 'loose');
    expect(folded.text).toBe('가나다');
    expect(folded.map.map((i) => '가 나다'[i]).join('')).toBe('가나다');
  });
});
