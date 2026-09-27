import { describe, expect, it } from 'vitest';
import { isContiguous, type PaperItem } from './compose';
import {
  countUnaddedByKind, planTypeMix, poolTooBigMessage, sampleTypeMix, shortfallMessage,
  TYPE_MIX_POOL_MAX, type KindCounts, type TypeMixRow,
} from './type-mix';
import type { QuestionType } from '@/types/problem-bank';

/** 섞지 않는다 — 뽑기 결과를 눈으로 셀 수 있게 한다 */
const identity = <T>(arr: readonly T[]): T[] => [...arr];
/** 뒤집는다 — '섞는다' 가 실제로 결과를 바꾸는지 본다 */
const reverse = <T>(arr: readonly T[]): T[] => [...arr].reverse();

const row = (id: string, type: QuestionType, passage: string | null = null): TypeMixRow =>
  ({ id, question_type: type, passage_id: passage });

const counts = (objective: number, subjective: number): KindCounts => ({ objective, subjective });

describe('countUnaddedByKind', () => {
  it("담긴 것은 빼고 세고, '서술형' 은 주관식 갈래다", () => {
    const rows = [row('a', '객관식'), row('b', '주관식'), row('c', '서술형'), row('d', '객관식')];

    expect(countUnaddedByKind(rows, new Set(['d']))).toEqual(counts(1, 2));
  });

  it('빈 풀은 0', () => {
    expect(countUnaddedByKind([], new Set())).toEqual(counts(0, 0));
  });
});

describe('planTypeMix', () => {
  const plenty = counts(100, 100);

  it('비율을 문항 수로 옮긴다', () => {
    expect(planTypeMix(20, 80, plenty).take).toEqual(counts(16, 4));
    expect(planTypeMix(10, 50, plenty).take).toEqual(counts(5, 5));
  });

  it('한쪽만 고르면 그 갈래로만 채운다', () => {
    expect(planTypeMix(5, 100, plenty).take).toEqual(counts(5, 0));
    expect(planTypeMix(5, 0, plenty).take).toEqual(counts(0, 5));
  });

  /** 둘을 따로 반올림하면 합이 1 모자라거나 남는다 — 나머지를 주관식에 준다 */
  it('반올림해도 합은 언제나 문항 수 그대로다', () => {
    for (const [total, percent] of [[1, 50], [7, 50], [20, 33], [3, 33], [9, 11]]) {
      const { want } = planTypeMix(total, percent, plenty);
      expect(want.objective + want.subjective, `${total}·${percent}%`).toBe(total);
    }
    expect(planTypeMix(1, 50, plenty).take).toEqual(counts(1, 0));
    expect(planTypeMix(7, 50, plenty).take).toEqual(counts(4, 3));
  });

  it('이상한 숫자는 범위 안으로 가둔다', () => {
    expect(planTypeMix(Number.NaN, 80, plenty).take).toEqual(counts(0, 0));
    expect(planTypeMix(-5, 80, plenty).take).toEqual(counts(0, 0));
    expect(planTypeMix(10, 150, plenty).take).toEqual(counts(10, 0));
    expect(planTypeMix(10, -20, plenty).take).toEqual(counts(0, 10));
    expect(planTypeMix(10.7, 80, plenty).take).toEqual(counts(8, 2));
  });

  /**
   * ⚠️ 모자란 갈래를 다른 갈래로 채우지 않는다 — 채우면 선생님이 정한 비율이 거짓이 된다.
   */
  it('모자라면 덜 담고 모자란 수를 남긴다', () => {
    const plan = planTypeMix(20, 80, counts(10, 1));

    expect(plan.want).toEqual(counts(16, 4));
    expect(plan.take).toEqual(counts(10, 1));
    expect(plan.short).toEqual(counts(6, 3));
    expect(shortfallMessage(plan)).toContain('객관식 6문항');
    expect(shortfallMessage(plan)).toContain('주관식 3문항');
  });

  it('다 채웠으면 모자람을 말하지 않는다', () => {
    expect(shortfallMessage(planTypeMix(20, 80, plenty))).toBeNull();
  });
});

describe('sampleTypeMix', () => {
  it('갈래별로 정한 수만큼 뽑는다', () => {
    const rows = [
      row('o1', '객관식'), row('o2', '객관식'), row('o3', '객관식'),
      row('s1', '주관식'), row('s2', '서술형'),
    ];
    const picked = sampleTypeMix(rows, counts(2, 1), new Set(), identity);

    expect(picked.map((r) => r.id)).toEqual(['o1', 'o2', 's1']);
  });

  it('이미 담긴 문항은 뽑지 않는다', () => {
    const rows = [row('a', '객관식'), row('b', '객관식'), row('c', '객관식')];
    const picked = sampleTypeMix(rows, counts(2, 0), new Set(['a']), identity);

    expect(picked.map((r) => r.id)).toEqual(['b', 'c']);
  });

  it('풀에 있는 것보다 많이 뽑지 않는다', () => {
    const picked = sampleTypeMix([row('a', '객관식')], counts(5, 5), new Set(), identity);

    expect(picked.map((r) => r.id)).toEqual(['a']);
  });

  it('뽑을 것이 없으면 빈 배열', () => {
    expect(sampleTypeMix([], counts(5, 5), new Set(), identity)).toEqual([]);
    expect(sampleTypeMix([row('a', '객관식')], counts(0, 0), new Set(), identity)).toEqual([]);
  });

  /**
   * ⚠️ 이것이 이 모듈의 핵심 규약이다. 뽑은 것이 흩어지면 캔버스가 저장을 거부한다
   *    (RPC 의 지문 연속성 검사와 `compose.isContiguous`).
   */
  it('같은 지문의 문항은 붙어서 나온다 — 어떻게 섞든', () => {
    const rows = [
      row('p1a', '객관식', 'P1'), row('p1b', '주관식', 'P1'), row('p1c', '객관식', 'P1'),
      row('solo', '객관식'),
      row('p2a', '객관식', 'P2'), row('p2b', '서술형', 'P2'),
      row('p3a', '주관식', 'P3'), row('p3b', '객관식', 'P3'),
    ];

    for (const shuffleFn of [identity, reverse]) {
      const picked = sampleTypeMix(rows, counts(3, 2), new Set(), shuffleFn);
      const items: PaperItem[] = picked.map((r) => ({ problemId: r.id, passageId: r.passage_id }));

      expect(isContiguous(items), shuffleFn === identity ? 'identity' : 'reverse').toBe(true);
      expect(picked).toHaveLength(5);
    }
  });

  it('뽑은 차례는 읽는 순서 그대로다 — 섞은 차례가 아니다', () => {
    const rows = [row('a', '객관식'), row('b', '객관식'), row('c', '객관식')];
    const picked = sampleTypeMix(rows, counts(3, 0), new Set(), reverse);

    expect(picked.map((r) => r.id)).toEqual(['a', 'b', 'c']);
  });

  /** 묶음 안을 안 섞으면 그 지문의 **앞 문항만** 영영 뽑힌다 */
  it('묶음 안에서도 섞는다', () => {
    const rows = [row('q1', '객관식', 'P'), row('q2', '객관식', 'P'), row('q3', '객관식', 'P')];

    expect(sampleTypeMix(rows, counts(1, 0), new Set(), identity)[0].id).toBe('q1');
    expect(sampleTypeMix(rows, counts(1, 0), new Set(), reverse)[0].id).toBe('q3');
  });

  it('묶음 차례도 섞는다', () => {
    const rows = [row('a', '객관식', 'P1'), row('b', '객관식', 'P2')];

    expect(sampleTypeMix(rows, counts(1, 0), new Set(), identity)[0].id).toBe('a');
    expect(sampleTypeMix(rows, counts(1, 0), new Set(), reverse)[0].id).toBe('b');
  });

  it('기본 섞기(무작위)로도 개수와 연속성을 지킨다', () => {
    const rows = Array.from({ length: 40 }, (_, i) => row(
      `r${i}`, i % 3 === 0 ? '주관식' : '객관식', i % 4 === 0 ? null : `P${Math.floor(i / 4)}`,
    ));

    for (let run = 0; run < 30; run += 1) {
      const picked = sampleTypeMix(rows, counts(6, 3), new Set());
      const items: PaperItem[] = picked.map((r) => ({ problemId: r.id, passageId: r.passage_id }));

      expect(isContiguous(items)).toBe(true);
      expect(picked.filter((r) => r.question_type === '객관식')).toHaveLength(6);
      expect(picked.filter((r) => r.question_type !== '객관식')).toHaveLength(3);
      expect(new Set(picked.map((r) => r.id)).size).toBe(9);
    }
  });
});

describe('poolTooBigMessage', () => {
  it('살펴볼 수 있는 크기면 말하지 않는다', () => {
    expect(poolTooBigMessage(TYPE_MIX_POOL_MAX)).toBeNull();
  });

  /** 넘치면 조용히 잘린 목록을 전부로 보게 된다 — 뽑지 않고 좁히라고 말한다 */
  it('넘으면 얼마나 걸렸는지와 상한을 함께 말한다', () => {
    const message = poolTooBigMessage(TYPE_MIX_POOL_MAX + 1);

    expect(message).toContain(String(TYPE_MIX_POOL_MAX + 1));
    expect(message).toContain(String(TYPE_MIX_POOL_MAX));
  });
});
