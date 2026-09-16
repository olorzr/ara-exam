import { describe, expect, it } from 'vitest';
import { PRINT_QA_LEAD_MAX } from './constants';
import {
  clipLead, innerLead, preambleLead, stripPlainMarkers, stripTrailingLabel,
} from './lead';

describe('stripTrailingLabel', () => {
  it('물음 번호가 혼자 있는 마지막 줄을 뗀다 — 두면 번호가 두 번 찍힌다', () => {
    expect(stripTrailingLabel('앞 설명이다.\n3.', '3')).toBe('앞 설명이다.\n');
    expect(stripTrailingLabel('앞 설명이다.\n(2) ', '(2)')).toBe('앞 설명이다.\n');
  });

  it('번호가 앞글과 한 줄에 있어도 뗀다', () => {
    expect(stripTrailingLabel('…있다. 3. ', '3')).toBe('…있다.');
  });

  it('⚠️ 번호를 모르면 떼지 않는다 — 떼면 주어진 값이 사라진다 (코덱스 33R)', () => {
    expect(stripTrailingLabel('앞 설명이다.\n12)', '')).toBe('앞 설명이다.\n12)');
    expect(stripTrailingLabel('앞 설명이다.\n12)', '12')).toBe('앞 설명이다.\n');
  });

  it('⚠️ 동그라미 번호도 뗀다 — 구두점이 없어 남던 자리 (코덱스 33R 블로킹)', () => {
    expect(stripTrailingLabel('지문이다. ①', '①')).toBe('지문이다.');
  });

  it('⚠️ 번호가 제 줄에 있고 뒤에 줄바꿈이 남아도 뗀다 (Stop 게이트)', () => {
    expect(stripTrailingLabel('지문 본문입니다.\n1.\n', '1')).toBe('지문 본문입니다.\n');
  });

  it('⚠️ 괄호 번호도 알맹이로 견주어 뗀다 — 번호가 두 번 찍힌다 (코덱스 26R 블로킹)', () => {
    expect(stripTrailingLabel('지문이다. (1)', '(1)')).toBe('지문이다.');
  });

  it('⚠️ 알아보는 기호는 떼는 쪽도 알아야 한다 — `ㄱ；` (코덱스 23R 블로킹)', () => {
    expect(stripTrailingLabel('지문이다. ㄱ；', 'ㄱ')).toBe('지문이다.');
  });

  it('⚠️ 글 끝의 멀쩡한 숫자는 건드리지 않는다 — 줄 전체가 번호일 때만 뗀다', () => {
    expect(stripTrailingLabel('이 작품은 1930년대', '')).toBe('이 작품은 1930년대');
    expect(stripTrailingLabel('보기는 모두 3', '')).toBe('보기는 모두 3');
  });
});

describe('stripPlainMarkers', () => {
  it('제목 표시(#)를 뗀다 — 학생이 받는 문제지에 찍히면 안 된다', () => {
    expect(stripPlainMarkers('# 동백꽃\n본문')).toBe('동백꽃\n본문');
    expect(stripPlainMarkers('## 어휘 풀이')).toBe('어휘 풀이');
  });

  it('표는 가운뎃점으로 잇는다 — 지우기만 하면 두 칸이 한 낱말로 붙는다', () => {
    expect(stripPlainMarkers('| 시어 | 뜻 |')).toBe('시어 · 뜻');
  });

  it('행 한가운데서 잘린 조각도 걷어낸다 — 줄 앞에 공백이 남는다', () => {
    expect(stripPlainMarkers(' |\n다음 글을 읽고')).toBe('\n다음 글을 읽고');
  });

  it('목록 표시(-)는 남긴다 — 인쇄물에서도 그대로 읽힌다', () => {
    expect(stripPlainMarkers('- 첫째\n- 둘째')).toBe('- 첫째\n- 둘째');
  });
});

describe('clipLead', () => {
  it('⚠️ 너무 길면 뒤쪽을 남기고 **잘랐다고 알린다** (코덱스 5R)', () => {
    const text = `${'가'.repeat(PRINT_QA_LEAD_MAX)}\n마지막 줄`;
    const out = clipLead(text);
    expect(out.text.length).toBeLessThanOrEqual(PRINT_QA_LEAD_MAX);
    expect(out.text.endsWith('마지막 줄')).toBe(true);
    expect(out.truncated).toBe(true);
  });

  it('상한 안이면 그대로 둔다', () => {
    expect(clipLead('  짧은 앞글  ')).toEqual({ text: '짧은 앞글', truncated: false });
  });
});

describe('preambleLead', () => {
  const plain = '# 동백꽃\n다음 글을 읽고 물음에 답하시오.\n1. 서술자는?';

  it('첫 물음 앞의 글에서 기호와 번호를 떼어 돌려준다', () => {
    const start = plain.indexOf('서술자는?');
    expect(preambleLead(plain, start, '1'))
      .toEqual({ lead: '동백꽃\n다음 글을 읽고 물음에 답하시오.', blocked: false, truncated: false });
  });

  it('답 표시를 걷어내지 않는다 — 승인 전에는 학생 문제지에 안 나간다', () => {
    const arrow = '→ 다음 시를 읽고 답하시오.\n시의 전문\n1. 화자는?';
    const start = arrow.indexOf('화자는?');
    expect(preambleLead(arrow, start, '1').lead).toBe('→ 다음 시를 읽고 답하시오.\n시의 전문');
  });

  it('⚠️ 번호가 제 줄에 있는 멀쩡한 문항의 지문은 그대로 싣는다 (Stop 게이트)', () => {
    const split = '지문 본문입니다.\n1.\n첫 물음?';
    expect(preambleLead(split, split.indexOf('첫 물음?'), '1').lead).toBe('지문 본문입니다.');
  });

  it('⚠️ 못 옮긴 문답이 섞여 있어도 버리지 않는다 — 승인 게이트가 막는다 (코덱스 11R)', () => {
    const missed = '1. 첫 물음?\n비밀정답\n2. 둘째 물음?';
    expect(preambleLead(missed, missed.indexOf('둘째 물음?'), '2').lead).toContain('비밀정답');
    expect(preambleLead(missed, missed.indexOf('둘째 물음?'), '2').blocked).toBe(false);
  });

  it('⚠️ 번호 없이 놓인 맨 숫자 줄은 주어진 값이다 — 떼지 않는다 (코덱스 14R)', () => {
    const given = '다음 수를 보고 답하시오.\n5\n절댓값은?';
    expect(preambleLead(given, given.indexOf('절댓값은?'), '').lead)
      .toBe('다음 수를 보고 답하시오.\n5');
  });

  it('⚠️ 문장 끝의 숫자는 번호가 아니다 — 기호가 붙은 번호만 뗀다 (코덱스 21R 블로킹)', () => {
    const value = '지문 끝의 값은 1\n물음?';
    expect(preambleLead(value, value.indexOf('물음?'), '1').lead).toBe('지문 끝의 값은 1');
  });

  it('⚠️ 번호를 뗀 뒤 또 떼지 않는다 — 주어진 값이 사라진다 (코덱스 31R 블로킹)', () => {
    const given = '다음 숫자를 한글로 쓰시오.\n1\n1. 위 숫자를 한글로 쓰면?';
    expect(preambleLead(given, given.indexOf('위 숫자를'), '1').lead)
      .toBe('다음 숫자를 한글로 쓰시오.\n1');
  });

  it('⚠️ 소수점은 문장 끝이 아니다 — 값의 소수 부분이 깎인다 (코덱스 34R 블로킹)', () => {
    const value = '1. 다음 값을 보시오.\n3.1.\n소수 부분은?';
    expect(preambleLead(value, value.indexOf('소수 부분은?'), '1').lead)
      .toBe('1. 다음 값을 보시오.\n3.1.');
  });

  it('⚠️ 괄호 친 주어진 값은 남의 번호가 아니다 (코덱스 33R 블로킹)', () => {
    const given = '다음 수를 보고 물음에 답하시오.\n(5)\n1. 절댓값은?';
    expect(preambleLead(given, given.indexOf('절댓값은?'), '1').lead)
      .toBe('다음 수를 보고 물음에 답하시오.\n(5)');
  });

  it('⚠️ 문장 안의 숫자는 번호가 아니다 — 문장이 끝난 자리의 번호만 뗀다 (코덱스 22R 블로킹)', () => {
    const value = '1.\n주어진 수는 1.\n값을 쓰시오.';
    expect(preambleLead(value, value.indexOf('값을 쓰시오.'), '1').lead)
      .toBe('1.\n주어진 수는 1.');
  });

  it('잘라 올 것이 없으면 빈 문자열', () => {
    expect(preambleLead(plain, 0, '1')).toEqual({ lead: '', blocked: false, truncated: false });
  });

  it('목록으로 인쇄된 문답도 버리지 않는다 — 승인 게이트가 막는다 (코덱스 11R)', () => {
    const list = '- 1. 첫 물음?\n- 답: 비밀정답\n- 2. 둘째 물음?';
    expect(preambleLead(list, list.indexOf('둘째 물음?'), '2').blocked).toBe(false);
  });
});

describe('innerLead', () => {
  it('⚠️ 물음과 답 사이의 지문을 챙긴다 — 안 챙기면 어디에도 안 남는다 (코덱스 14R)', () => {
    const plain = '1. 다음 글의 갈래는?\n봄이 왔다.\n답: 소설';
    const out = innerLead(plain, plain.indexOf('?') + 1, plain.indexOf('소설'));
    // 끝에 덩그러니 남는 '답:' 은 뗀다 — 답 자체는 다음 자리에 있다
    expect(out).toEqual({ lead: '봄이 왔다.', blocked: false, truncated: false });
  });

  it('사이가 비어 있으면 빈 문자열', () => {
    expect(innerLead('1. 갈래는? 답: 소설', 10, 5).lead).toBe('');
  });
});
