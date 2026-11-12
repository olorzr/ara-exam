import { describe, expect, it } from 'vitest';
import { paperSaveProblem } from './paper-validate';
import type { OmrKeyPlan } from './omr-payload';

const item = (problemId: string, passageId: string | null = null) => ({ problemId, passageId });
const plan = (over: Partial<OmrKeyPlan>): OmrKeyPlan => ({
  items: [], blockers: [], subjectiveNos: [], multiNos: [], objectiveCount: 1, lastObjectiveNo: 1, ...over,
});

describe('paperSaveProblem', () => {
  it('비었거나 제목이 없거나 지문이 흩어지면 막는다', () => {
    expect(paperSaveProblem({ items: [], title: 't', omrPlan: null }, 'create')).toMatch(/담아/);
    expect(paperSaveProblem({ items: [item('a')], title: '  ', omrPlan: null }, 'edit')).toMatch(/제목/);
    expect(paperSaveProblem({ items: [item('a', 'P'), item('b'), item('c', 'P')], title: 't', omrPlan: null }, 'edit'))
      .toMatch(/떨어져/);
  });

  it('OMR 정답 모양·객관식 0 을 막고, 안내는 만들기/고치기가 다르다', () => {
    const blocked = plan({ blockers: [{ no: 2, reason: 'missing' }] as OmrKeyPlan['blockers'] });
    expect(paperSaveProblem({ items: [item('a')], title: 't', omrPlan: blocked }, 'edit')).toMatch(/OMR 로 채점할 수 없어요/);
    const none = plan({ objectiveCount: 0 });
    expect(paperSaveProblem({ items: [item('a')], title: 't', omrPlan: none }, 'create')).toMatch(/끄고 만들어/);
    expect(paperSaveProblem({ items: [item('a')], title: 't', omrPlan: none }, 'edit')).toMatch(/하나 이상/);
  });

  it('문제없으면 null', () => {
    expect(paperSaveProblem({ items: [item('a', 'P'), item('b', 'P')], title: 't', omrPlan: plan({}) }, 'edit')).toBeNull();
  });
});
