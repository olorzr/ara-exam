import { describe, it, expect } from 'vitest';
import { PASSAGE_BLOCK_MAX_CHARS } from './constants';
import { quizPaperTitle, splitPassageBlocks } from './print-blocks';

const texts = (text: string, maxLines?: number, maxChars?: number) =>
  splitPassageBlocks(text, maxLines, maxChars).map((b) => b.text);

describe('splitPassageBlocks', () => {
  it('빈 줄을 경계로 나눈다 — 연·문단이 쪽 나눔의 자리다', () => {
    expect(texts('첫 연\n둘째 줄\n\n둘째 연')).toEqual(['첫 연\n둘째 줄', '둘째 연']);
  });

  it('새 연에는 표시를 남긴다 — 빈 줄이 사라져도 인쇄에서 띄울 수 있어야 한다', () => {
    const blocks = splitPassageBlocks('첫 연\n\n둘째 연');
    expect(blocks.map((b) => b.newParagraph)).toEqual([true, true]);
  });

  it('자리가 모자라 쪼갠 조각은 새 연이 아니다 — 원래 이어지던 글이다', () => {
    const lines = Array.from({ length: 7 }, (_, i) => `줄${i}`).join('\n');
    const blocks = splitPassageBlocks(lines, 3);
    expect(blocks.map((b) => b.text)).toEqual(['줄0\n줄1\n줄2', '줄3\n줄4\n줄5', '줄6']);
    expect(blocks.map((b) => b.newParagraph)).toEqual([true, false, false]);
  });

  it('문단 안의 줄바꿈은 지키지 않으면 시가 산문이 된다', () => {
    expect(texts('가는 길\n삼수갑산')[0]).toContain('\n');
  });

  it('줄바꿈 없는 긴 지문도 쪼갠다 — 한 덩어리면 인쇄에서 통째로 축소된다', () => {
    // 비문학 지문은 줄바꿈 없이 몇천 자가 한 줄로 들어온다
    const long = Array.from({ length: 60 }, (_, i) => `${i}번째 문장이 여기에 있다.`).join(' ');
    const blocks = splitPassageBlocks(long);
    expect(blocks.length).toBeGreaterThan(1);
    for (const block of blocks) expect(block.text.length).toBeLessThanOrEqual(PASSAGE_BLOCK_MAX_CHARS);
    // 글자를 잃지 않는다
    expect(blocks.map((b) => b.text).join(' ')).toBe(long);
  });

  it('문장 경계에서 끊는다 — 낱말 가운데를 자르지 않는다', () => {
    // 상한에 들어가는 만큼은 한 블록에 담고(20자), 넘치면 문장 끝에서 끊는다(10자)
    expect(texts('첫 문장이다. 둘째 문장이다. 셋째 문장이다.', 12, 20))
      .toEqual(['첫 문장이다. 둘째 문장이다.', '셋째 문장이다.']);
    expect(texts('첫 문장이다. 둘째 문장이다. 셋째 문장이다.', 12, 10))
      .toEqual(['첫 문장이다.', '둘째 문장이다.', '셋째 문장이다.']);
  });

  it('문장이 하나도 안 끝나면 띄어쓰기로, 그것도 없으면 글자 수로 끊는다', () => {
    for (const block of texts('가나다 라마바 사아자 차카타', 12, 10)) {
      expect(block.length).toBeLessThanOrEqual(10);
    }
    expect(texts('ㄱ'.repeat(25), 12, 10).every((b) => b.length <= 10)).toBe(true);
  });

  it('빈 조각과 앞뒤 빈 줄은 버린다', () => {
    expect(texts('\n\n\n첫 연\n\n\n\n둘째 연\n\n')).toEqual(['첫 연', '둘째 연']);
    expect(splitPassageBlocks('   \n\n  ')).toEqual([]);
  });

  it('윈도우 줄바꿈도 같게 다룬다', () => {
    expect(texts('첫 연\r\n\r\n둘째 연')).toEqual(['첫 연', '둘째 연']);
  });
});

describe('quizPaperTitle', () => {
  it('제목이 있으면 붙이고, 없으면 기본 제목을 쓴다', () => {
    expect(quizPaperTitle('진달래꽃')).toBe('진달래꽃 O,X·단답형');
    expect(quizPaperTitle('  ')).toBe('O,X·단답형 문제');
  });
});
