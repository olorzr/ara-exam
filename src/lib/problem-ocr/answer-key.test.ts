import { describe, it, expect } from 'vitest';
import { applyAnswerKey, maxProblemNumber } from './answer-key';
import type { ProblemDraft } from './merge';
import { toWarningObject, warningText } from './warnings';

function draft(over: Partial<ProblemDraft> = {}): ProblemDraft {
  return {
    id: 'p1', passage_id: null, number: 1, question_type: '객관식',
    stem_html: '<p>물음</p>', choices: ['가', '나', '다', '라', '마'],
    answer: null, score: null, work_title: '', area_path: [], unit_path: [], page_no: 1,
    box: null, has_figure: false, ...over,
  };
}

/** 경고를 한 줄로 이어 본다 */
const said = (res: { warnings: Parameters<typeof warningText>[0][] }) =>
  res.warnings.map(warningText).join(' | ');

describe('applyAnswerKey', () => {
  it('빈 정답을 채운다', () => {
    const problems = [draft({ number: 1 })];
    const res = applyAnswerKey(problems, [{ no: 1, answer: '3' }]);
    expect(problems[0].answer).toBe('3');
    expect(res.filled).toBe(1);
  });

  it('이미 있는 정답은 덮어쓰지 않고 충돌로 알린다 — 검수한 값이 우선이다', () => {
    const problems = [draft({ number: 1, answer: '2' })];
    const res = applyAnswerKey(problems, [{ no: 1, answer: '5' }]);
    expect(problems[0].answer).toBe('2');
    expect(res.conflicts).toEqual([{ id: 'p1', number: 1, current: '2', fromKey: '5' }]);
    expect(said(res)).toContain('덮어쓰지 않았어요');
    // 두 값을 함께 보여 준다 — 개수만 알려 주면 원본을 다시 열어야 한다
    expect(said(res)).toContain('1번(입력 2 · 정답표 5)');
    expect(toWarningObject(res.warnings[0]).targets?.[0]).toMatchObject({ id: 'p1' });
  });

  it('배점은 건드리지 않는다 — 정답표에서 읽지도 않는다', () => {
    const problems = [draft({ number: 1, answer: null, score: 5 })];
    applyAnswerKey(problems, [{ no: 1, answer: '1' }]);
    expect(problems[0].score).toBe(5);
    expect(problems[0].answer).toBe('1');
  });

  it('정답 모양으로 유형을 바로잡는다 — 본문만 보고 잘못 판단했을 수 있다', () => {
    const problems = [draft({ number: 1, question_type: '객관식', choices: [] })];
    applyAnswerKey(problems, [{ no: 1, answer: '역설법' }]);
    expect(problems[0].question_type).toBe('주관식');
  });

  it('선지가 있고 정답이 번호면 객관식으로 둔다', () => {
    const problems = [draft({ number: 1, question_type: '주관식' })];
    applyAnswerKey(problems, [{ no: 1, answer: '4' }]);
    expect(problems[0].question_type).toBe('객관식');
  });

  it('같은 번호가 여럿이면 붙이지 않는다 — 잘못 붙이는 것보다 낫다', () => {
    const problems = [draft({ id: 'a', number: 1, page_no: 1 }), draft({ id: 'b', number: 1, page_no: 5 })];
    const res = applyAnswerKey(problems, [{ no: 1, answer: '3' }]);
    expect(problems[0].answer).toBeNull();
    expect(problems[1].answer).toBeNull();
    expect(said(res)).toContain('여러 곳');
    // 후보를 전부 짚는다 — 어느 것인지는 사람이 원본을 보고 정한다
    expect(toWarningObject(res.warnings[0]).targets?.map((t) => t.id)).toEqual(['a', 'b']);
  });

  it('붙일 문항이 없으면 알린다 — 조용히 버리지 않는다', () => {
    const res = applyAnswerKey([draft({ number: 1 })], [{ no: 99, answer: '1' }]);
    expect(res.unmatched).toEqual([99]);
    expect(said(res)).toContain('99');
  });

  it('번호가 없는 문항은 대상에서 빠진다', () => {
    const problems = [draft({ number: null })];
    const res = applyAnswerKey(problems, [{ no: 1, answer: '1' }]);
    expect(problems[0].answer).toBeNull();
    expect(res.unmatched).toEqual([1]);
  });

  it('못 찾은 번호가 많으면 줄여서 보여 준다', () => {
    const rows = Array.from({ length: 12 }, (_, i) => ({ no: i + 1, answer: '1' }));
    const res = applyAnswerKey([], rows);
    expect(said(res)).toContain('외 4개');
  });
});

describe('maxProblemNumber', () => {
  it('가장 큰 번호를 돌려준다', () => {
    expect(maxProblemNumber([draft({ number: 3 }), draft({ number: 21 })])).toBe(21);
  });

  it('번호 없는 문항은 무시한다', () => {
    expect(maxProblemNumber([draft({ number: null }), draft({ number: 5 })])).toBe(5);
  });

  it('번호가 하나도 없으면 null — 범위를 지어내지 않는다', () => {
    expect(maxProblemNumber([draft({ number: null })])).toBeNull();
    expect(maxProblemNumber([])).toBeNull();
  });
});
