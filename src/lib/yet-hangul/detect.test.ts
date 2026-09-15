import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import {
  hanyangPuaCount, hasYetHangul, markHanyangPua,
  YET_HANGUL_MARKER, YET_HANGUL_UNICODE_RANGE,
} from './detect';
import { CHOSEONG, JONGSEONG, JUNGSEONG } from './jamo-tables';

describe('hasYetHangul', () => {
  it('첫가끝 조합형 자모가 있으면 true — 현대 한글은 완성형으로 저장되므로 곧 옛한글이다', () => {
    expect(hasYetHangul('나랏말\u110A\u119E미')).toBe(true);
  });

  it('방점만 있어도 true', () => {
    expect(hasYetHangul('나\u302E')).toBe(true);
  });

  it('한양 PUA 로 적힌 옛한글도 true — 아래아한글 문서에서 온다', () => {
    expect(hasYetHangul('\uE0BC')).toBe(true);
  });

  it('현대 국어만 있으면 false', () => {
    expect(hasYetHangul('<p>다음 글을 읽고 물음에 답하시오.</p>')).toBe(false);
  });

  it('낱자 ㆍ·ㅿ 하나만 있으면 false — 낱자를 설명하는 문법 문항까지 글꼴을 바꾸면 안 된다', () => {
    expect(hasYetHangul('<p>ㆍ의 소실을 설명한 것으로 옳은 것은?</p>')).toBe(false);
    expect(hasYetHangul('<p>ㅿ 은 반치음이다</p>')).toBe(false);
  });

  it('빈 문자열은 false', () => {
    expect(hasYetHangul('')).toBe(false);
  });

  it('자모로 갈린 **현대** 글자(NFD)는 false — 그러지 않으면 대조 검증을 빠져나간다', () => {
    expect(hasYetHangul('한글'.normalize('NFD'))).toBe(false);
  });

  it('현대 글자가 섞여 갈려 있어도 옛 자모가 있으면 true', () => {
    expect(hasYetHangul(`${'한글'.normalize('NFD')} \u1112\u119E\u11AB`)).toBe(true);
  });
});

describe('hanyangPuaCount', () => {
  it('PUA 글자 수를 센다 — 참고 텍스트의 "옮길 수 있는 글자" 에서 뺄 값이다', () => {
    expect(hanyangPuaCount('가\uE0BC나\uE0BD')).toBe(2);
  });

  it('사용자 정의 영역이라도 한양 구간 밖은 안 센다 — 그쪽은 여전히 깨진 글자다', () => {
    expect(hanyangPuaCount('\uE000\uF8FF')).toBe(0);
  });

  it('없으면 0', () => {
    expect(hanyangPuaCount('가나다')).toBe(0);
  });
});

describe('markHanyangPua', () => {
  it('PUA 글자를 자리 표시로 바꾼다 — 모델에게는 뜻 없는 코드라 자리만 알린다', () => {
    expect(markHanyangPua(`가\uE0BC나`)).toBe(`가${YET_HANGUL_MARKER}나`);
  });

  it('PUA 가 없으면 그대로', () => {
    expect(markHanyangPua('가나다')).toBe('가나다');
  });

  it('여러 번 불러도 같은 결과다 — 자리 표시에는 PUA 가 없다', () => {
    const once = markHanyangPua('\uE0BC\uE0BD');
    expect(markHanyangPua(once)).toBe(once);
  });

  it('전역 판을 다시 써도 앞 호출의 자리(lastIndex)가 남지 않는다', () => {
    expect(markHanyangPua('\uE0BC')).toBe(YET_HANGUL_MARKER);
    expect(markHanyangPua('\uE0BC')).toBe(YET_HANGUL_MARKER);
  });
});

describe('globals.css 와의 거울', () => {
  it('@font-face 의 unicode-range 가 상수와 글자 그대로 같다 — 한쪽만 고치면 글꼴이 안 걸린다', () => {
    const css = fs.readFileSync('src/app/globals.css', 'utf8');
    expect(css).toContain(`unicode-range: ${YET_HANGUL_UNICODE_RANGE};`);
  });
});

describe('자모 표', () => {
  it('값이 저마다의 블록 안에 있다 — 자리를 잘못 적으면 글자가 통째로 바뀐다', () => {
    const inRange = (v: string, lo: number, hi: number) => {
      const code = v.codePointAt(0) ?? 0;
      return code >= lo && code <= hi;
    };
    expect(Object.values(CHOSEONG).every((v) => inRange(v, 0x1100, 0x115F))).toBe(true);
    expect(Object.values(JUNGSEONG).every((v) => inRange(v, 0x1160, 0x11A7))).toBe(true);
    expect(Object.values(JONGSEONG).every((v) => inRange(v, 0x11A8, 0x11FF))).toBe(true);
  });

  it('호환 자모의 정준 분해(NFKD)가 표의 어느 자리와 맞는다 — 코드포인트 오타를 잡는다', () => {
    const letters = new Set([
      ...Object.keys(CHOSEONG), ...Object.keys(JUNGSEONG), ...Object.keys(JONGSEONG),
    ]);
    const wrong: string[] = [];
    for (const letter of letters) {
      if (letter === '·') continue; // 가운뎃점은 호환 자모가 아니다(모델 오류 대비 별칭)
      const decomposed = letter.normalize('NFKD');
      const known = [CHOSEONG[letter], JUNGSEONG[letter], JONGSEONG[letter]].filter(Boolean);
      if (!known.includes(decomposed)) wrong.push(letter);
    }
    expect(wrong).toEqual([]);
  });
});
