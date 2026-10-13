import { describe, expect, it } from 'vitest';
import {
  MIN_EXTREME_SCALE, MIN_FIT_SCALE, MIN_VERTICAL_SCALE, TITLE_SCALE_STEPS,
  fitScale, fitTextScale, fitVerticalScale, textBlocksHeight, titleLengthOf, titleScale, wrappedLineCount,
} from './cover-scale';

describe('titleScale', () => {
  it('짧은 제목은 시안 크기 그대로(\'현대시 읽기\' 는 시안처럼 두 줄)', () => {
    expect(titleScale(3)).toBe(1);
    expect(titleScale(titleLengthOf('현대시 읽기'))).toBe(1);
    expect(titleScale(8)).toBe(1);
  });

  it('단계 경계에서 바뀌고 길수록 줄어든다(늘지 않는다)', () => {
    expect(titleScale(9)).toBe(0.7);
    expect(titleScale(14)).toBe(0.7);
    expect(titleScale(15)).toBe(0.5);
    const scales = Array.from({ length: 120 }, (_, i) => titleScale(i));
    scales.forEach((s, i) => { if (i > 0) expect(s).toBeLessThanOrEqual(scales[i - 1]); });
  });

  it('교사용 꼬리가 붙은 긴 제목은 절반으로, 상한(100자)+꼬리는 가장 작은 단계', () => {
    expect(titleScale(titleLengthOf('2학기 중간고사 대비 현대시 3회 - 교사용'))).toBe(0.5);
    expect(titleScale(106)).toBe(TITLE_SCALE_STEPS[TITLE_SCALE_STEPS.length - 1].scale);
  });

  it('디자인마다 단계표를 따로 줄 수 있다', () => {
    const steps = [{ maxLength: 10, scale: 1 }, { maxLength: Infinity, scale: 0.5 }];
    expect(titleScale(10, steps)).toBe(1);
    expect(titleScale(11, steps)).toBe(0.5);
  });
});

describe('titleLengthOf', () => {
  it('앞뒤 공백을 빼고 코드포인트로 센다', () => {
    expect(titleLengthOf('  봄봄 ')).toBe(2);
    expect(titleLengthOf('𠀀가')).toBe(2);
  });
});

describe('fitVerticalScale', () => {
  const box = { height: 518, width: 48, fontSize: 22, letterSpacing: 0.3, lineHeight: 1.15 };
  const fits = (text: string, b: typeof box, scale: number) => {
    const size = b.fontSize * scale;
    return wrappedLineCount(text, b.height / (size * (1 + b.letterSpacing)))
      <= Math.max(1, Math.floor(b.width / (size * b.lineHeight)));
  };

  it('한 줄에 들어가면 줄이지 않는다', () => {
    expect(fitVerticalScale('현대시 읽기', box)).toBe(1);
  });

  it('길면 세로줄을 늘리고 글자를 줄여 다 담는다', () => {
    const text = '가'.repeat(100);
    const scale = fitVerticalScale(text, box);
    expect(scale).toBeLessThan(1);
    expect(fits(text, box, scale)).toBe(true);
  });

  it('굵은 책등(폭 84px · 60px · 자간 0.35em)도 100자 + 꼬리를 다 담는다(코덱스 4R — 0.3 에서 멈추면 잘렸다)', () => {
    const bold = { height: 428, width: 74, fontSize: 60, letterSpacing: 0.35, lineHeight: 1.05 };
    // 낱말 길이 1~40자로 지은 100자 제목 + 교사용 꼬리 — 어느 모양이든 하한 안에서 다 들어간다
    for (let len = 1; len <= 40; len += 1) {
      const words: string[] = [];
      while (words.join(' ').length + len + 1 <= 100) words.push('가'.repeat(len));
      const text = `${words.join(' ')} - 교사용`;
      const scale = fitVerticalScale(text, bold);
      expect(scale).toBeGreaterThanOrEqual(MIN_VERTICAL_SCALE);
      expect(fits(text, bold, scale), `낱말 ${len}자`).toBe(true);
    }
    expect(fits(`${'가'.repeat(100)} - 교사용`, bold, fitVerticalScale(`${'가'.repeat(100)} - 교사용`, bold))).toBe(true);
  });

  it('아래 끝에서도 안 들어가면 더 줄여 담는다(문제지 제목은 길이 상한이 없다, 코덱스 5R)', () => {
    const bold = { height: 428, width: 74, fontSize: 60, letterSpacing: 0.35, lineHeight: 1.05 };
    const text = `${'가'.repeat(500)} - 교사용`;
    const scale = fitVerticalScale(text, bold);
    expect(scale).toBeLessThan(MIN_VERTICAL_SCALE);
    expect(fits(text, bold, scale)).toBe(true);
  });

  it('끝없이 길면 마지막 하한에서 멈춘다', () => {
    expect(fitVerticalScale('가'.repeat(200_000), box)).toBe(MIN_EXTREME_SCALE);
  });
});

describe('wrappedLineCount', () => {
  it('띄어쓰기에서 줄을 바꾼다 — 낱말이 남긴 빈자리까지 센다', () => {
    expect(wrappedLineCount('가나다 라마바', 7)).toBe(1);
    expect(wrappedLineCount('가나다 라마바', 6)).toBe(2);
    // 글자 수로는 26자 ÷ 14 = 2줄이지만, 13자 낱말 둘은 한 줄에 못 들어 각자 한 줄이다
    expect(wrappedLineCount(`${'가'.repeat(13)} ${'나'.repeat(13)}`, 14)).toBe(2);
    expect(wrappedLineCount(`${'가'.repeat(13)} ${'나'.repeat(13)} ${'다'.repeat(13)}`, 20)).toBe(3);
  });

  it('줄보다 긴 낱말은 쪼갠다', () => {
    expect(wrappedLineCount('가'.repeat(25), 10)).toBe(3);
    expect(wrappedLineCount(`${'가'.repeat(25)} 나`, 10)).toBe(3);
    expect(wrappedLineCount(`${'가'.repeat(20)} 나`, 10)).toBe(3);
  });

  it('줄바꿈은 새 줄, 빈 글은 0줄', () => {
    expect(wrappedLineCount('가\n나\n\n다', 10)).toBe(3);
    expect(wrappedLineCount('', 10)).toBe(0);
  });
});

describe('fitTextScale', () => {
  const block = { fontSize: 20, lineHeight: 1.5, width: 200 };

  it('들어가면 줄이지 않는다', () => {
    expect(fitTextScale([{ ...block, text: '짧은 글' }], 100)).toBe(1);
  });

  it('덩어리들의 높이 합이 자리 안에 들도록 함께 줄인다', () => {
    const blocks = [{ ...block, text: '가'.repeat(120) }, { ...block, text: '나'.repeat(120) }];
    const scale = fitTextScale(blocks, 200);
    expect(scale).toBeLessThan(1);
    expect(textBlocksHeight(blocks, scale)).toBeLessThanOrEqual(200);
  });

  it('간격까지 센다', () => {
    const blocks = [{ ...block, text: '가' }, { ...block, text: '나' }];
    expect(fitTextScale(blocks, 60)).toBe(1);
    expect(fitTextScale(blocks, 60, 10)).toBeLessThan(1);
  });

  it('아래 끝에서도 안 들어가면 더 줄여 담는다', () => {
    const blocks = [{ ...block, text: '가'.repeat(2000) }];
    const scale = fitTextScale(blocks, 200);
    expect(scale).toBeLessThan(MIN_FIT_SCALE);
    expect(textBlocksHeight(blocks, scale)).toBeLessThanOrEqual(200);
  });

  it('끝없이 길면 마지막 하한에서 멈춘다', () => {
    expect(fitTextScale([{ ...block, text: '가'.repeat(200_000) }], 10)).toBe(MIN_EXTREME_SCALE);
  });
});

describe('fitScale', () => {
  it('고르게 줄여 처음 들어가는 값을 돌려준다', () => {
    expect(fitScale((s) => s <= 0.62, 0.3, 0.05)).toBe(0.6);
  });

  it('아래 끝 너머에서도 검사를 통과한 값을 넘지 않는다(반올림 금지, 코덱스 7R)', () => {
    for (const limit of [0.0887, 0.1349, 0.0555, 0.2649]) {
      const scale = fitScale((s) => s <= limit, 0.3, 0.05);
      expect(scale).toBeLessThanOrEqual(limit);
    }
  });
});
