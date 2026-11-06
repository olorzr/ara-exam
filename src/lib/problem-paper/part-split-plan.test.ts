import { describe, expect, it } from 'vitest';
import { paginate, type PaginateInput } from '@/lib/print/paginate';
import type { PassagePartBlock } from './blocks';
import type { PartMeasure } from './part-measure';
import {
  chunkPartBlocks, MIN_CHUNK_LINES, pickCut, planSplitRound, segmentHeight, SPLIT_SAFETY_PX, WHOLE_SEGMENT,
} from './part-split-plan';

const LH = 20;

/** n 줄짜리 시 — 후보는 줄마다 (마지막 줄 뒤에는 없다) */
function verse(lines: number, over: Partial<PartMeasure> = {}): PartMeasure {
  return {
    prefixHeights: Array.from({ length: lines - 1 }, (_, i) => (i + 1) * LH),
    totalHeight: lines * LH,
    topChrome: 0,
    bottomChrome: 0,
    lineHeight: LH,
    continuationTop: Array.from({ length: lines - 1 }, () => 0),
    minChunkPx: MIN_CHUNK_LINES * LH - 0.5,
    ...over,
  };
}

describe('pickCut', () => {
  it('앞 자리에 드는 가장 뒤쪽에서 자른다', () => {
    // 100px 에 안전 여유를 빼면 4줄
    expect(pickCut(verse(10), WHOLE_SEGMENT, 100 + SPLIT_SAFETY_PX, 400)).toBe(4);
    expect(pickCut(verse(10), WHOLE_SEGMENT, 99, 400)).toBe(3);
  });

  it('첫 조각의 위 군살까지 넣어 잰다', () => {
    expect(pickCut(verse(10, { topChrome: 20 }), WHOLE_SEGMENT, 100 + SPLIT_SAFETY_PX, 400)).toBe(3);
  });

  it('앞 자리에 2줄도 안 들어가면 통째로 다음 단으로 보낸다', () => {
    expect(pickCut(verse(10), WHOLE_SEGMENT, 30, 400)).toBeNull();
  });

  it('다음 단에도 안 들어가면 다음 단 크기로 자른다', () => {
    expect(pickCut(verse(30), WHOLE_SEGMENT, 30, 400)).toBe(18);
  });

  it('뒤에 1줄만 남는 자리는 고르지 않는다', () => {
    expect(pickCut(verse(5), WHOLE_SEGMENT, 90, 400)).toBe(2);
  });

  it('앞에 1줄만 남는 자리는 고르지 않는다', () => {
    expect(pickCut(verse(5), WHOLE_SEGMENT, 25, 50)).toBe(1);
    expect(pickCut(verse(5), WHOLE_SEGMENT, 25, 400)).toBeNull();
  });

  it('3줄 이하는 자르지 않는다 — 양쪽에 2줄을 못 남긴다', () => {
    expect(pickCut(verse(3), WHOLE_SEGMENT, 45, 45)).toBeNull();
  });

  it('구간 안에서만 자른다', () => {
    expect(pickCut(verse(20), { from: 4, to: 10 }, 62 + SPLIT_SAFETY_PX, 400)).toBe(7);
  });

  it('문장 끝에서 잘린 뒤 조각은 한 줄 늘 몫을 함께 잰다', () => {
    const prose = verse(20, { continuationTop: Array.from({ length: 19 }, () => LH) });
    expect(pickCut(prose, { from: 4, to: Number.POSITIVE_INFINITY }, 62 + SPLIT_SAFETY_PX, 400)).toBe(6);
    expect(pickCut(prose, WHOLE_SEGMENT, 62 + SPLIT_SAFETY_PX, 400)).toBe(2);
  });
});

describe('pickCut — 문항(최소 높이 없음)', () => {
  /** 머리·선지 다섯 — 후보는 경계들과 맨 뒤의 '간격만 떼기' */
  const question = (over: Partial<PartMeasure> = {}): PartMeasure => ({
    prefixHeights: [50, 70, 90, 110, 130], totalHeight: 130, topChrome: 0, bottomChrome: 94, lineHeight: 0,
    continuationTop: [9, 9, 9, 9, 0], minChunkPx: 0, emptyTailCut: 4, ...over,
  });

  it('선지 하나만 남겨도 자른다 — 두 줄 규칙이 ①②③|④⑤ 를 막으면 안 된다', () => {
    expect(pickCut(question(), WHOLE_SEGMENT, 95, 700)).toBe(2);
  });

  it('내용이 다 들면 간격만 뗀다 — 마지막 선지 하나를 다음 단으로 밀지 않는다', () => {
    expect(pickCut(question(), WHOLE_SEGMENT, 140, 700)).toBe(4);
  });

  it('앞 자리에 머리와 단위 하나도 안 들면 통째로 다음 단으로 간다', () => {
    expect(pickCut(question(), WHOLE_SEGMENT, 40, 700)).toBeNull();
  });

  it('뒤 조각 윗여백을 그 자리 몫으로 잰다', () => {
    const m = question();
    expect(pickCut(m, { from: 0, to: Number.POSITIVE_INFINITY }, 9 + 40 + SPLIT_SAFETY_PX, 700)).toBe(2);
    expect(pickCut(m, { from: 0, to: Number.POSITIVE_INFINITY }, 9 + 39 + SPLIT_SAFETY_PX, 700)).toBe(1);
  });

  it('간격만 뗀 뒤 조각은 높이가 없다', () => {
    expect(segmentHeight(question(), { from: 4, to: Number.POSITIVE_INFINITY })).toBe(0);
  });
});

describe('segmentHeight', () => {
  const m = verse(10, { topChrome: 7, bottomChrome: 5 });

  it('위 군살은 첫 구간에만, 아래 군살은 끝 구간에만 든다', () => {
    expect(segmentHeight(m, WHOLE_SEGMENT)).toBe(200 + 7 + 5);
    expect(segmentHeight(m, { from: -1, to: 3 })).toBe(80 + 7);
    expect(segmentHeight(m, { from: 3, to: 6 })).toBe(60);
    expect(segmentHeight(m, { from: 6, to: Number.POSITIVE_INFINITY })).toBe(60 + 5);
  });
});

describe('planSplitRound', () => {
  const page = (over: Partial<PaginateInput>): PaginateInput => ({
    blockHeights: [], columns: 1, firstPageBodyHeight: 200, laterPageBodyHeight: 200, ...over,
  });

  it('앞 블록 뒤 남은 자리를 채우고 나머지를 쪽마다 자른다', () => {
    const para = verse(25);
    const cuts = planSplitRound(
      page({ blockHeights: [100, para.totalHeight], splittable: [false, true] }),
      (i) => (i === 1 ? para : null),
    );
    // 남은 97px → 4줄, 그다음 쪽마다 197px → 9줄
    expect(cuts.get(1)).toEqual([3, 12, 21]);
  });

  it('뒤 문단도 앞 문단을 자른 뒤의 진짜 자리로 자른다 — 첫 요청만 정확한 값을 쓰지 않는다', () => {
    const first = verse(15);
    const second = verse(15);
    const cuts = planSplitRound(
      page({ blockHeights: [100, first.totalHeight, second.totalHeight], splittable: [false, true, true] }),
      (i) => (i === 1 ? first : second),
    );
    // 첫 문단이 1쪽 4줄 · 2쪽 9줄 · 3쪽 2줄을 쓰고, 둘째 문단은 3쪽 남은 자리 157px → 7줄부터
    expect(cuts.get(1)).toEqual([3, 12]);
    expect(cuts.get(2)).toEqual([6]);
  });

  it('자른 결과를 엔진에 넣으면 남은 자리가 남지 않는다', () => {
    const para = verse(25);
    const input = page({ blockHeights: [100, para.totalHeight], splittable: [false, true] });
    const cuts = planSplitRound(input, () => para).get(1) ?? [];
    const edges = [-1, ...cuts, Number.POSITIVE_INFINITY];
    const parts = edges.slice(1).map((to, i) => segmentHeight(para, { from: edges[i], to }));
    const { pages, oversized } = paginate({ ...input, blockHeights: [100, ...parts], splittable: undefined });
    expect(oversized).toEqual([]);
    expect(pages).toHaveLength(4);
    expect(pages[0].columns[0]).toEqual([0, 1]);
  });

  it('2단이면 오른쪽 단을 채운 뒤 다음 쪽으로 간다', () => {
    const para = verse(20);
    const cuts = planSplitRound(
      page({ columns: 2, blockHeights: [150, para.totalHeight], splittable: [false, true] }),
      () => para,
    );
    expect(cuts.get(1)).toEqual([1, 10]);
  });

  it('잴 수 없는 블록은 건너뛰고 다음 요청을 본다', () => {
    const para = verse(25);
    const cuts = planSplitRound(
      page({ blockHeights: [100, 500, para.totalHeight], splittable: [false, true, true] }),
      (i) => (i === 2 ? para : null),
    );
    expect(cuts.has(1)).toBe(false);
    expect(cuts.has(2)).toBe(true);
  });

  it('쪽 넘김은 첫 조각에 남는다', () => {
    const para = verse(25);
    const input = page({
      blockHeights: [100, para.totalHeight], splittable: [false, true], breakBefore: [false, 'page'],
    });
    // 쪽을 넘긴 뒤라 앞 자리가 쪽 하나다 — 첫 블록 뒤 남은 자리로 자르지 않는다
    expect(planSplitRound(input, () => para).get(1)?.[0]).toBe(8);
  });

  it('간격만 뗀 문항 뒤는 다음 단에서 시작한다 — 뒤 문항을 그 자리에 앉혀 자르지 않는다', () => {
    const tight: PartMeasure = {
      prefixHeights: [60, 80, 100], totalHeight: 100, topChrome: 0, bottomChrome: 94, lineHeight: 0,
      continuationTop: [6, 6, 0], minChunkPx: 0, emptyTailCut: 2,
    };
    const next: PartMeasure = { ...tight };
    const cuts = planSplitRound(
      page({ columns: 2, blockHeights: [50, 194, 194], splittable: [false, true, true] }),
      (i) => (i === 1 ? tight : i === 2 ? next : null),
    );
    expect(cuts.get(1)).toEqual([2]);
    expect(cuts.has(2)).toBe(false);
  });

  it('쪼갤 블록이 없으면 빈 지도다', () => {
    expect(planSplitRound(page({ blockHeights: [100, 100] }), () => verse(5)).size).toBe(0);
  });

  it('어떤 입력에도 끝나고, 조각마다 최소 줄 수를 지킨다', () => {
    let seed = 20261106;
    const random = (n: number) => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed % n;
    };
    for (let run = 0; run < 200; run += 1) {
      const lines = 1 + random(120);
      const para = verse(lines, { topChrome: random(30), bottomChrome: random(30) });
      const body = 60 + random(900);
      const lead = random(body);
      const cuts = planSplitRound(
        page({
          columns: run % 2 === 0 ? 1 : 2, firstPageBodyHeight: body, laterPageBodyHeight: body + random(200),
          blockHeights: [lead, para.totalHeight + para.topChrome + para.bottomChrome], splittable: [false, true],
        }),
        () => para,
      ).get(1) ?? [];
      if (cuts.length === 0) continue;
      const edges = [0, ...cuts.map((cut) => cut + 1), lines];
      edges.slice(1).forEach((edge, i) => expect(edge - edges[i]).toBeGreaterThanOrEqual(MIN_CHUNK_LINES));
    }
  });
});

describe('chunkPartBlocks', () => {
  const part: PassagePartBlock = {
    kind: 'passage-part', key: 'pp-0-2', html: '<p>x</p>', serif: true, figures: ['g.jpg'], first: true, last: true,
    sourceAccurate: true, literalLabels: true, box: { label: '나', first: true, last: true },
  };

  it('틀·상자의 처음은 첫 조각에, 끝은 끝 조각에만 남는다', () => {
    const chunks = chunkPartBlocks(part, ['<p>a</p>', '<p>b</p>', '<p>c</p>']);
    expect(chunks.map((c) => [c.first, c.last, c.box?.first, c.box?.last, c.continues])).toEqual([
      [true, false, true, false, true],
      [false, false, false, false, true],
      [false, true, false, true, undefined],
    ]);
  });

  it('지문 틀·상자의 처음이 아니었던 조각은 처음이 되지 않는다', () => {
    const middle = { ...part, first: false, last: false, box: { label: '나', first: false, last: false } };
    const chunks = chunkPartBlocks(middle, ['<p>a</p>', '<p>b</p>']);
    expect(chunks.map((c) => [c.first, c.last, c.box?.first, c.box?.last]))
      .toEqual([[false, false, false, false], [false, false, false, false]]);
  });

  it('글꼴·그림·원본 대조 표시와 말머리를 물려준다', () => {
    const [chunk] = chunkPartBlocks(part, ['<p>a</p>', '<p>b</p>']);
    expect(chunk).toMatchObject({
      kind: 'passage-part', html: '<p>a</p>', serif: true, figures: ['g.jpg'],
      sourceAccurate: true, literalLabels: true, box: { label: '나' },
    });
  });

  it('키가 겹치지 않고 다시 쪼개도 이어진다', () => {
    const chunks = chunkPartBlocks(part, ['<p>a</p>', '<p>b</p>']);
    expect(chunks.map((c) => c.key)).toEqual(['pp-0-2-s0', 'pp-0-2-s1']);
    expect(chunkPartBlocks(chunks[1], ['<p>c</p>', '<p>d</p>']).map((c) => c.key))
      .toEqual(['pp-0-2-s1-s0', 'pp-0-2-s1-s1']);
  });

  it('이어지던 조각을 다시 쪼개면 끝 조각도 여전히 이어진다', () => {
    const [lead] = chunkPartBlocks(part, ['<p>a</p>', '<p>b</p>']);
    expect(chunkPartBlocks(lead, ['<p>c</p>', '<p>d</p>']).map((c) => c.continues)).toEqual([true, true]);
  });

  it('상자 밖 조각에는 상자 표시를 만들지 않는다', () => {
    const plain: PassagePartBlock = { kind: 'passage-part', key: 'k', html: '<p>x</p>', serif: false, first: false, last: false };
    expect(chunkPartBlocks(plain, ['<p>a</p>', '<p>b</p>']).every((c) => !('box' in c))).toBe(true);
  });
});
