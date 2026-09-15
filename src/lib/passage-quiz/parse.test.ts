import { describe, it, expect } from 'vitest';
import { PASSAGE_QUIZ_MAX_PER_TYPE } from './constants';
import { droppedTotal, parsePassageQuiz } from './parse';

const PLAIN = '나 보기가 역겨워 가실 때에는 말없이 고이 보내 드리오리다.\n'
  + '영변에 약산 진달래꽃 아름 따다 가실 길에 뿌리오리다.';

const ctx = (over: Partial<Parameters<typeof parsePassageQuiz>[1]> = {}) => ({
  plain: PLAIN, counts: { ox: null, short: null }, ...over,
});
const raw = (ox: unknown[], short: unknown[] = []) => JSON.stringify({ ox, short });

const OX = { statement: '화자는 떠나는 이를 붙잡지 않는다.', answer: 'O', evidence: '말없이 고이 보내 드리오리다' };
const SHORT = { question: '화자가 길에 뿌리겠다고 한 꽃은?', answer: '진달래꽃', evidence: '영변에 약산 진달래꽃' };

describe('parsePassageQuiz', () => {
  it('근거가 지문에 있는 문항을 통과시킨다', () => {
    const result = parsePassageQuiz(raw([OX], [SHORT]), ctx());
    expect(result?.ox).toEqual([
      { statement: OX.statement, answer: 'O', evidence: OX.evidence, source: '' },
    ]);
    expect(result?.short).toEqual([
      { question: SHORT.question, answer: '진달래꽃', evidence: SHORT.evidence, source: '' },
    ]);
    expect(droppedTotal(result!.dropped)).toBe(0);
  });

  it('모양이 깨지면 null — 빈 배열과 다르다', () => {
    expect(parsePassageQuiz('{', ctx())).toBeNull();
    expect(parsePassageQuiz(JSON.stringify({}), ctx())).toBeNull();
    expect(parsePassageQuiz(JSON.stringify({ ox: [], short: 'x' }), ctx())).toBeNull();
  });

  it('빈 배열은 정상이다 — 낼 것이 없다고 본 응답이다', () => {
    const result = parsePassageQuiz(raw([], []), ctx());
    expect(result).not.toBeNull();
    expect(result?.ox).toHaveLength(0);
    expect(result?.short).toHaveLength(0);
  });

  it('지문에 없는 근거는 버린다 — 채점할 자리가 없다', () => {
    const result = parsePassageQuiz(
      raw([{ ...OX, evidence: '님은 갔습니다 아아 사랑하는 나의 님은' }]), ctx(),
    );
    expect(result?.ox).toHaveLength(0);
    expect(result?.dropped.evidenceNotInText).toBe(1);
  });

  it('지문에 없는 단답형 답은 버린다 — 학생이 찾아 쓸 수 없다', () => {
    const result = parsePassageQuiz(raw([], [{ ...SHORT, answer: '개나리' }]), ctx());
    expect(result?.short).toHaveLength(0);
    expect(result?.dropped.answerNotInText).toBe(1);
  });

  it('띄어쓰기를 지우고 대조하지 않는다 — 그러면 지어낸 말이 통과한다', () => {
    // 지문의 '가실 길에' 를 '가실길에' 로 붙여 적은 근거는 그대로 통과하지만(기호·줄바꿈만 접는다),
    // 어절 경계를 넘어 붙인 말은 통과하면 안 된다
    const result = parsePassageQuiz(
      raw([{ ...OX, evidence: '보기가역겨워가실' }]), ctx(),
    );
    expect(result?.ox).toHaveLength(0);
    expect(result?.dropped.evidenceNotInText).toBe(1);
  });

  it('O·X 가 아닌 답은 버리고, ○·× 는 받아 준다', () => {
    const bad = parsePassageQuiz(raw([{ ...OX, answer: '참' }]), ctx());
    expect(bad?.ox).toHaveLength(0);
    expect(bad?.dropped.malformed).toBe(1);

    const good = parsePassageQuiz(raw([{ ...OX, answer: '×' }]), ctx());
    expect(good?.ox[0].answer).toBe('X');
  });

  it('빈 문장·빈 근거·빈 답은 버린다', () => {
    const result = parsePassageQuiz(
      raw([{ ...OX, statement: '  ' }, { ...OX, evidence: '' }], [{ ...SHORT, answer: '' }]),
      ctx(),
    );
    expect(result?.ox).toHaveLength(0);
    expect(result?.short).toHaveLength(0);
    expect(result?.dropped.malformed).toBe(3);
  });

  it('접으면 빈 글자가 되는 값은 대조를 통과하지 못한다', () => {
    // '|' 나 '#' 는 접으면 빈 글자가 되는데, 빈 글자는 **무엇에든 들어 있어** 그냥 통과한다
    const result = parsePassageQuiz(
      raw([{ ...OX, evidence: '#' }], [{ ...SHORT, answer: '|' }]), ctx(),
    );
    expect(result?.ox).toHaveLength(0);
    expect(result?.short).toHaveLength(0);
    expect(result?.dropped.malformed).toBe(2);
  });

  it('검사에 걸려 버린 문항이 멀쩡한 같은 물음의 자리를 뺏지 않는다', () => {
    // 앞의 것은 답이 지문에 없어 버려진다. 뒤의 것은 멀쩡한데 '중복'으로 몰려 함께 사라지면 안 된다
    const result = parsePassageQuiz(raw([], [
      { ...SHORT, answer: '개나리' },
      { ...SHORT, answer: '진달래꽃' },
    ]), ctx());
    expect(result?.short).toHaveLength(1);
    expect(result?.short[0].answer).toBe('진달래꽃');
    expect(result?.dropped.answerNotInText).toBe(1);
    expect(result?.dropped.duplicate).toBe(0);
  });

  it('물려받은 속성 이름을 O/X 로 받지 않는다', () => {
    // 객체로 짠 별칭표는 '__proto__' 를 물려받은 속성으로 내주어 O 도 X 도 아닌 값이 통과한다
    for (const answer of ['__proto__', 'constructor', 'toString']) {
      const result = parsePassageQuiz(raw([{ ...OX, answer }]), ctx());
      expect(result?.ox).toHaveLength(0);
      expect(result?.dropped.malformed).toBe(1);
    }
  });

  it('같은 문장을 두 번 내면 한 번만 받는다', () => {
    const result = parsePassageQuiz(raw([OX, { ...OX }]), ctx());
    expect(result?.ox).toHaveLength(1);
    expect(result?.dropped.duplicate).toBe(1);
  });

  it('요청한 개수까지만 받는다', () => {
    const many = Array.from({ length: 5 }, (_, i) => ({
      ...OX, statement: `화자는 떠나는 이를 붙잡지 않는다 ${i}.`,
    }));
    const result = parsePassageQuiz(raw(many), ctx({ counts: { ox: 2, short: null } }));
    expect(result?.ox).toHaveLength(2);
  });

  it('0 을 요청하면 그 유형은 빈 배열이다', () => {
    const result = parsePassageQuiz(raw([OX], [SHORT]), ctx({ counts: { ox: 0, short: null } }));
    expect(result?.ox).toHaveLength(0);
    expect(result?.short).toHaveLength(1);
  });

  it('개수를 안 정해도 상한을 넘기지 않는다 — 스키마만 믿지 않는다', () => {
    const many = Array.from({ length: PASSAGE_QUIZ_MAX_PER_TYPE + 4 }, (_, i) => ({
      ...OX, statement: `화자는 떠나는 이를 붙잡지 않는다 ${i}.`,
    }));
    const result = parsePassageQuiz(raw(many), ctx());
    expect(result?.ox).toHaveLength(PASSAGE_QUIZ_MAX_PER_TYPE);
  });
});

describe('parsePassageQuiz — 참고자료', () => {
  const SHEET = { label: '개념지 · 진달래꽃', plain: '이 시의 화자는 이별의 정한을 반어로 드러낸다.' };

  it('참고자료에만 있는 근거도 받아 주고 어느 자료인지 돌려준다', () => {
    const item = {
      statement: '화자는 반어로 정서를 드러낸다.', answer: 'O',
      evidence: '이별의 정한을 반어로 드러낸다',
    };
    const result = parsePassageQuiz(raw([item]), ctx({ references: [SHEET] }));
    expect(result?.ox).toHaveLength(1);
    expect(result?.ox[0].source).toBe(SHEET.label);
  });

  it('참고자료를 안 주면 그 근거는 예전처럼 버려진다 — 프롬프트와 파서는 한 쌍이다', () => {
    const item = {
      statement: '화자는 반어로 정서를 드러낸다.', answer: 'O',
      evidence: '이별의 정한을 반어로 드러낸다',
    };
    expect(parsePassageQuiz(raw([item]), ctx())?.dropped.evidenceNotInText).toBe(1);
    expect(parsePassageQuiz(raw([item]), ctx({ references: [] }))?.dropped.evidenceNotInText).toBe(1);
  });

  it('양쪽에 다 있으면 지문이 이긴다 — 채점하는 사람은 지문부터 편다', () => {
    const both = { label: '전문 · 진달래꽃', plain: PLAIN };
    const result = parsePassageQuiz(raw([OX]), ctx({ references: [both] }));
    expect(result?.ox[0].source).toBe('');
  });

  it('두 자료에 걸쳐 이어 붙인 근거는 버린다 — 한 자료 안에 그대로 있어야 한다', () => {
    const result = parsePassageQuiz(
      raw([{ ...OX, evidence: '고이 보내 드리오리다 이 시의 화자는' }]),
      ctx({ references: [SHEET] }),
    );
    expect(result?.ox).toHaveLength(0);
    expect(result?.dropped.evidenceNotInText).toBe(1);
  });

  it('단답형 답도 참고자료에서 찾는다', () => {
    const item = {
      question: '화자의 정서를 드러내는 표현법은?', answer: '반어',
      evidence: '이별의 정한을 반어로 드러낸다',
    };
    const result = parsePassageQuiz(raw([], [item]), ctx({ references: [SHEET] }));
    expect(result?.short).toHaveLength(1);
    expect(result?.short[0].source).toBe(SHEET.label);
  });

  it('본문이 빈 참고자료는 없는 셈 친다 — 빈 글자는 무엇에든 들어 있다', () => {
    const result = parsePassageQuiz(
      raw([{ ...OX, evidence: '님은 갔습니다 아아' }]),
      ctx({ references: [{ label: '빈 자료', plain: '   ' }] }),
    );
    expect(result?.ox).toHaveLength(0);
    expect(result?.dropped.evidenceNotInText).toBe(1);
  });
});
