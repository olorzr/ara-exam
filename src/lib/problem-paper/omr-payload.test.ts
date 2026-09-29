import { describe, it, expect } from 'vitest';
import {
  buildOmrAnswerKey,
  describeOmrBlockers,
  describeOmrPlan,
  normalizeChoiceAnswer,
  omrEligible,
  omrSheetCountOf,
  type OmrKeySource,
} from './omr-payload';

const FIVE = ['가', '나', '다', '라', '마'];

function mc(answer: string, choices: string[] = FIVE): OmrKeySource {
  return { question_type: '객관식', answer, choices };
}
function sub(answer = '', type: '주관식' | '서술형' = '주관식'): OmrKeySource {
  return { question_type: type, answer, choices: [] };
}

describe('normalizeChoiceAnswer — ara-system app/lib/choiceAnswer.ts 와 같은 결과', () => {
  // ⚠️ 이 표는 ara-system __tests__/lib/choiceAnswer.test.ts 의 표와 같다 — 한쪽만 고치지 말 것
  it.each([
    ['3', '3'], [' 3 ', '3'], ['1,4', '1,4'], ['4,1', '1,4'], ['1, 4', '1,4'],
    ['4，1', '4，1'], ['1 4', '1 4'], ['1,1,4', '1,4'], ['5,3,1', '1,3,5'],
    ['O', 'O'], ['14', '14'], ['0', '0'], ['1,가', '1,가'], ['', ''],
    ['1,', '1,'], [',1', ',1'], ['1,,3', '1,,3'], [' 1 , 4 ', '1,4'],
  ])('%j → %j', (raw, want) => {
    expect(normalizeChoiceAnswer(raw)).toBe(want);
  });
});

describe('buildOmrAnswerKey', () => {
  it('번호는 문제지 안의 자리이고, 복수 정답은 규범 꼴로 보낸다', () => {
    const plan = buildOmrAnswerKey([mc('3'), sub('서술 답'), mc('4,1')]);
    expect(plan.items).toEqual([
      { no: 1, answer: '3', type: '객관식' },
      { no: 2, answer: '서술 답', type: '주관식' },
      { no: 3, answer: '1,4', type: '객관식' },
    ]);
    expect(plan.blockers).toEqual([]);
    expect(plan.multiNos).toEqual([3]);
    expect(plan.subjectiveNos).toEqual([2]);
    expect(plan.objectiveCount).toBe(2);
    expect(plan.lastObjectiveNo).toBe(3);
    expect(omrEligible(plan)).toBe(true);
  });

  it('서술형도 주관식으로 보내고 빈 정답을 허용한다', () => {
    const plan = buildOmrAnswerKey([mc('1'), sub('', '서술형')]);
    expect(plan.items[1]).toEqual({ no: 2, answer: '', type: '주관식' });
    expect(omrEligible(plan)).toBe(true);
  });

  it.each([
    ['미입력', mc(''), 'missing'],
    ['⑥', mc('6'), 'out_of_range'],
    ['복수에 ⑥', mc('1,6'), 'out_of_range'],
    ['4지선다의 ⑤', mc('5', ['가', '나', '다', '라']), 'out_of_range'],
    ['글자', mc('ㄱ'), 'malformed'],
    ['원문자', mc('③'), 'malformed'],
    ['끝에 붙은 쉼표', mc('1,'), 'malformed'],
    ['겹친 쉼표', mc('1,,3'), 'malformed'],
    ['공백 구분', mc('1 4'), 'malformed'],
    ['전각 쉼표', mc('4，1'), 'malformed'],
  ])('객관식 %s 는 막는다', (_label, item, reason) => {
    const plan = buildOmrAnswerKey([mc('1'), item]);
    expect(plan.blockers).toEqual([{ no: 2, reason }]);
    expect(omrEligible(plan)).toBe(false);
  });

  it('선지를 그림이 통째로 든 문항(선지 0개)은 90A 칸 수(5)만 본다', () => {
    expect(omrEligible(buildOmrAnswerKey([mc('5', [])]))).toBe(true);
    expect(omrEligible(buildOmrAnswerKey([mc('6', [])]))).toBe(false);
  });

  it('객관식이 하나도 없으면 OMR 로 채점할 수 없다', () => {
    expect(omrEligible(buildOmrAnswerKey([sub('가'), sub('나')]))).toBe(false);
  });
});

describe('답안지 장 수 — 버블로 채점하는 마지막 번호로 잰다', () => {
  it('90문항 이하는 한 장, 91번이 객관식이면 두 장', () => {
    const ninety = Array.from({ length: 90 }, () => mc('1'));
    expect(omrSheetCountOf(buildOmrAnswerKey(ninety))).toBe(1);
    expect(omrSheetCountOf(buildOmrAnswerKey([...ninety, mc('2')]))).toBe(2);
  });

  it('91번부터 주관식뿐이면 한 장이면 된다', () => {
    const ninety = Array.from({ length: 90 }, () => mc('1'));
    expect(omrSheetCountOf(buildOmrAnswerKey([...ninety, sub(), sub()]))).toBe(1);
  });

  it('객관식이 없으면 0장', () => {
    expect(omrSheetCountOf(buildOmrAnswerKey([sub()]))).toBe(0);
  });
});

describe('안내 문구', () => {
  it('막힌 문항을 번호와 까닭으로 알린다', () => {
    expect(describeOmrBlockers([{ no: 3, reason: 'missing' }, { no: 7, reason: 'out_of_range' }]))
      .toBe('3번 정답 미입력 · 7번 정답이 ①~⑤ 밖');
  });

  it('많으면 줄여 쓴다', () => {
    const many = Array.from({ length: 9 }, (_, i) => ({ no: i + 1, reason: 'missing' as const }));
    expect(describeOmrBlockers(many)).toMatch(/외 3개$/);
  });

  it('막히면 block, 주관식·복수 정답은 info, 알릴 것이 없으면 null', () => {
    expect(describeOmrPlan(buildOmrAnswerKey([mc('')]))?.tone).toBe('block');
    expect(describeOmrPlan(buildOmrAnswerKey([sub()]))?.tone).toBe('block');
    const info = describeOmrPlan(buildOmrAnswerKey([mc('1,4'), sub()]));
    expect(info?.tone).toBe('info');
    expect(info?.text).toContain('주관식·서술형 1문항');
    expect(info?.text).toContain('복수 정답 1문항');
    expect(describeOmrPlan(buildOmrAnswerKey([mc('2')]))).toBeNull();
  });
});
