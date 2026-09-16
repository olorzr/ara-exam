import { describe, expect, it } from 'vitest';
import { readPlainWithHandwriting } from './handwriting';
import { answersDroppedTotal, parsePrintQaAnswers } from './parse-answers';

const PLAIN = '점순이가 나를 보고 오늘은 웬일인지 미리 알은체를 한다.\n'
  + '2. 점순이의 행동에 드러난 심리를 서술하시오.';

const SHEET = {
  label: '개념지 · 동백꽃',
  plain: '점순이의 행동에는 관심을 숨기려는 마음이 담겨 있다.',
};

const ctx = (over: Partial<Parameters<typeof parsePrintQaAnswers>[1]> = {}) => ({
  plain: PLAIN, askedNos: [1, 2], ...over,
});

const raw = (answers: unknown[]) => JSON.stringify({ answers });

describe('parsePrintQaAnswers — 근거 대조', () => {
  it('프린트에 있는 근거는 출처가 빈 문자열이다 — 선생님이 손에 든 것이 그 프린트다', () => {
    const result = parsePrintQaAnswers(
      raw([{ no: 1, answer: '관심을 숨기려는 마음이다.', evidence: '미리 알은체를 한다' }]),
      ctx(),
    );
    expect(result?.answers).toEqual([
      { no: 1, answer: '관심을 숨기려는 마음이다.', evidence: '미리 알은체를 한다', source: '' },
    ]);
    expect(result?.withoutEvidence).toBe(0);
  });

  it('참고자료에서 온 근거에는 자료 이름이 찍힌다', () => {
    const result = parsePrintQaAnswers(
      raw([{ no: 1, answer: '관심을 숨기려는 마음', evidence: '관심을 숨기려는 마음이 담겨 있다' }]),
      ctx({ references: [SHEET] }),
    );
    expect(result?.answers[0].source).toBe('개념지 · 동백꽃');
  });

  it('⚠️ 프린트가 먼저다 — 양쪽에 있으면 프린트로 적는다', () => {
    const both = { label: '개념지 · 겹침', plain: PLAIN };
    const result = parsePrintQaAnswers(
      raw([{ no: 1, answer: '답', evidence: '미리 알은체를 한다' }]),
      ctx({ references: [both] }),
    );
    expect(result?.answers[0].source).toBe('');
  });

  it('⚠️ 근거를 못 찾아도 답은 남기고 근거만 버린다 — 찾을 수 없는 말을 인쇄하지 않는다', () => {
    const result = parsePrintQaAnswers(
      raw([{ no: 1, answer: '관심을 숨기려는 마음이다.', evidence: '어디에도 없는 구절이다' }]),
      ctx(),
    );
    expect(result?.answers[0]).toMatchObject({
      answer: '관심을 숨기려는 마음이다.', evidence: '', source: null,
    });
    expect(result?.withoutEvidence).toBe(1);
  });

  it('근거가 비어 있어도 답은 남는다 (모델이 못 찾았다고 말한 경우)', () => {
    const result = parsePrintQaAnswers(raw([{ no: 1, answer: '답이다.', evidence: '' }]), ctx());
    expect(result?.answers[0].source).toBeNull();
    expect(result?.withoutEvidence).toBe(1);
  });

  it('⚠️ 접으면 비는 근거는 통과시키지 않는다 — 빈 글자는 무엇에든 들어 있다', () => {
    const result = parsePrintQaAnswers(raw([{ no: 1, answer: '답이다.', evidence: '|' }]), ctx());
    expect(result?.answers[0].source).toBeNull();
  });

  it('띄어쓰기를 지우고 대조하지 않는다 — 그러면 지어낸 근거가 통과한다', () => {
    const result = parsePrintQaAnswers(
      raw([{ no: 1, answer: '답', evidence: '나를보고오늘은' }]), ctx(),
    );
    expect(result?.answers[0].source).toBeNull();
  });
});

describe('parsePrintQaAnswers — 모양', () => {
  it('물어보지 않은 번호는 버린다 — 어디에 붙일지 알 수 없다', () => {
    const result = parsePrintQaAnswers(raw([{ no: 9, answer: '답', evidence: '' }]), ctx());
    expect(result?.answers).toHaveLength(0);
    expect(result?.dropped.unknownNo).toBe(1);
  });

  it('같은 번호가 두 번 오면 앞엣것만 쓴다', () => {
    const result = parsePrintQaAnswers(
      raw([{ no: 1, answer: '먼저', evidence: '' }, { no: 1, answer: '나중', evidence: '' }]),
      ctx(),
    );
    expect(result?.answers).toHaveLength(1);
    expect(result?.answers[0].answer).toBe('먼저');
    expect(result?.dropped.duplicate).toBe(1);
  });

  it('빈 답·번호 없는 답은 버린다', () => {
    const result = parsePrintQaAnswers(
      raw([{ no: 1, answer: '  ', evidence: '' }, { answer: '답', evidence: '' }]), ctx(),
    );
    expect(result?.answers).toHaveLength(0);
    expect(result?.dropped.malformed).toBe(2);
    expect(answersDroppedTotal(result!.dropped)).toBe(2);
  });

  it('모양이 깨지면 null — 빈 배열과 다르다', () => {
    expect(parsePrintQaAnswers('{', ctx())).toBeNull();
    expect(parsePrintQaAnswers(JSON.stringify({ answers: 'x' }), ctx())).toBeNull();
    expect(parsePrintQaAnswers(raw([]), ctx())).not.toBeNull();
  });
});

describe('parsePrintQaAnswers — 손글씨는 근거가 아니다 (코덱스 3R)', () => {
  const html = '<p>1. 표현법은? 답: <em>직유이다.</em></p>';
  const { plain, ranges } = readPlainWithHandwriting(html, true);

  it('⚠️ 학생이 적은 답을 근거로 내세우면 프린트 근거로 치지 않는다', () => {
    const result = parsePrintQaAnswers(
      JSON.stringify({ answers: [{ no: 1, answer: '은유이다.', evidence: '직유이다.' }] }),
      { plain, askedNos: [1], handwritten: ranges },
    );
    expect(result?.answers[0].source).toBeNull();
    expect(result?.withoutEvidence).toBe(1);
  });

  it('인쇄된 글에서 온 근거는 그대로 통과한다', () => {
    const result = parsePrintQaAnswers(
      JSON.stringify({ answers: [{ no: 1, answer: '은유이다.', evidence: '표현법은?' }] }),
      { plain, askedNos: [1], handwritten: ranges },
    );
    expect(result?.answers[0].source).toBe('');
  });

  it('손글씨 자리를 안 넘기면 예전처럼 본문 전체를 본다', () => {
    const result = parsePrintQaAnswers(
      JSON.stringify({ answers: [{ no: 1, answer: '은유이다.', evidence: '직유이다.' }] }),
      { plain, askedNos: [1] },
    );
    expect(result?.answers[0].source).toBe('');
  });
});

describe('parsePrintQaAnswers — 손글씨는 참고자료로도 되살아나지 않는다 (코덱스 4R)', () => {
  const html = '<p>1. 표현법은? 답: <em>직유이다.</em></p>';
  const { plain, ranges } = readPlainWithHandwriting(html, true);

  it('⚠️ 같은 프린트가 참고자료로 붙어 있어도 아이 답은 근거가 아니다', () => {
    // 참고자료 본문은 평문이라 손글씨 표시가 없다 — 그 길로 되살아나면 안 된다
    const result = parsePrintQaAnswers(
      JSON.stringify({ answers: [{ no: 1, answer: '은유이다.', evidence: '직유이다.' }] }),
      {
        plain,
        askedNos: [1],
        handwritten: ranges,
        references: [{ label: '학교 프린트 · 같은 것', plain }],
      },
    );
    expect(result?.answers[0].source).toBeNull();
    expect(result?.withoutEvidence).toBe(1);
  });
});
