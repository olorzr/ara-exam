import { describe, it, expect } from 'vitest';
import { normalizeWorkTitle } from './work-title';

describe('normalizeWorkTitle', () => {
  it('낫표를 벗긴다 — 시험지는 「동백꽃」 으로 인쇄한다', () => {
    expect(normalizeWorkTitle('「동백꽃」')).toBe('동백꽃');
    expect(normalizeWorkTitle('『삼국유사』')).toBe('삼국유사');
  });

  it('꺾쇠·따옴표도 벗긴다 — 학교마다 표기가 다르다', () => {
    for (const raw of ['〈동백꽃〉', '《동백꽃》', '<동백꽃>', '"동백꽃"', '“동백꽃”', "'동백꽃'"]) {
      expect(normalizeWorkTitle(raw)).toBe('동백꽃');
    }
  });

  it('안쪽 기호는 남긴다 — 두 작품을 한 칸에 적은 경우 가운데 기호는 뜻이 있다', () => {
    expect(normalizeWorkTitle('「봄봄」 · 「동백꽃」')).toBe('봄봄」 · 「동백꽃');
  });

  it('카테고리 규칙을 그대로 이어받는다 — 괄호 앞 공백을 없앤다', () => {
    expect(normalizeWorkTitle('천재 (정호웅)')).toBe('천재(정호웅)');
  });

  it('앞뒤 공백을 다듬는다', () => {
    expect(normalizeWorkTitle('  동백꽃  ')).toBe('동백꽃');
    expect(normalizeWorkTitle('「 동백꽃 」')).toBe('동백꽃');
  });

  it('멱등이다 — 두 번 돌려도 값이 그대로여야 트리거와 앱이 갈라지지 않는다', () => {
    for (const raw of ['「동백꽃」', '천재 (정호웅)', '동백꽃', '']) {
      const once = normalizeWorkTitle(raw);
      expect(normalizeWorkTitle(once)).toBe(once);
    }
  });

  it('빈 값은 빈 값', () => {
    expect(normalizeWorkTitle('')).toBe('');
    expect(normalizeWorkTitle('「」')).toBe('');
  });

  it('지은이에도 쓴다', () => {
    expect(normalizeWorkTitle(' 김유정 ')).toBe('김유정');
  });
});
