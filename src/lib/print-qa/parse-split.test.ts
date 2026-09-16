import { describe, expect, it } from 'vitest';
import { readPlainWithHandwriting } from './handwriting';
import { parsePrintQaSplit, splitDroppedTotal } from './parse-split';

/** 광희중 프린트 모양 — 머리글 + 지문 + 'N. 물음 … 답: 정답' */
const HTML = '<h3>동백꽃</h3>'
  + '<p>다음 글을 읽고 물음에 답하시오.</p>'
  + '<p>점순이가 나를 보고 오늘은 웬일인지 미리 알은체를 한다.</p>'
  + '<p>1. 이 글의 서술자는 누구인가? 답: 나(소년)</p>'
  + '<p>2. 점순이의 행동에 드러난 심리를 서술하시오.</p>'
  + '<p>3. 밑줄 친 부분의 표현법은? 답: <em>은유법</em></p>';

/** 읽기 경로와 **같은 함수**로 평문·손글씨 자리를 얻는다(따로 만들면 좌표가 어긋난다) */
const read = (includeHandwriting = false) => readPlainWithHandwriting(HTML, includeHandwriting);

const ctx = (includeHandwriting = false, over: Partial<Parameters<typeof parsePrintQaSplit>[1]> = {}) => {
  const { plain, ranges } = read(includeHandwriting);
  return { plain, handwritten: ranges, seed: 't', ...over };
};

const raw = (items: unknown[], over: Record<string, unknown> = {}) => JSON.stringify({
  items, work_title: '', work_author: '', warnings: [], ...over,
});

const Q1 = { label: '1', question: '이 글의 서술자는 누구인가?', answer: '나(소년)' };
const Q2 = { label: '2', question: '점순이의 행동에 드러난 심리를 서술하시오.', answer: '' };
const Q3 = { label: '3', question: '밑줄 친 부분의 표현법은?', answer: '은유법' };

describe('parsePrintQaSplit — 원문 대조', () => {
  it('원문에 있는 물음·답을 통과시키고 자리를 찾는다', () => {
    const result = parsePrintQaSplit(raw([Q1, Q2, Q3]), ctx());
    expect(result?.items).toHaveLength(3);
    expect(result?.items[0]).toMatchObject({
      id: 't-0', label: '1', question: Q1.question, answer: '나(소년)',
      answerSource: 'printed', studentAnswer: '', verified: true,
    });
    expect(result?.items[1].answerSource).toBe('none');
    expect(splitDroppedTotal(result!.dropped)).toBe(0);
  });

  it('첫 물음의 앞글에 머리글·지문이 붙고 기호·번호는 떨어진다', () => {
    const result = parsePrintQaSplit(raw([Q1, Q2, Q3]), ctx());
    expect(result?.items[0].lead).toBe(
      '동백꽃\n다음 글을 읽고 물음에 답하시오.\n'
      + '점순이가 나를 보고 오늘은 웬일인지 미리 알은체를 한다.',
    );
    // 앞 문항의 답 뒤부터 잘리므로 2번 앞에는 남는 글이 없다
    expect(result?.items[1].leadApproved).toBe(false);
  });

  it('⚠️ 원문에 없는 물음도 버리지 않는다 — 문항이 통째로 사라지는 쪽이 더 나쁘다', () => {
    const result = parsePrintQaSplit(
      raw([{ ...Q1, question: '이 글의 서술자를 쓰시오.' }]), ctx(),
    );
    expect(result?.items).toHaveLength(1);
    expect(result?.items[0].verified).toBe(false);
    // 자리를 못 찾았으니 앞글도 붙이지 않는다(무엇이 '앞' 인지 알 수 없다)
    expect(result?.items[0].leadApproved).toBe(false);
  });

  it('⚠️ 원문에 없는 답은 비운다 — 지어낸 답이 "인쇄된 답" 으로 들어가면 안 된다', () => {
    const result = parsePrintQaSplit(raw([{ ...Q2, answer: '부끄러움과 서운함' }]), ctx());
    expect(result?.items[0].answer).toBe('');
    expect(result?.items[0].answerSource).toBe('none');
    expect(result?.dropped.answerNotInText).toBe(1);
  });

  it('같은 물음이 두 번 오면 한 번만 담는다', () => {
    const result = parsePrintQaSplit(raw([Q1, { ...Q1 }]), ctx());
    expect(result?.items).toHaveLength(1);
    expect(result?.dropped.duplicate).toBe(1);
  });

  it('모양이 깨지면 null — 빈 배열과 다르다', () => {
    expect(parsePrintQaSplit('{', ctx())).toBeNull();
    expect(parsePrintQaSplit(JSON.stringify({}), ctx())).toBeNull();
    expect(parsePrintQaSplit(JSON.stringify({ items: 'x' }), ctx())).toBeNull();
  });

  it('빈 배열은 정상이다 — 문답이 아닌 프린트다', () => {
    const result = parsePrintQaSplit(raw([]), ctx());
    expect(result).not.toBeNull();
    expect(result?.items).toHaveLength(0);
  });

  it('작품은 인쇄돼 있을 때만 받는다', () => {
    const result = parsePrintQaSplit(raw([Q1], { work_title: '동백꽃', work_author: '김유정' }), ctx());
    expect(result?.work).toEqual({ title: '동백꽃', author: '김유정' });
    expect(parsePrintQaSplit(raw([Q1]), ctx())?.work).toEqual({ title: '', author: '' });
  });
});

describe('parsePrintQaSplit — 손글씨', () => {
  it('손글씨를 읽은 묶음에서는 <em> 자리의 답이 학생 답이 된다', () => {
    const result = parsePrintQaSplit(raw([Q3]), ctx(true));
    expect(result?.items[0]).toMatchObject({
      answer: '은유법', answerSource: 'handwritten', studentAnswer: '은유법',
    });
  });

  it('⚠️ 손글씨를 안 읽은 묶음에서는 <em> 을 보지 않는다 — 인쇄된 기울임일 뿐이다', () => {
    const result = parsePrintQaSplit(raw([Q3]), ctx(false));
    expect(result?.items[0].answerSource).toBe('printed');
    expect(result?.items[0].studentAnswer).toBe('');
  });

  it('인쇄된 답은 손글씨로 보지 않는다', () => {
    const result = parsePrintQaSplit(raw([Q1, Q3]), ctx(true));
    expect(result?.items[0].answerSource).toBe('printed');
    expect(result?.items[1].answerSource).toBe('handwritten');
  });
});

describe('parsePrintQaSplit — 앞글에 답이 새지 않는다 (코덱스 리뷰: 블로킹)', () => {
  it('⚠️ 앞 문항을 못 찾으면 다음 문항에 앞글을 붙이지 않는다 — 안 그러면 답이 문제지에 찍힌다', () => {
    const result = parsePrintQaSplit(
      // 1번 물음을 다듬어 적어 자리를 못 찾게 한다
      raw([{ ...Q1, question: '이 글의 서술자를 쓰시오.' }, Q2]), ctx(),
    );
    expect(result?.items[0].verified).toBe(false);
    expect(result?.items[1].leadApproved).toBe(false);
  });

  it('⚠️ 답을 비운 문항 뒤의 답 줄도 승인 전에는 학생 문제지에 안 나간다 (코덱스 13R)', () => {
    const result = parsePrintQaSplit(
      // 1번 답을 원문과 다르게 적으면 답은 비워지고 끝 자리는 물음 끝이 된다
      raw([{ ...Q1, answer: '나 (소년)' }, Q2]), ctx(),
    );
    expect(result?.items[0].answer).toBe('');
    // ⚠️ **버리지 않는다**(코덱스 13R). 그 자리에 지문이 섞여 있을 수 있어 편집 화면·교사용
    //    에는 보여 주고, 학생 문제지로 나가는 길만 승인으로 막는다
    expect(result?.items[1].lead).toContain('나(소년)');
    expect(result?.items[1].leadApproved).toBe(false);
  });

  it('⚠️ 답이 물음보다 앞에서 잡혀도 끝 자리가 뒤로 물러서지 않는다', () => {
    // 3번의 답('은유법')을 2번 답으로 적으면 2번 물음보다 뒤이지만, 반대 경우를 만든다:
    // 2번 답으로 1번 답('나(소년)')을 적으면 그 자리는 2번 물음보다 **앞**이다
    const result = parsePrintQaSplit(raw([Q2, { ...Q3, answer: '나(소년)' }]), ctx());
    expect(result?.items[1].lead).not.toContain('점순이의 행동에 드러난 심리');
  });
});

describe('parsePrintQaSplit — 번호가 같은 물음', () => {
  it('⚠️ 번호가 다르면 같은 물음이라도 살린다 — 프린트가 실제로 그렇게 생겼다', () => {
    const plain = '1. 빈칸에 알맞은 말을 쓰시오.\n2. 빈칸에 알맞은 말을 쓰시오.';
    const result = parsePrintQaSplit(
      raw([
        { label: '1', question: '빈칸에 알맞은 말을 쓰시오.', answer: '' },
        { label: '2', question: '빈칸에 알맞은 말을 쓰시오.', answer: '' },
      ]),
      { plain, handwritten: [], seed: 't' },
    );
    expect(result?.items).toHaveLength(2);
    expect(result?.dropped.duplicate).toBe(0);
  });

  it('번호까지 같으면 한 번만 담는다', () => {
    const result = parsePrintQaSplit(raw([Q1, { ...Q1 }]), ctx());
    expect(result?.items).toHaveLength(1);
    expect(result?.dropped.duplicate).toBe(1);
  });
});

describe('parsePrintQaSplit — 코덱스 2R 회귀', () => {
  /** 자리를 직접 만든 본문으로 시험한다 */
  const from = (plain: string) => ({ plain, handwritten: [], seed: 't' });

  it('⚠️ 표 칸에 든 답도 승인 전에는 학생 문제지에 안 나간다 (코덱스 13R)', () => {
    const plain = '| 첫 물음? | 답: 비밀정답 |\n2. 둘째 물음?';
    const result = parsePrintQaSplit(
      raw([
        { label: '', question: '첫 물음?', answer: '' },
        { label: '2', question: '둘째 물음?', answer: '' },
      ]),
      from(plain),
    );
    // 표 한 행에는 답과 지문이 함께 실린다 — 버리면 지문까지 사라져 승인 게이트로 가른다
    expect(result?.items[1].lead).toContain('비밀정답');
    expect(result?.items[1].leadApproved).toBe(false);
  });

  it('⚠️ 두 줄에 걸친 답의 둘째 줄도 앞글에 남지 않는다 (블로킹)', () => {
    const plain = '1. 첫 물음?\n답: 첫째 이유\n둘째 이유\n2. 둘째 물음?';
    const result = parsePrintQaSplit(
      raw([
        { label: '1', question: '첫 물음?', answer: '' },
        { label: '2', question: '둘째 물음?', answer: '' },
      ]),
      from(plain),
    );
    expect(result?.items[1].leadApproved).toBe(false);
  });

  it('⚠️ 같은 물음이 지문마다 나와도 둘 다 살린다', () => {
    const plain = '[가] 지문\n(1) 표현법은? 답: 은유\n[나] 지문\n(1) 표현법은? 답: 직유';
    const result = parsePrintQaSplit(
      raw([
        { label: '(1)', question: '표현법은?', answer: '은유' },
        { label: '(1)', question: '표현법은?', answer: '직유' },
      ]),
      from(plain),
    );
    expect(result?.items).toHaveLength(2);
    expect(result?.items.map((i) => i.answer)).toEqual(['은유', '직유']);
    // 문항 사이의 글은 싣지 않는다 — 대신 못 실었다고 알린다
    expect(result?.items[1].leadApproved).toBe(false);
  });

  it('⚠️ 한 문항을 번호만 바꿔 두 번 내면 한 번만 담는다', () => {
    const plain = '1. 표현법은? 답: 은유';
    const result = parsePrintQaSplit(
      raw([
        { label: '1', question: '표현법은?', answer: '은유' },
        { label: '', question: '표현법은?', answer: '은유' },
      ]),
      from(plain),
    );
    expect(result?.items).toHaveLength(1);
    expect(result?.dropped.duplicate).toBe(1);
  });

  it('⚠️ 답을 제 구역 밖에서 찾아도 읽기 머리가 건너뛰지 않는다 — 뒤 문항이 밀리지 않는다', () => {
    // 1번 답('공통답')이 2번 뒤에도 나온다. 예전에는 1번이 그 먼 답에 걸려
    // 2번이 차례에서 통째로 밀려났다
    const plain = '1. 첫 물음?\n2. 둘째 물음?\n공통답\n[다] 새 지문\n3. 셋째 물음?';
    const result = parsePrintQaSplit(
      raw([
        { label: '1', question: '첫 물음?', answer: '공통답' },
        { label: '2', question: '둘째 물음?', answer: '' },
        { label: '3', question: '셋째 물음?', answer: '' },
      ]),
      from(plain),
    );
    expect(result?.items[1].verified).toBe(true);
    // 구역 밖에서 찾은 답은 짝이 어긋났을 수 있어 알린다
    expect(result?.dropped.answerOutOfRegion).toBe(1);
    // 1·2번의 끝을 확신할 수 없으니 뒤 문항의 앞글은 싣지 않고 **그 사실을 알린다**
    expect(result?.items[2].leadApproved).toBe(false);
  });
});

describe('parsePrintQaSplit — Stop 게이트 회귀 (답 누수)', () => {
  const from = (plain: string) => ({ plain, handwritten: [], seed: 't' });

  it('⚠️ 같은 줄에서 시작한 답의 **둘째 줄**도 새지 않는다', () => {
    const plain = '1. 첫 물음? 답: 첫째 이유\n둘째 비밀이유\n2. 둘째 물음?';
    const result = parsePrintQaSplit(
      raw([
        { label: '1', question: '첫 물음?', answer: '' },
        { label: '2', question: '둘째 물음?', answer: '' },
      ]),
      from(plain),
    );
    expect(result?.items[1].leadApproved).toBe(false);
  });

  it('⚠️ 표시 없이 적힌 답도 새지 않는다 — 답을 못 찾은 문항 뒤는 통째로 막는다', () => {
    const plain = '1. 첫 물음?\n비밀정답이다\n2. 둘째 물음?';
    const result = parsePrintQaSplit(
      raw([
        // 모델이 답을 조금 다르게 적어 원문에서 못 찾는 상황
        { label: '1', question: '첫 물음?', answer: '비밀 정답이다' },
        { label: '2', question: '둘째 물음?', answer: '' },
      ]),
      from(plain),
    );
    expect(result?.items[0].answer).toBe('');
    expect(result?.dropped.answerNotInText).toBe(1);
    expect(result?.items[1].leadApproved).toBe(false);
  });

  it('⚠️ 문항 사이의 글은 답을 제대로 찾았어도 싣지 않는다 — 답을 일부만 옮겼을 수 있다', () => {
    // `답: 첫째 이유` 만 옮기고 `둘째 비밀 이유` 를 남기는 경우를 기계는 가릴 수 없다(코덱스 4R)
    const plain = '1. 두 이유는? 답: 첫째 이유\n둘째 비밀 이유\n2. 둘째 물음?';
    const result = parsePrintQaSplit(
      raw([
        { label: '1', question: '두 이유는?', answer: '첫째 이유' },
        { label: '2', question: '둘째 물음?', answer: '' },
      ]),
      from(plain),
    );
    expect(result?.items[1].leadApproved).toBe(false);
  });
});

describe('parsePrintQaSplit — 코덱스 3R 회귀', () => {
  const from = (plain: string) => ({ plain, handwritten: [], seed: 't' });

  it('⚠️ 표시 없이 적힌 답도 앞글로 새지 않는다 — 앞 문항의 끝을 모르면 안 싣는다 (블로킹)', () => {
    const plain = '1. 첫 물음?\n비밀정답\n2. 다음 물음?';
    const result = parsePrintQaSplit(
      raw([
        { label: '1', question: '첫 물음?', answer: '' },
        { label: '2', question: '다음 물음?', answer: '' },
      ]),
      from(plain),
    );
    expect(result?.items[1].leadApproved).toBe(false);
  });

  it('⚠️ 한 문항을 두 번 내도 뒤에 있는 진짜 반복 문항을 밀어내지 않는다', () => {
    const plain = '[가] 지문\n1. 표현법은? 답: 은유\n[나] 지문\n2. 표현법은? 답: 직유';
    const result = parsePrintQaSplit(
      raw([
        { label: '1', question: '표현법은?', answer: '은유' },
        { label: '1', question: '표현법은?', answer: '은유' },
        { label: '2', question: '표현법은?', answer: '직유' },
      ]),
      from(plain),
    );
    expect(result?.items.map((i) => i.label)).toEqual(['1', '2']);
    expect(result?.items.map((i) => i.answer)).toEqual(['은유', '직유']);
  });

  it('사이에 글이 없으면 앞글도 비어 있다', () => {
    const plain = '1. 첫 물음? 답: 은유\n2. 둘째 물음? 답: 직유';
    const result = parsePrintQaSplit(
      raw([
        { label: '1', question: '첫 물음?', answer: '은유' },
        { label: '2', question: '둘째 물음?', answer: '직유' },
      ]),
      from(plain),
    );
    expect(result?.items[1].lead).toBe('');
  });
});

describe('parsePrintQaSplit — Stop 게이트 회귀 (중복 판정)', () => {
  const from = (plain: string) => ({ plain, handwritten: [], seed: 't' });

  it('⚠️ 번호·물음·답이 모두 같은 **진짜 반복 문항**을 지우지 않는다', () => {
    const plain = '[가] 시\n(1) 표현법은?\n답: 직유법\n[나] 시\n(1) 표현법은?\n답: 직유법';
    const result = parsePrintQaSplit(
      raw([
        { label: '(1)', question: '표현법은?', answer: '직유법' },
        { label: '(1)', question: '표현법은?', answer: '직유법' },
      ]),
      from(plain),
    );
    expect(result?.items).toHaveLength(2);
    expect(result?.dropped.duplicate).toBe(0);
  });

  it('⚠️ 번호가 하나뿐인데 두 번 내면 여전히 한 번만 담는다', () => {
    const plain = '1. 표현법은?\n답: 은유';
    const result = parsePrintQaSplit(
      raw([
        { label: '1', question: '표현법은?', answer: '은유' },
        { label: '1', question: '표현법은?', answer: '은유' },
      ]),
      from(plain),
    );
    expect(result?.items).toHaveLength(1);
    expect(result?.dropped.duplicate).toBe(1);
  });

  it('번호가 원문에 안 붙어 있으면 예전처럼 차례대로 앉힌다', () => {
    const plain = '표현법은?\n답: 은유\n표현법은?\n답: 직유';
    const result = parsePrintQaSplit(
      raw([
        { label: '가', question: '표현법은?', answer: '은유' },
        { label: '나', question: '표현법은?', answer: '직유' },
      ]),
      from(plain),
    );
    expect(result?.items.map((i) => i.answer)).toEqual(['은유', '직유']);
  });
});

describe('parsePrintQaSplit — Stop 게이트 회귀 (번호 부분 일치)', () => {
  const from = (plain: string) => ({ plain, handwritten: [], seed: 't' });

  it('⚠️ 번호 1 이 11 에 걸려 진짜 11번을 지우지 않는다', () => {
    const plain = '1. 표현법은?\n답: 은유\n11. 표현법은?\n답: 직유';
    const result = parsePrintQaSplit(
      raw([
        { label: '1', question: '표현법은?', answer: '은유' },
        { label: '1', question: '표현법은?', answer: '은유' },
        { label: '11', question: '표현법은?', answer: '직유' },
      ]),
      from(plain),
    );
    expect(result?.items.map((i) => i.label)).toEqual(['1', '11']);
    expect(result?.items.map((i) => i.answer)).toEqual(['은유', '직유']);
  });

  it("'3-1' 처럼 숫자가 둘인 번호도 제 자리를 찾는다", () => {
    const plain = '3. 표현법은?\n답: 은유\n3-1. 표현법은?\n답: 직유';
    const result = parsePrintQaSplit(
      raw([
        { label: '3-1', question: '표현법은?', answer: '직유' },
        { label: '3', question: '표현법은?', answer: '은유' },
      ]),
      from(plain),
    );
    // 모델이 차례를 바꿔 내도 번호로 제 자리를 찾는다
    expect(result?.items.map((i) => i.label)).toEqual(['3-1', '3']);
  });
});

describe('parsePrintQaSplit — 코덱스 4R · Stop 게이트 회귀', () => {
  const from = (plain: string) => ({ plain, handwritten: [], seed: 't' });

  it('⚠️ 모델이 차례를 바꿔 내도 앞글이 답을 담지 않는다 (블로킹)', () => {
    const plain = '1. 첫 물음?\n답: 비밀정답\n2. 둘째 물음?';
    const result = parsePrintQaSplit(
      raw([
        { label: '2', question: '둘째 물음?', answer: '' },
        { label: '1', question: '첫 물음?', answer: '' },
      ]),
      from(plain),
    );
    // 맨 앞 문항이 원문에서도 맨 앞일 때만 앞글을 싣는다
    expect(result?.items.every((item) => !item.leadApproved)).toBe(true);
  });

  it('⚠️ 역순 배치 뒤에도 뒤 문항 앞글에 답이 섞이지 않는다 (Stop 게이트)', () => {
    const plain = '1. 하나?\n2. 둘?\n3. 셋?\n답: 비밀정답\n4. 넷?';
    const result = parsePrintQaSplit(
      raw([
        { label: '1', question: '하나?', answer: '' },
        { label: '3', question: '셋?', answer: '' },
        { label: '2', question: '둘?', answer: '' },
        { label: '4', question: '넷?', answer: '' },
      ]),
      from(plain),
    );
    // 앞글은 붙되 **승인 전에는 학생 문제지에 안 나간다**
    expect(result?.items.every((item) => !item.leadApproved)).toBe(true);
  });

  it('첫 물음 앞의 지문은 그대로 실린다 — 학교 프린트의 보통 모양이다', () => {
    const plain = '동백꽃 - 김유정\n[본문 전체]\n1. 서술자는? 답: 나\n2. 심리는? 답: 부끄러움';
    const result = parsePrintQaSplit(
      raw([
        { label: '1', question: '서술자는?', answer: '나' },
        { label: '2', question: '심리는?', answer: '부끄러움' },
      ]),
      from(plain),
    );
    expect(result?.items[0].lead).toBe('동백꽃 - 김유정\n[본문 전체]');
  });
});

describe('parsePrintQaSplit — Stop 게이트 회귀 (빠뜨린 문항)', () => {
  const from = (plain: string) => ({ plain, handwritten: [], seed: 't' });

  it('⚠️ 모델이 1번 문항을 통째로 빠뜨려도 그 답이 앞글로 새지 않는다 (블로킹)', () => {
    const plain = '1. 첫 물음?\n비밀정답\n2. 둘째 물음?';
    const result = parsePrintQaSplit(
      raw([{ label: '2', question: '둘째 물음?', answer: '' }]),
      from(plain),
    );
    expect(result?.items[0].leadApproved).toBe(false);
  });

  it('맨 위에 정답표를 찍어 둔 프린트도 앞글을 싣지 않는다', () => {
    const plain = '정답표\n답: 1번 은유\n1. 서술자는?';
    const result = parsePrintQaSplit(
      raw([{ label: '1', question: '서술자는?', answer: '' }]),
      from(plain),
    );
    expect(result?.items[0].leadApproved).toBe(false);
  });

  it('⚠️ 번호가 줄을 나눠 인쇄돼도 멀쩡한 문항의 지문은 그대로 실린다 (Stop 게이트)', () => {
    const plain = '동백꽃 - 김유정\n[본문 전체]\n1.\n서술자는? 답: 나';
    const result = parsePrintQaSplit(
      raw([{ label: '1', question: '서술자는?', answer: '나' }]),
      from(plain),
    );
    expect(result?.items[0].lead).toBe('동백꽃 - 김유정\n[본문 전체]');
  });

  it('⚠️ 번호가 줄을 나눠 인쇄된 프린트에서도 빠뜨린 답이 새지 않는다 (Stop 게이트)', () => {
    const plain = '1.\n첫 물음?\n비밀정답\n2. 둘째 물음?';
    const result = parsePrintQaSplit(
      raw([{ label: '2', question: '둘째 물음?', answer: '' }]),
      from(plain),
    );
    expect(result?.items[0].leadApproved).toBe(false);
  });

  it('지문에 연도가 있어도 앞글은 그대로 실린다 — 숫자만으로 문항으로 보지 않는다', () => {
    const plain = '동백꽃 - 김유정\n1930년대에 발표된 작품이다.\n1. 서술자는? 답: 나';
    const result = parsePrintQaSplit(
      raw([{ label: '1', question: '서술자는?', answer: '나' }]),
      from(plain),
    );
    expect(result?.items[0].lead).toBe('동백꽃 - 김유정\n1930년대에 발표된 작품이다.');
  });
});

describe('parsePrintQaSplit — 코덱스 5R 회귀', () => {
  const from = (plain: string) => ({ plain, handwritten: [], seed: 't' });

  it('⚠️ 목록으로 인쇄된 프린트에서도 빠뜨린 답이 앞글로 새지 않는다 (블로킹)', () => {
    const plain = '- 1. 첫 물음?\n- 답: 비밀정답\n- 2. 둘째 물음?';
    const result = parsePrintQaSplit(
      raw([{ label: '2', question: '둘째 물음?', answer: '' }]),
      from(plain),
    );
    expect(result?.items[0].leadApproved).toBe(false);
  });

  it('⚠️ 물음에 섞여 온 답은 물음에서 가린다 (블로킹)', () => {
    const plain = '1. 서술자는 누구인가? 답: 나(소년)';
    const result = parsePrintQaSplit(
      raw([{ label: '1', question: '서술자는 누구인가? 답: 나(소년)', answer: '나(소년)' }]),
      from(plain),
    );
    // 답만 빈칸으로 바뀌고 답란은 남는다 — 물음을 깎지 않는 쪽이다
    expect(result?.items[0].question).not.toContain('나(소년)');
    expect(result?.items[0].question).toContain('서술자는 누구인가?');
    expect(result?.items[0].answer).toBe('나(소년)');
  });

  it('⚠️ 물음을 못 찾아 지문을 못 실으면 그 사실을 알린다 (블로킹)', () => {
    const plain = '필수 지문입니다.\n1. 서술자는 누구인가?';
    const result = parsePrintQaSplit(
      raw([{ label: '1', question: '서술자를 쓰시오.', answer: '' }]),
      from(plain),
    );
    expect(result?.items[0].verified).toBe(false);
  });

  it('⚠️ 번호가 앞 줄에 있어도 중복이 진짜 문항을 밀어내지 않는다 (블로킹)', () => {
    const plain = '1.\n표현법은?\n답: 은유\n2.\n표현법은?\n답: 직유';
    const result = parsePrintQaSplit(
      raw([
        { label: '1', question: '표현법은?', answer: '은유' },
        { label: '1', question: '표현법은?', answer: '은유' },
        { label: '2', question: '표현법은?', answer: '직유' },
      ]),
      from(plain),
    );
    expect(result?.items.map((i) => i.label)).toEqual(['1', '2']);
    expect(result?.items.map((i) => i.answer)).toEqual(['은유', '직유']);
  });

  it('⚠️ 차례를 바꿔 내도 답 구역은 원문 차례를 따른다 — 손글씨 판정이 틀어지면 안 된다 (블로킹)', () => {
    const html = '<p>1. 첫 물음?</p><p>답: 은유</p><p>2. 둘째 물음?</p><p>답: <em>은유</em></p>';
    const { plain, ranges } = readPlainWithHandwriting(html, true);
    const result = parsePrintQaSplit(
      raw([
        { label: '2', question: '둘째 물음?', answer: '은유' },
        { label: '1', question: '첫 물음?', answer: '은유' },
      ]),
      { plain, handwritten: ranges, seed: 't' },
    );
    const second = result?.items.find((item) => item.label === '2');
    expect(second?.answerSource).toBe('handwritten');
    expect(second?.studentAnswer).toBe('은유');
  });
});

describe('parsePrintQaSplit — 코덱스 6R 회귀', () => {
  const from = (plain: string) => ({ plain, handwritten: [], seed: 't' });

  it('⚠️ 동그라미 번호 문항을 빠뜨려도 그 답이 앞글로 새지 않는다 (블로킹)', () => {
    const plain = '① 갈래는? → 소설\n② 주제는?';
    const result = parsePrintQaSplit(
      raw([{ label: '②', question: '주제는?', answer: '' }]),
      from(plain),
    );
    expect(result?.items[0].leadApproved).toBe(false);
  });

  it('⚠️ 인용된 답 표시 뒤의 진짜 답도 문제지에 안 남는다 (Stop 게이트)', () => {
    const plain = '1. 「답: 가」의 뜻은? 답: 나';
    const result = parsePrintQaSplit(
      raw([{ label: '1', question: '「답: 가」의 뜻은? 답: 나', answer: '' }]),
      from(plain),
    );
    expect(result?.items[0].question).toBe('「답: 가」의 뜻은?');
  });

  it('⚠️ 답을 못 뽑아낸 물음에서도 표시 뒤가 문제지에 안 남는다 (블로킹)', () => {
    const plain = '1. 갈래는? 답: 소설';
    const result = parsePrintQaSplit(
      raw([{ label: '1', question: '갈래는? 답: 소설', answer: '' }]),
      from(plain),
    );
    expect(result?.items[0].question).toBe('갈래는?');
  });

  it('⚠️ 앞 줄이 멀쩡한 글줄이면 번호로 치지 않는다 — 진짜 문항이 밀려나면 안 된다 (블로킹)', () => {
    const plain = '예시 1개\n표현법은?\n답: 은유\n2.\n표현법은?\n답: 직유';
    const result = parsePrintQaSplit(
      raw([
        { label: '1', question: '표현법은?', answer: '은유' },
        { label: '1', question: '표현법은?', answer: '은유' },
        { label: '2', question: '표현법은?', answer: '직유' },
      ]),
      from(plain),
    );
    expect(result?.items.map((i) => i.answer)).toEqual(['은유', '직유']);
  });

  it('⚠️ 못 옮긴 문항이 끼어 있어도 앞 문항이 뒤 문항의 답을 가져가지 않는다 (블로킹)', () => {
    const plain = `1. 첫 물음?\n${'지'.repeat(700)}\n2. 둘째 물음?\n답: 공통답\n3. 셋째 물음?`;
    const result = parsePrintQaSplit(
      raw([
        { label: '1', question: '첫 물음?', answer: '공통답' },
        { label: '3', question: '셋째 물음?', answer: '' },
      ]),
      from(plain),
    );
    // 제 구역 밖에서 찾았으므로 답은 남기되 **알린다**
    expect(result?.items[0].answer).toBe('공통답');
    expect(result?.dropped.answerOutOfRegion).toBe(1);
  });
});

describe('parsePrintQaSplit — 코덱스 7R 회귀', () => {
  const from = (plain: string) => ({ plain, handwritten: [], seed: 't' });

  it('⚠️ 번호 없는 물음과 화살표 답이 앞글로 새지 않는다 (블로킹)', () => {
    const plain = '갈래는?\n→ 소설\n2. 서술자는 누구인가?';
    const result = parsePrintQaSplit(
      raw([{ label: '2', question: '서술자는 누구인가?', answer: '' }]),
      from(plain),
    );
    expect(result?.items[0].leadApproved).toBe(false);
  });

  it('⚠️ 긴 서술형 화살표 답도 앞글로 새지 않는다 (Stop 게이트)', () => {
    const long = `${'점순이의 행동에는 관심을 숨기려는 마음이 담겨 있다. '.repeat(3)}`;
    const plain = `갈래는?\n→ ${long}\n2. 서술자는 누구인가?`;
    const result = parsePrintQaSplit(
      raw([{ label: '2', question: '서술자는 누구인가?', answer: '' }]),
      from(plain),
    );
    expect(result?.items[0].leadApproved).toBe(false);
  });

  it('⚠️ 목록으로 인쇄된 번호도 남의 자리로 지켜 준다 (블로킹)', () => {
    const plain = '- 1. 표현법은?\n- 답: 은유\n- 2. 표현법은?\n- 답: 직유';
    const result = parsePrintQaSplit(
      raw([
        { label: '1', question: '표현법은?', answer: '은유' },
        { label: '1', question: '표현법은?', answer: '은유' },
        { label: '2', question: '표현법은?', answer: '직유' },
      ]),
      from(plain),
    );
    expect(result?.items.map((i) => i.label)).toEqual(['1', '2']);
    expect(result?.items.map((i) => i.answer)).toEqual(['은유', '직유']);
  });

  it('⚠️ 긴 답도 제 구역에서 찾는다 — 같은 글자의 딴 자리를 집어 오면 안 된다 (블로킹)', () => {
    const long = '가'.repeat(600);
    const html = `<p>1. 첫 물음?</p><p>답: ${long}</p><p>2. 둘째 물음?</p><p>답: <em>${long}</em></p>`;
    const { plain, ranges } = readPlainWithHandwriting(html, true);
    const result = parsePrintQaSplit(
      raw([
        { label: '1', question: '첫 물음?', answer: long },
        { label: '2', question: '둘째 물음?', answer: long },
      ]),
      { plain, handwritten: ranges, seed: 't' },
    );
    expect(result?.items[1].answerSource).toBe('handwritten');
    expect(result?.dropped.answerOutOfRegion).toBe(0);
  });
});

describe('parsePrintQaSplit — 코덱스 8R 회귀', () => {
  const from = (plain: string) => ({ plain, handwritten: [], seed: 't' });

  it('⚠️ 문제에 주어진 값은 지우지 않는다 (Stop 게이트)', () => {
    const plain = '1. 다음 수의 절댓값을 구하시오.\n5\n답: 5';
    const result = parsePrintQaSplit(
      raw([{ label: '1', question: '다음 수의 절댓값을 구하시오.\n5', answer: '5' }]),
      from(plain),
    );
    expect(result?.items[0].question).toBe('다음 수의 절댓값을 구하시오.\n5');
    expect(result?.items[0].answer).toBe('5');
  });

  it('⚠️ 같은 말이 딴 데도 있으면 지우지 않고 **알린다** — 주어진 값일 수 있다 (코덱스 11R)', () => {
    // `다음 수의 절댓값을 구하시오. (5) … 답: 5` 와 구조가 같아 기계는 가릴 수 없다.
    // 마지막 문항은 뒤에 같은 말이 없어 물음에 끌려 들어온 답으로 보고 뗀다
    const plain = '1. 첫 작품의 갈래는?\n소설\n2. 둘째 작품의 갈래는?\n소설';
    const result = parsePrintQaSplit(
      raw([
        { label: '1', question: '첫 작품의 갈래는?\n소설', answer: '소설' },
        { label: '2', question: '둘째 작품의 갈래는?\n소설', answer: '소설' },
      ]),
      from(plain),
    );
    // 지우지 않는다 — 대신 몇 개인지 세어 알린다
    expect(result?.items[1].question).toContain('소설');
    expect(result?.dropped.answerInQuestion).toBeGreaterThan(0);
  });

  it('⚠️ 표시로 밝혀 둔 답은 물음에서 뗀다 (코덱스 22R — 표시 없는 줄은 남기고 알린다)', () => {
    const plain = '1. 갈래는?\n답: 소설';
    const result = parsePrintQaSplit(
      raw([{ label: '1', question: '갈래는?\n답: 소설', answer: '소설' }]),
      from(plain),
    );
    expect(result?.items[0].question).toBe('갈래는?');
  });

  it('⚠️ 표시 없이 줄만 바꾼 말은 남기고 센다 — 주어진 값일 수 있다 (코덱스 22R)', () => {
    const plain = '1. 다음 수의 절댓값을 구하시오.\n5';
    const result = parsePrintQaSplit(
      raw([{ label: '1', question: '다음 수의 절댓값을 구하시오.\n5', answer: '5' }]),
      from(plain),
    );
    expect(result?.items[0].question).toBe('다음 수의 절댓값을 구하시오.\n5');
    expect(result?.dropped.answerInQuestion).toBe(1);
  });

  it('⚠️ 한 줄에 붙은 물음+답을 빠뜨려도 앞글로 새지 않는다 (블로킹)', () => {
    const plain = '갈래는? → 소설\n2. 시점은?\n답: 일인칭';
    const result = parsePrintQaSplit(
      raw([{ label: '2', question: '시점은?', answer: '일인칭' }]),
      from(plain),
    );
    expect(result?.items[0].leadApproved).toBe(false);
  });

  it('⚠️ 괄호 번호가 붙은 반복 물음을 둘 다 살린다 (블로킹)', () => {
    const plain = '(가) 표현법은?\n답: 은유\n(나) 표현법은?\n답: 직유';
    const result = parsePrintQaSplit(
      raw([
        { label: '(가)', question: '표현법은?', answer: '은유' },
        { label: '(나)', question: '표현법은?', answer: '직유' },
      ]),
      from(plain),
    );
    expect(result?.items).toHaveLength(2);
    expect(result?.items.map((i) => i.answer)).toEqual(['은유', '직유']);
  });
});

describe('parsePrintQaSplit — 코덱스 9R 회귀', () => {
  const from = (plain: string) => ({ plain, handwritten: [], seed: 't' });

  it('⚠️ 번호 없는 물음과 표시 없는 답도 앞글로 새지 않는다 (블로킹)', () => {
    const plain = '갈래는?\n소설\n1. 표현법은?\n답: 은유';
    const result = parsePrintQaSplit(
      raw([{ label: '1', question: '표현법은?', answer: '은유' }]),
      from(plain),
    );
    expect(result?.items[0].leadApproved).toBe(false);
  });

  it('⚠️ 화살표 줄이 든 지문은 안 싣고 알린다 — 그림인지 답인지 못 가린다 (Stop 게이트)', () => {
    const plain = '다음 변화 과정을 보고 답하시오.\n→ 얼음 → 물 → 수증기\n1. 무엇이 필요한가? 답: 열';
    const result = parsePrintQaSplit(
      raw([{ label: '1', question: '무엇이 필요한가?', answer: '열' }]),
      from(plain),
    );
    expect(result?.items[0].leadApproved).toBe(false);
  });

  it('⚠️ 빠뜨린 물음의 화살표 답이 앞글로 새지 않는다 (Stop 게이트)', () => {
    const plain = '물의 상태 변화 순서를 쓰시오.\n→ 얼음 → 물 → 수증기\n2. 무엇이 필요한가? 답: 열';
    const result = parsePrintQaSplit(
      raw([{ label: '2', question: '무엇이 필요한가?', answer: '열' }]),
      from(plain),
    );
    expect(result?.items[0].leadApproved).toBe(false);
  });

  it('⚠️ 물음 속에 답과 같은 말이 남으면 알린다 — 주어진 값일 수 있어 지우지 않는다', () => {
    const plain = '1. 다음 수의 절댓값을 구하시오.\n5\n답: 5';
    const result = parsePrintQaSplit(
      raw([{ label: '1', question: '다음 수의 절댓값을 구하시오.\n5', answer: '5' }]),
      from(plain),
    );
    expect(result?.items[0].question).toBe('다음 수의 절댓값을 구하시오.\n5');
    expect(result?.dropped.answerInQuestion).toBe(1);
  });
});

describe('parsePrintQaSplit — 코덱스 10R 회귀', () => {
  const from = (plain: string) => ({ plain, handwritten: [], seed: 't' });

  it('⚠️ 앞글은 **사람이 확인해야** 학생 문제지에 실린다 (구조 변경)', () => {
    const plain = '동백꽃 - 김유정\n[본문]\n1. 서술자는? 답: 나';
    const result = parsePrintQaSplit(
      raw([{ label: '1', question: '서술자는?', answer: '나' }]),
      from(plain),
    );
    expect(result?.items[0].lead).toBe('동백꽃 - 김유정\n[본문]');
    expect(result?.items[0].leadApproved).toBe(false);
  });

  it('⚠️ 콜론 번호도 남의 자리로 지켜 준다 (블로킹)', () => {
    const plain = '1: 표현법은?\n답: 은유\n2: 표현법은?\n답: 직유';
    const result = parsePrintQaSplit(
      raw([
        { label: '1', question: '표현법은?', answer: '은유' },
        { label: '1', question: '표현법은?', answer: '은유' },
        { label: '2', question: '표현법은?', answer: '직유' },
      ]),
      from(plain),
    );
    expect(result?.items.map((i) => i.label)).toEqual(['1', '2']);
    expect(result?.items.map((i) => i.answer)).toEqual(['은유', '직유']);
  });

  it('⚠️ 지문 끝의 숫자를 번호로 떼지 않는다 (블로킹)', () => {
    const plain = '마지막 숫자는 21\n1. 표현법은?\n답: 은유';
    const result = parsePrintQaSplit(
      raw([{ label: '1', question: '1. 표현법은?', answer: '은유' }]),
      from(plain),
    );
    expect(result?.items[0].lead).toBe('마지막 숫자는 21');
  });

  it('⚠️ 못 가린 답 표시가 남으면 지우지 말고 알린다 (구조 변경)', () => {
    const plain = '1. 갈래는?\n답:\n소설';
    const result = parsePrintQaSplit(
      raw([{ label: '1', question: '갈래는?\n답:\n소설', answer: '' }]),
      from(plain),
    );
    expect(result?.dropped.answerInQuestion).toBe(1);
  });

  it('⚠️ 물음 안의 그림은 자르지 않는다 (블로킹)', () => {
    const q = '다음 변화 과정을 보고 각 단계에서 필요한 에너지를 쓰시오.\n→ 얼음 → 물 → 수증기';
    const plain = `1. ${q}`;
    const result = parsePrintQaSplit(raw([{ label: '1', question: q, answer: '' }]), from(plain));
    expect(result?.items[0].question).toBe(q);
  });

  it('⚠️ 빈칸과 뒤따르는 지시문을 깎지 않는다 (블로킹)', () => {
    const q = '갈래는?\n답: ______ (이유도 쓰시오.)';
    const plain = `1. ${q}`;
    const result = parsePrintQaSplit(raw([{ label: '1', question: q, answer: '' }]), from(plain));
    expect(result?.items[0].question).toBe(q);
  });
});

describe('parsePrintQaSplit — 코덱스 11R 회귀', () => {
  const from = (plain: string) => ({ plain, handwritten: [], seed: 't' });

  it('⚠️ 지문을 버리지 않고 붙여 둔다 — 승인 전에는 학생 문제지에 안 나간다 (블로킹)', () => {
    const plain = '어디로 갔을까?\n시의 나머지\n1. 화자는? 답: 나';
    const result = parsePrintQaSplit(
      raw([{ label: '1', question: '화자는?', answer: '나' }]),
      from(plain),
    );
    expect(result?.items[0].lead).toContain('어디로 갔을까?');
    expect(result?.items[0].leadApproved).toBe(false);
  });

  it('⚠️ 문항 사이의 지문도 붙여 둔다 (블로킹)', () => {
    const plain = '1. 첫 물음? 답: 가\n[나] 새 지문\n2. 둘째 물음? 답: 나';
    const result = parsePrintQaSplit(
      raw([
        { label: '1', question: '첫 물음?', answer: '가' },
        { label: '2', question: '둘째 물음?', answer: '나' },
      ]),
      from(plain),
    );
    expect(result?.items[1].lead).toBe('[나] 새 지문');
    expect(result?.items[1].leadApproved).toBe(false);
  });

  it('⚠️ 표로 짠 번호도 남의 자리로 지켜 준다 (블로킹)', () => {
    const plain = '| 1 | 표현법은? | 은유 |\n| 2 | 표현법은? | 직유 |';
    const result = parsePrintQaSplit(
      raw([
        { label: '1', question: '표현법은?', answer: '은유' },
        { label: '1', question: '표현법은?', answer: '은유' },
        { label: '2', question: '표현법은?', answer: '직유' },
      ]),
      from(plain),
    );
    expect(result?.items.map((i) => i.label)).toEqual(['1', '2']);
  });

  it('⚠️ 물음 안의 손글씨 답은 앞 문항의 인쇄된 답에 밀리지 않는다 (블로킹)', () => {
    const html = '<p>1. 갈래는? 답: 소설</p><p>2. 갈래는? 답: <em>소설</em></p>';
    const { plain, ranges } = readPlainWithHandwriting(html, true);
    const result = parsePrintQaSplit(
      raw([
        { label: '1', question: '갈래는?', answer: '소설' },
        { label: '2', question: '갈래는?', answer: '소설' },
      ]),
      { plain, handwritten: ranges, seed: 't' },
    );
    expect(result?.items[1].answerSource).toBe('handwritten');
  });

  it('⚠️ 답 표시 뒤의 지시문을 지우지 않는다 (블로킹)', () => {
    const q = '갈래는?\n답: 한 단어로 쓰시오.\n판단 근거도 설명하시오.';
    const plain = `1. ${q}`;
    const result = parsePrintQaSplit(raw([{ label: '1', question: q, answer: '' }]), from(plain));
    expect(result?.items[0].question).toBe(q);
  });
});

describe('parsePrintQaSplit — 코덱스 13R 회귀', () => {
  const from = (plain: string) => ({ plain, handwritten: [], seed: 't' });

  it('⚠️ 표 한 행에 답과 함께 실린 지문을 잃지 않는다 (블로킹)', () => {
    const plain = '| 1. 갈래는? | 답: 소설 | 다음 글: 봄이 왔다. |\n2. 계절은?';
    const result = parsePrintQaSplit(
      raw([
        { label: '1', question: '갈래는?', answer: '소설' },
        { label: '2', question: '계절은?', answer: '' },
      ]),
      from(plain),
    );
    expect(result?.items[0].answer).toBe('소설');
    // 답 뒤의 글은 다음 문항의 앞글로 넘어가 **편집 화면과 교사용에 남는다**
    expect(result?.items[1].lead).toContain('봄이 왔다.');
    expect(result?.items[1].leadApproved).toBe(false);
  });

  it('⚠️ 전각 콜론 번호가 붙은 반복 물음을 둘 다 살린다 (블로킹)', () => {
    const plain = 'ㄱ： 표현법은?\n답: 은유\nㄴ： 표현법은?\n답: 직유';
    const result = parsePrintQaSplit(
      raw([
        { label: 'ㄱ', question: '표현법은?', answer: '은유' },
        { label: 'ㄴ', question: '표현법은?', answer: '직유' },
      ]),
      from(plain),
    );
    expect(result?.items).toHaveLength(2);
    expect(result?.dropped.duplicate).toBe(0);
    expect(result?.items[1].answer).toBe('직유');
  });

  it('⚠️ 두 줄로 적은 답의 뒷줄이 물음에 남으면 센다 (블로킹)', () => {
    const plain = '1. 이 인물의 태도를 설명하시오. 답: 상대를 존중하고\n상대의 처지를 배려한다.';
    const result = parsePrintQaSplit(
      raw([{
        label: '1',
        question: '이 인물의 태도를 설명하시오. 답: 상대를 존중하고\n상대의 처지를 배려한다.',
        answer: '',
      }]),
      from(plain),
    );
    expect(result?.items[0].question).toContain('상대의 처지를 배려한다.');
    expect(result?.dropped.answerInQuestion).toBe(1);
  });
});

describe('parsePrintQaSplit — 코덱스 14R 회귀', () => {
  const from = (plain: string) => ({ plain, handwritten: [], seed: 't' });

  it('⚠️ 물음과 답 **사이**의 지문을 잃지 않는다 (블로킹)', () => {
    const plain = '1. 다음 글의 갈래는?\n봄이 왔다. 소년은 마당으로 나갔다.\n답: 소설';
    const result = parsePrintQaSplit(
      raw([{ label: '1', question: '다음 글의 갈래는?', answer: '소설' }]),
      from(plain),
    );
    expect(result?.items[0].answer).toBe('소설');
    expect(result?.items[0].lead).toBe('봄이 왔다. 소년은 마당으로 나갔다.');
    expect(result?.items[0].leadApproved).toBe(false);
  });

  it('⚠️ 번호 앞에 놓인 주어진 값을 떼지 않는다 (블로킹)', () => {
    const plain = '다음 수를 보고 답하시오.\n5\n1. 절댓값은?';
    const result = parsePrintQaSplit(
      raw([{ label: '1', question: '절댓값은?', answer: '' }]),
      from(plain),
    );
    expect(result?.items[0].lead).toBe('다음 수를 보고 답하시오.\n5');
  });

  it('⚠️ 세미콜론 번호가 붙은 반복 물음에서 진짜 문항이 밀려나지 않는다 (블로킹)', () => {
    const plain = 'ㄱ； 표현법은?\n답: 은유\nㄴ； 표현법은?\n답: 직유';
    const result = parsePrintQaSplit(
      raw([
        { label: 'ㄱ', question: '표현법은?', answer: '은유' },
        { label: 'ㄱ', question: '표현법은?', answer: '은유' },
        { label: 'ㄴ', question: '표현법은?', answer: '직유' },
      ]),
      from(plain),
    );
    expect(result?.items.map((item) => [item.label, item.answer]))
      .toEqual([['ㄱ', '은유'], ['ㄴ', '직유']]);
    expect(result?.dropped.duplicate).toBe(1);
  });
});

describe('parsePrintQaSplit — 코덱스 15R 회귀', () => {
  const from = (plain: string) => ({ plain, handwritten: [], seed: 't' });

  it('⚠️ 마지막 문항 **뒤**에 놓인 지문도 챙긴다 (블로킹)', () => {
    const plain = '1. 다음 글의 갈래는?\n봄이 왔다. 꽃이 피었다.';
    const result = parsePrintQaSplit(
      raw([{ label: '1', question: '다음 글의 갈래는?', answer: '' }]),
      from(plain),
    );
    expect(result?.items[0].lead).toBe('봄이 왔다. 꽃이 피었다.');
    expect(result?.items[0].leadApproved).toBe(false);
  });

  it('⚠️ 기호가 둘 붙은 번호도 남의 자리로 지켜 준다 (블로킹)', () => {
    const plain = '(1). 표현법은? 답: 은유\n(2). 표현법은? 답: 직유';
    const result = parsePrintQaSplit(
      raw([
        { label: '1', question: '표현법은?', answer: '은유' },
        { label: '1', question: '표현법은?', answer: '은유' },
        { label: '2', question: '표현법은?', answer: '직유' },
      ]),
      from(plain),
    );
    expect(result?.items.map((item) => [item.label, item.answer]))
      .toEqual([['1', '은유'], ['2', '직유']]);
    expect(result?.dropped.duplicate).toBe(1);
  });

  it('⚠️ 물음에 섞여 온 답을 자르되 선택지는 남긴다 (블로킹)', () => {
    const plain = '1. 은유와 직유 중 이 시의 표현법은? 답: 은유';
    const result = parsePrintQaSplit(
      raw([{
        label: '1',
        question: '은유와 직유 중 이 시의 표현법은? 답: 은유',
        answer: '은유',
      }]),
      from(plain),
    );
    expect(result?.items[0].question).toBe('은유와 직유 중 이 시의 표현법은?');
    expect(result?.dropped.answerInQuestion).toBe(0);
  });
});

describe('parsePrintQaSplit — 코덱스 16R 회귀', () => {
  const from = (plain: string) => ({ plain, handwritten: [], seed: 't' });

  it('⚠️ 공백이 든 괄호 번호도 남의 자리로 지켜 준다 (블로킹)', () => {
    const plain = '( 1 ) 표현법은? 답: 은유\n( 2 ) 표현법은? 답: 직유';
    const result = parsePrintQaSplit(
      raw([
        { label: '1', question: '표현법은?', answer: '은유' },
        { label: '1', question: '표현법은?', answer: '은유' },
        { label: '2', question: '표현법은?', answer: '직유' },
      ]),
      from(plain),
    );
    expect(result?.items.map((item) => [item.label, item.answer]))
      .toEqual([['1', '은유'], ['2', '직유']]);
  });

  it('⚠️ 앞글 끝의 `대답:` 을 깎지 않는다 (블로킹)', () => {
    const plain = '1. 다음 대화의 빈칸을 채우시오.\n질문: 어디에 갑니까?\n대답:';
    const result = parsePrintQaSplit(
      raw([{ label: '1', question: '다음 대화의 빈칸을 채우시오.', answer: '' }]),
      from(plain),
    );
    expect(result?.items[0].lead).toBe('질문: 어디에 갑니까?\n대답:');
  });
});

describe('parsePrintQaSplit — 코덱스 17R 회귀', () => {
  const from = (plain: string) => ({ plain, handwritten: [], seed: 't' });

  it('⚠️ 답을 낱말 한복판에서 찾지 않는다 — 지문이 깎인다 (블로킹)', () => {
    const plain = '1. 다음 글의 갈래는?\n소설가 김 씨는 아침에 집을 나섰다.\n답: 소설';
    const result = parsePrintQaSplit(
      raw([{ label: '1', question: '다음 글의 갈래는?', answer: '소설' }]),
      from(plain),
    );
    expect(result?.items[0].answer).toBe('소설');
    expect(result?.items[0].lead).toBe('소설가 김 씨는 아침에 집을 나섰다.');
  });

  it('⚠️ `1번` 꼴 번호도 남의 자리로 지켜 준다 (블로킹)', () => {
    const plain = '1번 표현법은?\n답: 은유\n2번 표현법은?\n답: 직유';
    const result = parsePrintQaSplit(
      raw([
        { label: '1', question: '표현법은?', answer: '은유' },
        { label: '1', question: '표현법은?', answer: '은유' },
        { label: '2', question: '표현법은?', answer: '직유' },
      ]),
      from(plain),
    );
    expect(result?.items.map((item) => [item.label, item.answer]))
      .toEqual([['1', '은유'], ['2', '직유']]);
  });

  it('⚠️ 물음의 선택지가 손글씨 답의 출처를 덮지 않는다 (블로킹)', () => {
    const html = '<p>1. 은유, 직유 중 이 시의 표현법은?</p><p>답: <em>은유</em></p>';
    const { plain, ranges } = readPlainWithHandwriting(html, true);
    const result = parsePrintQaSplit(
      raw([{ label: '1', question: '은유, 직유 중 이 시의 표현법은?', answer: '은유' }]),
      { plain, handwritten: ranges, seed: 't' },
    );
    expect(result?.items[0].answerSource).toBe('handwritten');
    expect(result?.items[0].studentAnswer).toBe('은유');
  });
});

describe('parsePrintQaSplit — 코덱스 18R 회귀', () => {
  const from = (plain: string) => ({ plain, handwritten: [], seed: 't' });

  it('⚠️ 낱말 안에서만 보이는 답은 **없는 답**이다 — 지문을 깎지 않는다 (블로킹)', () => {
    const plain = '1. 갈래는?\n소설가 김 씨는 글을 썼다.';
    const result = parsePrintQaSplit(
      raw([{ label: '1', question: '갈래는?', answer: '소설' }]),
      from(plain),
    );
    expect(result?.items[0].lead).toBe('소설가 김 씨는 글을 썼다.');
    // 모델이 풀어 버린 답이라 비우고 센다 — 모범답안으로 채우면 된다
    expect(result?.items[0].answer).toBe('');
    expect(result?.dropped.answerNotInText).toBe(1);
  });

  it('⚠️ `A번` 꼴 번호도 제 자리에 앉는다 (블로킹)', () => {
    const plain = 'A번 표현법은? 답: 은유\nB번 표현법은? 답: 직유';
    const result = parsePrintQaSplit(
      raw([
        { label: 'A', question: '표현법은?', answer: '은유' },
        { label: 'B', question: '표현법은?', answer: '직유' },
      ]),
      from(plain),
    );
    expect(result?.items.map((item) => [item.label, item.answer]))
      .toEqual([['A', '은유'], ['B', '직유']]);
    expect(result?.dropped.duplicate).toBe(0);
  });
});

describe('parsePrintQaSplit — 코덱스 19R 회귀', () => {
  const from = (plain: string) => ({ plain, handwritten: [], seed: 't' });

  it('⚠️ 번호를 빠뜨린 응답도 자리를 얻는다 — 못 얻으면 물음 속 답을 못 가린다 (블로킹)', () => {
    const plain = '1. 갈래는 (소설)이다.';
    const result = parsePrintQaSplit(
      raw([{ label: '', question: '갈래는 (소설)이다.', answer: '소설' }]),
      from(plain),
    );
    expect(result?.items[0].question).toBe('갈래는 (　　　)이다.');
  });

  it('⚠️ 표 안의 번호도 남의 자리로 지켜 준다 (블로킹)', () => {
    const plain = '| 지문 | 1. 표현법은? | 답: 은유 |\n| 지문 | 2. 표현법은? | 답: 직유 |';
    const result = parsePrintQaSplit(
      raw([
        { label: '1', question: '표현법은?', answer: '은유' },
        { label: '1', question: '표현법은?', answer: '은유' },
        { label: '2', question: '표현법은?', answer: '직유' },
      ]),
      from(plain),
    );
    expect(result?.items.map((item) => [item.label, item.answer]))
      .toEqual([['1', '은유'], ['2', '직유']]);
  });

  it('⚠️ 자모 보기 안의 답은 **없는 답**이다 (블로킹)', () => {
    const plain = '1. 다음 중 바른 것은 (ㄱㄴ)이다.';
    const result = parsePrintQaSplit(
      raw([{ label: '1', question: '다음 중 바른 것은 (ㄱㄴ)이다.', answer: 'ㄱ' }]),
      from(plain),
    );
    expect(result?.items[0].question).toBe(plain.slice(3));
    expect(result?.items[0].answer).toBe('');
    expect(result?.dropped.answerNotInText).toBe(1);
  });
});

describe('parsePrintQaSplit — 코덱스 20R 회귀', () => {
  const from = (plain: string) => ({ plain, handwritten: [], seed: 't' });

  it('⚠️ 지문의 첫 낱말을 답으로 삼지 않는다 — 답 표시가 붙은 자리가 먼저다 (블로킹)', () => {
    const plain = '1. 다음 글의 갈래는?\n소설 한 편을 읽던 나는 창밖을 보았다.\n답: 소설';
    const result = parsePrintQaSplit(
      raw([{ label: '1', question: '다음 글의 갈래는?', answer: '소설' }]),
      from(plain),
    );
    expect(result?.items[0].lead).toBe('소설 한 편을 읽던 나는 창밖을 보았다.');
    expect(result?.items[0].answer).toBe('소설');
  });

  it('⚠️ 번호를 빠뜨린 반복 물음도 둘 다 살린다 — 중복 판정은 두 번째 기회 뒤에 (블로킹)', () => {
    const plain = '1. 표현법은?\n답: 은유\n2. 표현법은?\n답: 직유';
    const result = parsePrintQaSplit(
      raw([
        { label: '', question: '표현법은?', answer: '은유' },
        { label: '', question: '표현법은?', answer: '직유' },
      ]),
      from(plain),
    );
    expect(result?.items.map((item) => item.answer)).toEqual(['은유', '직유']);
    expect(result?.dropped.duplicate).toBe(0);
  });
});

describe('parsePrintQaSplit — 코덱스 21R 회귀', () => {
  const from = (plain: string) => ({ plain, handwritten: [], seed: 't' });

  it('⚠️ 따옴표를 친 답도 표시가 붙은 자리다 — 지문을 먹지 않는다 (블로킹)', () => {
    const plain = '1. 갈래는?\n소설 한 편을 읽었다.\n답: “소설”';
    const result = parsePrintQaSplit(
      raw([{ label: '1', question: '갈래는?', answer: '소설' }]),
      from(plain),
    );
    expect(result?.items[0].lead).toBe('소설 한 편을 읽었다.');
    expect(result?.items[0].answer).toBe('소설');
  });

  it('⚠️ 글 속의 숫자를 번호 자리로 보지 않는다 — 손글씨 답을 잃는다 (블로킹)', () => {
    const html = '<p>1. 표현법은? 답: 은유</p>'
      + '<p>예시 2개: 표현법은? 답: 직유</p>'
      + '<p>2. 표현법은? 답: <em>직유</em></p>';
    const { plain, ranges } = readPlainWithHandwriting(html, true);
    const result = parsePrintQaSplit(
      raw([
        { label: '1', question: '표현법은?', answer: '은유' },
        { label: '2', question: '표현법은?', answer: '직유' },
      ]),
      { plain, handwritten: ranges, seed: 't' },
    );
    expect(result?.items[1].answerSource).toBe('handwritten');
    expect(result?.items[1].studentAnswer).toBe('직유');
  });
});

describe('parsePrintQaSplit — 코덱스 22R 회귀', () => {
  const from = (plain: string) => ({ plain, handwritten: [], seed: 't' });

  it('⚠️ 지문의 `소설가` 때문에 괄호 속 답을 못 가리면 안 된다 (블로킹)', () => {
    const plain = '1. 갈래는? (소설)\n소설가의 삶';
    const result = parsePrintQaSplit(
      raw([{ label: '1', question: '갈래는? (소설)', answer: '소설' }]),
      from(plain),
    );
    expect(result?.items[0].question).toBe('갈래는? (　　　)');
  });

  it('⚠️ 한 줄에 늘어놓은 선택지는 지우지 않고 알린다 (블로킹)', () => {
    const plain = '1. 다음 중 표현법을 고르시오. 은유, 직유';
    const result = parsePrintQaSplit(
      raw([{ label: '1', question: '다음 중 표현법을 고르시오. 은유, 직유', answer: '은유' }]),
      from(plain),
    );
    expect(result?.items[0].question).toBe('다음 중 표현법을 고르시오. 은유, 직유');
    expect(result?.dropped.answerInQuestion).toBe(1);
  });
});

describe('parsePrintQaSplit — 코덱스 24R 회귀', () => {
  const from = (plain: string) => ({ plain, handwritten: [], seed: 't' });

  it('⚠️ 자리를 못 얻은 중복이 **뒤에 앉은 진짜 문항보다 먼저 와도** 지운다 (블로킹)', () => {
    const plain = '1. 갈래는? 답: 소설';
    const result = parsePrintQaSplit(
      raw([
        { label: '2', question: '갈래는?', answer: '소설' },
        { label: '1', question: '갈래는?', answer: '소설' },
      ]),
      from(plain),
    );
    expect(result?.items.map((item) => item.label)).toEqual(['1']);
    expect(result?.dropped.duplicate).toBe(1);
  });
});

describe('parsePrintQaSplit — 코덱스 25R 회귀', () => {
  const from = (plain: string) => ({ plain, handwritten: [], seed: 't' });

  it('⚠️ 기호로 그린 그림도 앞글로 싣는다 — 글자가 없다고 버리면 안 된다 (블로킹)', () => {
    const plain = '1. 다음 도형의 규칙을 설명하시오.\n△ → ○ → □';
    const result = parsePrintQaSplit(
      raw([{ label: '1', question: '다음 도형의 규칙을 설명하시오.', answer: '' }]),
      from(plain),
    );
    expect(result?.items[0].lead).toBe('△ → ○ → □');
  });
});

describe('parsePrintQaSplit — 코덱스 27R 회귀', () => {
  const from = (plain: string) => ({ plain, handwritten: [], seed: 't' });

  it('⚠️ 앞글의 닫는 따옴표와 그림 화살표를 깎지 않는다 (블로킹)', () => {
    const quoted = '1. 다음 문장의 문장 부호를 설명하시오.\n그는 “봄이다”';
    expect(parsePrintQaSplit(
      raw([{ label: '1', question: '다음 문장의 문장 부호를 설명하시오.', answer: '' }]),
      from(quoted),
    )?.items[0].lead).toBe('그는 “봄이다”');

    const chart = '1. 다음 도식을 완성하시오.\n얼음 →';
    expect(parsePrintQaSplit(
      raw([{ label: '1', question: '다음 도식을 완성하시오.', answer: '' }]),
      from(chart),
    )?.items[0].lead).toBe('얼음 →');
  });
});

describe('parsePrintQaSplit — 코덱스 28R 회귀', () => {
  const from = (plain: string) => ({ plain, handwritten: [], seed: 't' });

  it('⚠️ 인용된 답 표시가 든 앞글을 깎지 않는다 (블로킹)', () => {
    const plain = '1. 갈래는?\n답: 소설\n대화 속 표기는 “답:”';
    const result = parsePrintQaSplit(
      raw([{ label: '1', question: '갈래는?', answer: '소설' }]),
      from(plain),
    );
    expect(result?.items[0].lead).toBe('대화 속 표기는 “답:”');
  });
});

describe('parsePrintQaSplit — 코덱스 29R 회귀', () => {
  const from = (plain: string) => ({ plain, handwritten: [], seed: 't' });

  it('⚠️ 짝이 맞는 따옴표 안의 답 표시가 든 앞글을 깎지 않는다 (블로킹)', () => {
    const plain = '1. 다음 표기의 뜻은?\n표기는 "답:"\n소설';
    const result = parsePrintQaSplit(
      raw([{ label: '1', question: '다음 표기의 뜻은?', answer: '소설' }]),
      from(plain),
    );
    expect(result?.items[0].lead).toBe('표기는 "답:"');
  });

  it('⚠️ 답을 모를 때 남은 둘째 문장은 반드시 알린다 (블로킹)', () => {
    const question = '친구에게 할 충고를 두 문장으로 쓰시오.\n답: 자신의 생각만 내세우지 마라.'
      + '\n상대방의 말을 끝까지 들으세요.';
    const result = parsePrintQaSplit(
      raw([{ label: '1', question, answer: '' }]),
      from(`1. ${question}`),
    );
    expect(result?.items[0].question)
      .toBe('친구에게 할 충고를 두 문장으로 쓰시오.\n상대방의 말을 끝까지 들으세요.');
    expect(result?.dropped.answerInQuestion).toBe(1);
  });
});

describe('parsePrintQaSplit — 코덱스 31R 회귀', () => {
  const from = (plain: string) => ({ plain, handwritten: [], seed: 't' });

  it('⚠️ `문 1)` 꼴 번호도 앞글에서 뗀다 — 번호가 두 번 찍힌다 (블로킹)', () => {
    const plain = '지문입니다. 문 1) 갈래는? 답: 소설';
    expect(parsePrintQaSplit(
      raw([{ label: '1', question: '갈래는?', answer: '소설' }]),
      from(plain),
    )?.items[0].lead).toBe('지문입니다.');
  });

  it('⚠️ 표로 짠 줄의 번호도 앞글에서 뗀다 (블로킹)', () => {
    const table = '| 지문입니다. | 1. 갈래는? | 답: 소설 |';
    expect(parsePrintQaSplit(
      raw([{ label: '1', question: '갈래는?', answer: '소설' }]),
      from(table),
    )?.items[0].lead).toBe('지문입니다.');
  });
});

describe('parsePrintQaSplit — 코덱스 33R 회귀', () => {
  const from = (plain: string) => ({ plain, handwritten: [], seed: 't' });

  it('⚠️ 지문과 한 줄에 놓인 번호도 제 자리를 지켜 준다 (블로킹)', () => {
    const plain = '첫 지문이다. 1. 갈래는?\n답: 시\n둘째 지문이다. 2. 갈래는?\n답: 소설';
    const result = parsePrintQaSplit(
      raw([
        { label: '1', question: '갈래는?', answer: '시' },
        { label: '1', question: '갈래는?', answer: '시' },
        { label: '2', question: '갈래는?', answer: '소설' },
      ]),
      from(plain),
    );
    expect(result?.items.map((item) => [item.label, item.answer]))
      .toEqual([['1', '시'], ['2', '소설']]);
  });

  it('⚠️ 동그라미 번호도 앞글에서 뗀다 (블로킹)', () => {
    const plain = '지문이다. ① 갈래는?\n답: 소설';
    expect(parsePrintQaSplit(
      raw([{ label: '①', question: '갈래는?', answer: '소설' }]),
      from(plain),
    )?.items[0].lead).toBe('지문이다.');
  });
});
