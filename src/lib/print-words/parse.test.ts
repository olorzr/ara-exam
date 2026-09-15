import { describe, it, expect } from 'vitest';
import { parsePrintWords } from './parse';

const PLAIN = [
  '어휘 풀이',
  '상기: 지난 일을 다시 생각해 냄',
  '통념: 널리 통하는 개념',
  '경외',
].join('\n');

const ctx = { plain: PLAIN };
const raw = (words: unknown[]) => JSON.stringify({ words });

describe('parsePrintWords', () => {
  it('단어와 뜻이 짝지어진 항목을 받는다', () => {
    const result = parsePrintWords(
      raw([{ word: '상기', meaning: '지난 일을 다시 생각해 냄' }]), ctx,
    );
    expect(result?.entries).toEqual([{ word: '상기', meaning: '지난 일을 다시 생각해 냄' }]);
  });

  it('표에 실린 뜻도 받는다 — 평문의 칸 구분 기호 때문에 "지어낸 뜻" 으로 몰리면 안 된다', () => {
    // 코덱스 리뷰가 재현한 자리: 뜻이 두 칸에 걸치면 사이에 우리가 넣은 `|` 가 낀다
    const table = { plain: '| 경외 | 존경하고 | 두려워함 |' };
    const result = parsePrintWords(
      raw([{ word: '경외', meaning: '존경하고 두려워함' }]), table,
    );
    expect(result?.entries).toEqual([{ word: '경외', meaning: '존경하고 두려워함' }]);
    expect(result?.dropped.unverified).toEqual([]);
  });

  it('모양이 깨지면 null', () => {
    expect(parsePrintWords('{', ctx)).toBeNull();
    expect(parsePrintWords(JSON.stringify({}), ctx)).toBeNull();
  });

  it('뜻이 비면 등록하지 않고 **이름을 돌려준다** — 뜻은 지어내지 않는다', () => {
    const result = parsePrintWords(raw([{ word: '경외', meaning: '' }]), ctx);
    expect(result?.entries).toHaveLength(0);
    expect(result?.dropped.noMeaning).toEqual(['경외']);
  });

  it('공백만 든 뜻도 빈 뜻으로 본다 — words.meaning 에 CHECK 가 없어 그대로 들어간다', () => {
    const result = parsePrintWords(raw([{ word: '경외', meaning: '   ' }]), ctx);
    expect(result?.entries).toHaveLength(0);
    expect(result?.dropped.noMeaning).toEqual(['경외']);
  });

  it('프린트에 없는 뜻은 등록하지 않는다 — 단어만 본문에 있으면 사전 뜻이 새어 든다', () => {
    // '경외' 는 본문에 있지만 뜻은 안 적혀 있다. 모델이 사전 풀이를 붙여 오는 경우다
    const result = parsePrintWords(
      raw([{ word: '경외', meaning: '존경하고 두려워함' }]), ctx,
    );
    expect(result?.entries).toHaveLength(0);
    expect(result?.dropped.unverified).toEqual(['경외']);
  });

  it('프린트에서 줄이 바뀐 뜻도 찾아낸다 — 본문도 같은 규칙으로 접어 비교한다', () => {
    const plain = '상기: 지난 일을\n다시 생각해 냄';
    const result = parsePrintWords(
      raw([{ word: '상기', meaning: '지난 일을 다시 생각해 냄' }]), { plain },
    );
    expect(result?.entries).toHaveLength(1);
  });

  it('끝의 마침표 하나는 봐준다 — 프린트의 "…함." 과 모델의 "…함" 은 같은 뜻이다', () => {
    const plain = '상기: 지난 일을 다시 생각해 냄';
    const result = parsePrintWords(
      raw([{ word: '상기', meaning: '지난 일을 다시 생각해 냄.' }]), { plain },
    );
    expect(result?.entries).toHaveLength(1);
  });

  it('본문에 없는 말은 버리고 센다 — 모델이 사전에서 가져온 것이라 프린트와 어긋난다', () => {
    const result = parsePrintWords(raw([{ word: '역설법', meaning: '반대로 말하기' }]), ctx);
    expect(result?.entries).toHaveLength(0);
    expect(result?.dropped.notInText).toBe(1);
  });

  it('같은 단어가 두 번 오면 첫 것만 — UNIQUE(category_id, word) 라 어차피 못 들어간다', () => {
    const result = parsePrintWords(raw([
      { word: '상기', meaning: '지난 일을 다시 생각해 냄' },
      { word: '상기', meaning: '다른 뜻' },
    ]), ctx);
    expect(result?.entries).toHaveLength(1);
    expect(result?.dropped.duplicate).toBe(1);
  });

  it('빈 단어와 줄바꿈이 든 단어를 버린다', () => {
    const result = parsePrintWords(raw([
      { word: '  ', meaning: '뜻' },
      { word: '상\n기', meaning: '뜻' },
      'not an object',
    ]), ctx);
    expect(result?.entries).toHaveLength(0);
    expect(result?.dropped.malformed).toBe(3);
  });

  it('뜻의 줄바꿈·연속 공백을 한 칸으로 모은다 — 단어장 한 줄에 들어가야 한다', () => {
    const result = parsePrintWords(
      raw([{ word: '통념', meaning: ' 널리  \n 통하는 개념 ' }]), ctx,
    );
    expect(result?.entries[0].meaning).toBe('널리 통하는 개념');
  });

  it('뜻이 너무 길면 잘라서 받는다 — 단어까지 버리지는 않는다', () => {
    // 대조는 자르기 **전에** 한다 — 프린트에 그대로 인쇄된 긴 풀이여야 한다
    const long = '뜻'.repeat(500);
    const plain = `통념: ${long}`;
    const result = parsePrintWords(raw([{ word: '통념', meaning: long }]), { plain });
    expect(result?.entries[0].meaning.length).toBe(300);
  });

  it('단어가 너무 길면 버린다 — words.word 에 CHECK 가 없다', () => {
    const plain = `${PLAIN}\n${'가'.repeat(50)}`;
    const result = parsePrintWords(
      raw([{ word: '가'.repeat(50), meaning: '뜻' }]), { plain },
    );
    expect(result?.entries).toHaveLength(0);
    expect(result?.dropped.malformed).toBe(1);
  });
});
