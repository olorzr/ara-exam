import { describe, expect, it } from 'vitest';
import { countAnswerMarks, hasAnswerMarkLeft, isAnswerMark, stripTrailingMark } from './marks';

describe('isAnswerMark', () => {
  it('⚠️ 낱말 한복판의 답은 표시가 아니다 — `대답:` 은 대화 자료다 (코덱스 14R 블로킹)', () => {
    const line = '대답: 학교에 갑니다.';
    expect(isAnswerMark(line, line.indexOf('답:'))).toBe(false);
  });

  it('줄머리·공백 뒤의 표시는 답 표시다', () => {
    expect(isAnswerMark('답: 소설', 0)).toBe(true);
    expect(isAnswerMark('갈래는? 답: 소설', '갈래는? '.length)).toBe(true);
    expect(isAnswerMark('갈래는? 정답: 소설', '갈래는? '.length)).toBe(true);
  });
});

describe('hasAnswerMarkLeft', () => {
  it('⚠️ 자르는 규칙과 **같은 범위**를 본다 — 대화 자료에 경고를 붙이지 않는다', () => {
    expect(hasAnswerMarkLeft('질문: 어디 가세요?\n대답: 학교에 갑니다.')).toBe(false);
    expect(hasAnswerMarkLeft('갈래는? 답:')).toBe(true);
    expect(hasAnswerMarkLeft('갈래는? → 소설')).toBe(true);
  });
});

describe('stripTrailingMark', () => {
  it('앞글 끝에 덩그러니 남은 답 표시를 뗀다 — 답은 다음 자리에 있다', () => {
    expect(stripTrailingMark('봄이 왔다.\n답:')).toBe('봄이 왔다.');
    expect(stripTrailingMark('봄이 왔다.')).toBe('봄이 왔다.');
  });

  it('⚠️ 화살표는 부르는 쪽이 허락해야 뗀다 — 그림의 일부일 수 있다 (코덱스 27R)', () => {
    expect(stripTrailingMark('얼음 →')).toBe('얼음 →');
    expect(stripTrailingMark('갈래는? →', true)).toBe('갈래는?');
  });

  it('⚠️ 표시가 없으면 닫는 따옴표를 건드리지 않는다 (코덱스 27R 블로킹)', () => {
    expect(stripTrailingMark('그는 “봄이다”')).toBe('그는 “봄이다”');
  });

  it('⚠️ 짝이 맞는 따옴표 안의 표시는 인용이다 (코덱스 29R 블로킹)', () => {
    expect(stripTrailingMark('표기는 "답:"')).toBe('표기는 "답:"');
    // 짝이 안 맞으면 여는 따옴표다 — 그 뒤의 답은 다음 자리에 있다
    expect(stripTrailingMark('봄이 왔다. 답: "')).toBe('봄이 왔다.');
  });
});

describe('stripTrailingMark — 코덱스 16R', () => {
  it('⚠️ 낱말 한복판이면 떼지 않는다 — `대답:` 이 `대` 로 남으면 안 된다 (블로킹)', () => {
    const dialogue = '질문: 어디에 갑니까?\n대답:';
    expect(stripTrailingMark(dialogue)).toBe(dialogue);
  });
});

describe('countAnswerMarks', () => {
  it('⚠️ 목록 힌트도 같은 규칙을 쓴다 — 대화 프린트를 문답으로 권하지 않는다', () => {
    expect(countAnswerMarks('답: 소설\n정답: 시')).toBe(2);
    expect(countAnswerMarks('질문: 어디?\n대답: 학교')).toBe(0);
  });
});
