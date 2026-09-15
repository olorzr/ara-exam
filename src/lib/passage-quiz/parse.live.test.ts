import { describe, it, expect } from 'vitest';
import { droppedTotal, parsePassageQuiz } from './parse';

/**
 * 실제 코덱스 응답을 그대로 고정한다 (2026-09-15, 진달래꽃 · O,X 3 + 단답형 2 요청).
 *
 * 검증을 조일 때마다 **멀쩡한 응답까지 걸러지는지** 확인할 자리가 필요하다 —
 * 지어낸 값을 막는 규칙은 성한 값을 막기도 쉽다.
 */
const PLAIN = `나 보기가 역겨워
가실 때에는
말없이 고이 보내 드리오리다

영변에 약산
진달래꽃
아름 따다 가실 길에 뿌리오리다

가시는 걸음 걸음
놓인 그 꽃을
사뿐히 즈려밟고 가시옵소서

나 보기가 역겨워
가실 때에는
죽어도 아니 눈물 흘리오리다`;

const RAW = JSON.stringify({
  ox: [
    {
      statement: '화자는 자신을 떠나는 이를 아무 말 없이 보내 주겠다고 한다.',
      answer: 'O',
      evidence: '나 보기가 역겨워\n가실 때에는\n말없이 고이 보내 드리오리다',
    },
    {
      statement: '화자는 떠나는 이에게 길에 놓인 꽃을 힘껏 밟고 가라고 청한다.',
      answer: 'X',
      evidence: '가시는 걸음 걸음\n놓인 그 꽃을\n사뿐히 즈려밟고 가시옵소서',
    },
    {
      statement: '화자는 상대가 떠날 때 어떤 일이 있어도 눈물을 흘리지 않겠다고 말한다.',
      answer: 'O',
      evidence: '나 보기가 역겨워\n가실 때에는\n죽어도 아니 눈물 흘리오리다',
    },
  ],
  short: [
    {
      question: '화자가 꽃을 따려는 곳으로 영변과 함께 언급한 지명은 무엇인가?',
      answer: '약산',
      evidence: '영변에 약산\n진달래꽃\n아름 따다 가실 길에 뿌리오리다',
    },
    {
      question: '화자가 떠나는 이의 길에 뿌리겠다고 한 꽃은 무엇인가?',
      answer: '진달래꽃',
      evidence: '진달래꽃\n아름 따다 가실 길에 뿌리오리다',
    },
  ],
});

describe('parsePassageQuiz — 실제 응답', () => {
  it('요청한 개수 그대로 통과시키고 하나도 버리지 않는다', () => {
    const result = parsePassageQuiz(RAW, { plain: PLAIN, counts: { ox: 3, short: 2 } });
    expect(result?.ox).toHaveLength(3);
    expect(result?.short).toHaveLength(2);
    expect(droppedTotal(result!.dropped)).toBe(0);
    expect(result?.ox.map((i) => i.answer)).toEqual(['O', 'X', 'O']);
    expect(result?.short.map((i) => i.answer)).toEqual(['약산', '진달래꽃']);
  });

  it('여러 줄에 걸친 근거도 지문에서 찾아낸다 — 줄바꿈은 접어서 본다', () => {
    const result = parsePassageQuiz(RAW, { plain: PLAIN, counts: { ox: null, short: null } });
    expect(result?.ox[0].evidence).toContain('\n');
    expect(result?.dropped.evidenceNotInText).toBe(0);
  });
});
