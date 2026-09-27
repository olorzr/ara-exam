import { describe, expect, it } from 'vitest';
import { QUESTION_KIND_TYPES, kindOf, parseQuestionKind } from './question-kind';

describe('kindOf', () => {
  it("'객관식' 만 객관식 갈래다", () => {
    expect(kindOf('객관식')).toBe('objective');
  });

  /** 갈래는 둘이라 '서술형' 이 '주관식' 에 든다 — 이것이 이 모듈의 존재 이유다 */
  it("'주관식' 과 '서술형' 은 같은 갈래다", () => {
    expect(kindOf('주관식')).toBe('subjective');
    expect(kindOf('서술형')).toBe('subjective');
  });
});

describe('QUESTION_KIND_TYPES', () => {
  it('갈래를 펴면 DB 값 셋을 빠짐없이 덮는다', () => {
    expect([...QUESTION_KIND_TYPES.objective, ...QUESTION_KIND_TYPES.subjective])
      .toEqual(['객관식', '주관식', '서술형']);
  });
});

describe('parseQuestionKind', () => {
  it('아는 값만 받는다', () => {
    expect(parseQuestionKind('objective')).toBe('objective');
    expect(parseQuestionKind('subjective')).toBe('subjective');
  });

  /** 주소는 사람이 고쳐 칠 수 있다 — 오타로 목록이 0건이 되면 까닭을 알 수 없다 */
  it('모르는 값·빈 값은 전체로 본다', () => {
    expect(parseQuestionKind('서술형')).toBe('');
    expect(parseQuestionKind(null)).toBe('');
    expect(parseQuestionKind(undefined)).toBe('');
    expect(parseQuestionKind('')).toBe('');
  });
});
