import { describe, expect, it } from 'vitest';
import type { PaperBlock } from './blocks';
import { shrunkLabelsOf } from './shrunk-blocks';

const header = (text: string): PaperBlock => ({ kind: 'passage-header', key: `h-${text}`, text });
const part = (key: string): PaperBlock => ({ kind: 'passage-part', key, html: '<p>x</p>', serif: false, first: false, last: false });
const problem = (number: number) => ({ kind: 'problem', key: `q-${number}`, number } as unknown as PaperBlock);

describe('shrunkLabelsOf', () => {
  const blocks: PaperBlock[] = [
    header('[20~23] 다음 글을 읽고 물음에 답하시오.'), part('a'), part('b'), problem(20), problem(21),
    header('[24] 다음 글을 읽고 물음에 답하시오.'), part('c'), problem(24),
  ];

  it('지문 조각은 가장 가까운 앞 머리글의 범위로, 문항은 번호로 부른다', () => {
    expect(shrunkLabelsOf(blocks, [1, 4, 6])).toEqual(['20~23번 지문', '21번', '24번 지문']);
  });

  it('같은 지문의 조각이 여럿이면 한 번만', () => {
    expect(shrunkLabelsOf(blocks, [1, 2])).toEqual(['20~23번 지문']);
  });

  it('머리글 자체·범위 밖 번호는 이름이 없다', () => {
    expect(shrunkLabelsOf(blocks, [0, 99, -1])).toEqual([]);
  });

  it('머리글 없이 시작하는 조각은 그냥 지문이다', () => {
    expect(shrunkLabelsOf([part('x')], [0])).toEqual(['지문']);
  });

  it('해설 조각은 그 문항의 해설이다', () => {
    const explanation = { kind: 'explanation-part', key: 'e', number: 7, html: '', first: true, last: true } as unknown as PaperBlock;
    expect(shrunkLabelsOf([explanation], [0])).toEqual(['7번 해설']);
  });
});
