import { describe, it, expect } from 'vitest';
import {
  composeSyllable, convertYetHangulNotation, decodeYetHangulEntities, finalizeYetHangul,
  hasUnconvertedNotation, normalizeYetHangul,
} from './compose';

/** 자모는 눈으로 구분이 안 된다 — 코드포인트로 적어 무엇을 기대하는지 분명히 한다 */
const HAN = '\u1112\u119E\u11AB'; // \u1112 + ㆍ + \u11AB
const PSAL = '\u1121\u119E\u11AF'; // \u1121(어두 자음군) + ㆍ + \u11AF
const SA = '\u1109\u119E'; // \u1109 + ㆍ

describe('composeSyllable', () => {
  it('초성·중성·종성을 첫가끝 자모 한 음절로 합친다', () => {
    expect(composeSyllable('ㅎㆍㄴ')).toBe(HAN);
  });

  it('어두 자음군도 초성 한 자다 — ㅄ 을 ㅂ+ㅅ 으로 나눠 받지 않는다', () => {
    expect(composeSyllable('ㅄㆍㄹ')).toBe(PSAL);
  });

  it('종성이 없어도 된다', () => {
    expect(composeSyllable('ㅅㆍ')).toBe(SA);
  });

  it('옛 자모가 섞이면 완성형으로 접지 않는다 — 접으면 안전망 글꼴이 못 합치는 모양이 된다', () => {
    expect(composeSyllable('ㄱㅏㅿ')).toBe('\u1100\u1161\u11EB');
    expect(composeSyllable('ㅂㅏㆁ')).toBe('\u1107\u1161\u11F0');
  });

  it('겹종성도 한 자로 받는다', () => {
    expect(composeSyllable('ㅁㅏㄻ')).toBe('\u1106\u1161\u11B1'.normalize('NFC'));
  });

  it('현대 자모는 NFC 가 완성형으로 접는다 — 저장 형태가 한 가지로 모인다', () => {
    expect(composeSyllable('ㄴㅏ')).toBe('나');
  });

  it('옛한글은 완성형이 없어 조합형 그대로 남는다', () => {
    expect([...HAN]).toHaveLength(3);
    expect(composeSyllable('ㅎㆍㄴ')).toBe(HAN);
  });

  it('방점은 음절 **뒤**에 붙는다 (한 점 U+302E · 두 점 U+302F)', () => {
    expect(composeSyllable('ㄴㆍ.')).toBe('\u1102\u119E\u302E');
    expect(composeSyllable('ㅂㆍㄹ:')).toBe('\u1107\u119E\u11AF\u302F');
  });

  it('낱자 사이 공백을 허용한다 — 팔레트로 찍으면 띄어 칠 수 있다', () => {
    expect(composeSyllable('ㅎ ㆍ ㄴ')).toBe(HAN);
  });

  it('가운뎃점(U+00B7)은 중성 자리에서만 아래아로 본다 — 모델이 그렇게 낼 때가 있다', () => {
    expect(composeSyllable('ㅎ·ㄴ')).toBe(HAN);
  });

  it('낱자가 하나거나 넷이면 null — 억지로 합치면 엉뚱한 글자가 된다', () => {
    expect(composeSyllable('ㅏ')).toBeNull();
    expect(composeSyllable('ㄱ')).toBeNull();
    expect(composeSyllable('ㄱㅏㄴㄷ')).toBeNull();
  });

  it('그 자리에 올 수 없는 낱자면 null (중성 자리의 ㄱ, 초성 자리의 ㅏ)', () => {
    expect(composeSyllable('ㄱㄱ')).toBeNull();
    expect(composeSyllable('ㅏㅏ')).toBeNull();
  });

  it('종성에 못 쓰는 낱자면 null — 초성만 보고 통과시키지 않는다', () => {
    expect(composeSyllable('ㅎㆍㄸ')).toBeNull();
  });
});

describe('convertYetHangulNotation', () => {
  it('대체 표기를 자모로 바꾼다', () => {
    expect(convertYetHangulNotation('<p>⟦ㅎㆍㄴ⟧ 사\u1105\u119E\u11B7</p>')).toBe(`<p>${HAN} 사\u1105\u119E\u11B7</p>`);
  });

  it('한 문단에 여러 개가 있어도 모두 바꾼다', () => {
    expect(convertYetHangulNotation('⟦ㅎㆍㄴ⟧⟦ㅅㆍ⟧')).toBe(HAN + SA);
  });

  it('괄호 **밖**의 낱자는 절대 건드리지 않는다 — 문법 문항의 ㄱ. ㄴ. 이 깨진다', () => {
    const html = '<p>ㄱ. 첫째</p><p>ㆍ의 소실</p>';
    expect(convertYetHangulNotation(html)).toBe(html);
  });

  it('머리글 표기도 그대로다', () => {
    expect(convertYetHangulNotation('[1~3] 다음 글을 읽고')).toBe('[1~3] 다음 글을 읽고');
  });

  it('못 바꾸는 괄호는 **남긴다** — 지우면 무엇이 있었는지 사라진다', () => {
    expect(convertYetHangulNotation('<p>⟦ㅏ⟧</p>')).toBe('<p>⟦ㅏ⟧</p>');
  });

  it('두 번 돌려도 같다 (멱등) — 파이프라인이 다시 탈 수 있다', () => {
    const once = convertYetHangulNotation('<p>⟦ㅎㆍㄴ⟧ ⟦ㅏ⟧</p>');
    expect(convertYetHangulNotation(once)).toBe(once);
  });

  it('⟦ 가 없으면 입력을 그대로 돌려준다 (빠른 길)', () => {
    const html = '<p>현대 국어 지문입니다</p>';
    expect(convertYetHangulNotation(html)).toBe(html);
  });
});

describe('hasUnconvertedNotation', () => {
  it('바꾸지 못한 괄호가 남으면 true — 경고를 낼지 정하는 값이다', () => {
    expect(hasUnconvertedNotation(convertYetHangulNotation('⟦ㅏ⟧'))).toBe(true);
  });

  it('다 바뀌었으면 false', () => {
    expect(hasUnconvertedNotation(convertYetHangulNotation('⟦ㅎㆍㄴ⟧'))).toBe(false);
  });
});

describe('decodeYetHangulEntities', () => {
  it('실체 참조로 온 옛 자모를 되돌린다 — 정화기는 태그 없는 조각을 그대로 돌려준다', () => {
    expect(decodeYetHangulEntities('\uAC00&#x11EB;')).toBe('\uAC00\u11EB');
    expect(decodeYetHangulEntities('&#4587;')).toBe('\u11EB');
  });

  it('대체 표기 괄호와 낱자도 되돌린다 — 그래야 변환이 알아본다', () => {
    expect(decodeYetHangulEntities('&#x27E6;&#x314E;&#x318D;&#x3134;&#x27E7;'))
      .toBe('\u27E6\u314E\u318D\u3134\u27E7');
  });

  it('⚠️ 마크업이 될 수 있는 참조는 **절대** 풀지 않는다 — 정화가 막아 둔 것이 되살아난다', () => {
    expect(decodeYetHangulEntities('&#x3C;script&#x3E;')).toBe('&#x3C;script&#x3E;');
    expect(decodeYetHangulEntities('&#60;&#38;&#34;')).toBe('&#60;&#38;&#34;');
  });

  it('이름 있는 참조는 건드리지 않는다 — 공백(&nbsp;)은 다른 규칙이 다룬다', () => {
    expect(decodeYetHangulEntities('가&nbsp;나')).toBe('가&nbsp;나');
  });

  it('참조가 없으면 입력 그대로 (빠른 길)', () => {
    expect(decodeYetHangulEntities('<p>현대 국어</p>')).toBe('<p>현대 국어</p>');
  });

  const CASES: [string, string, string][] = [
    ['대문자 접두사', '&#X11EB;', '\u11EB'],
    ['세미콜론 없음', '&#x11EB', '\u11EB'],
    ['앞의 0', '&#x00011EB;', '\u11EB'],
    ['십진수', '&#4587;', '\u11EB'],
    ['범위 밖(한자)', '&#x6F22;', '&#x6F22;'],
    ['범위 밖(따옴표)', '&#x27;', '&#x27;'],
    ['이름 있는 참조', '&lt;', '&lt;'],
    ['두 번 감싼 참조', '&amp;#x11EB;', '&amp;#x11EB;'],
    ['범위 경계 아래', '&#x10FF;', '&#x10FF;'],
    ['범위 경계 위', '&#x1200;', '&#x1200;'],
    ['숫자가 아님', '&#xZZ;', '&#xZZ;'],
  ];
  for (const [label, input, expected] of CASES) {
    it(`${label}: ${input} → ${expected === input ? '그대로' : '되돌림'}`, () => {
      expect(decodeYetHangulEntities(input)).toBe(expected);
    });
  }
});

describe('finalizeYetHangul', () => {
  it('정화가 푼 실체 참조까지 맞춘다 — 정화 전에만 맞추면 `가&#x11EB;` 가 섞인 모양으로 저장된다', () => {
    expect(finalizeYetHangul('<p>\uAC00\u11EB</p>')).toBe('<p>\u1100\u1161\u11EB</p>');
  });

  it('실체 참조 → 대체 표기 → 첫가끝 순서로 한 번에 끝낸다', () => {
    expect(finalizeYetHangul('&#x27E6;&#x314E;&#x318D;&#x3134;&#x27E7;'))
      .toBe('\u1112\u119E\u11AB');
  });

  it('대체 표기도 함께 푼다 — 마지막 관문 하나로 끝낸다', () => {
    expect(finalizeYetHangul('<p>\u27E6\u314E\u318D\u3134\u27E7</p>'))
      .toBe('<p>\u1112\u119E\u11AB</p>');
  });

  it('두 번 돌려도 같다 (멱등) — 정화 앞뒤로 두 번 도는 자리가 있다', () => {
    const once = finalizeYetHangul('<p>\uAC00\u11EB</p>');
    expect(finalizeYetHangul(once)).toBe(once);
  });
});

describe('normalizeYetHangul', () => {
  it('자모열과 대체 표기로 조합한 글자가 **같은 문자열**이 된다 — 안 그러면 같은 지문이 두 번 저장된다', () => {
    const fromJamo = normalizeYetHangul('\u1100\u1161\u11EB'); // 모델이 자모를 그대로 낸 경우
    const fromNotation = normalizeYetHangul(convertYetHangulNotation('\u27E6\u3131\u314F\u317F\u27E7'));
    expect(fromJamo).toBe(fromNotation);
  });

  it('NFC 가 남기는 섞인 모양(가+ᇫ)도 첫가끝으로 되돌린다 — 자모만 담은 안전망 글꼴이 그 모양을 못 합친다', () => {
    expect(normalizeYetHangul('\uAC00\u11EB')).toBe('\u1100\u1161\u11EB');
  });

  it('동국정운식 한자음(바+ᇰ)도 첫가끝으로 — 목록 줄·제목에서 깨지던 자리다', () => {
    expect(normalizeYetHangul('\uBC14\u11F0')).toBe('\u1107\u1161\u11F0');
  });

  it('첫가끝 입력은 그대로 둔다', () => {
    expect(normalizeYetHangul('\u1100\u1161\u11EB')).toBe('\u1100\u1161\u11EB');
  });

  it('현대 글자 뒤에 **초성**이 오면 새 음절이므로 풀지 않는다', () => {
    expect(normalizeYetHangul('\uAC00\u1100')).toBe('\uAC00\u1100');
  });

  it('초성 여럿으로 적은 어두 자음군도 한 음절로 둔다 — NFC 는 뒤쪽만 합쳐 `ᄇ사` 를 만든다', () => {
    expect(normalizeYetHangul('\u1107\u1109\u1161')).toBe('\u1107\u1109\u1161');
  });

  it('종성 뒤의 완성형은 **다음 음절**이라 풀지 않는다 (`ᄒᆞᆫ` + `글`)', () => {
    expect(normalizeYetHangul('\u1112\u119E\u11AB\uAE00')).toBe('\u1112\u119E\u11AB\uAE00');
  });

  it('옛한글이 없으면 자모 검사에서 끝난다 — 긴 현대 지문에 매번 풀기를 돌리지 않는다', () => {
    const modern = '<p>다음 글을 읽고 물음에 답하시오.</p>';
    expect(normalizeYetHangul(modern)).toBe(modern);
  });

  it('현대 글자는 완성형으로 합쳐진다 — 맥에서 복사해 온 자모열도 한 모양이 된다', () => {
    expect(normalizeYetHangul('\uD55C\uAE00'.normalize('NFD'))).toBe('\uD55C\uAE00');
  });

  it('두 번 돌려도 같다 (멱등)', () => {
    const once = normalizeYetHangul('\u1112\u119E\u11AB');
    expect(normalizeYetHangul(once)).toBe(once);
  });

  it('호환 자모(낱자)는 건드리지 않는다 — NFKC 였다면 조합형으로 바뀐다', () => {
    expect(normalizeYetHangul('\u318D')).toBe('\u318D');
  });
});
