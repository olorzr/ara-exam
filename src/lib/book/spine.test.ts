import { describe, expect, it } from 'vitest';
import { MM_TO_PX } from '@/lib/print/constants';
import { INNER_PAPERS, innerPaperOf, DEFAULT_INNER_PAPER } from './inner-papers';
import {
  BLEED_MM, coverSpreadGeometry, padPageCount, spineInkFor, spineTypeSize, spineWidthMm, TRIM_W_MM,
} from './spine';

describe('spineWidthMm — 열림인쇄 견적 화면과 같은 식', () => {
  it.each([
    [200, 0.09, 9.5],
    [100, 0.11, 6],
    [48, 0.09, 2.7],
    [120, 0.1, 6.5],
    [96, 0.09, 4.8],
    [400, 0.22, 44.5],
  ])('%i쪽 · %smm → %smm', (pages, thickness, expected) => {
    expect(spineWidthMm(pages, thickness)).toBe(expected);
  });

  it('단면이면 쪽 수 그대로 곱하고 1mm 를 더한다', () => {
    expect(spineWidthMm(100, 0.09, false)).toBe(10);
  });

  it('소수 한 자리로 반올림한다(부동소수 오차를 견적 화면과 같은 Math.round 로)', () => {
    // 100 × 0.09 = 9.000000000000002 — 그대로 더하면 9.500000000000002
    expect(spineWidthMm(200, 0.09)).toBe(9.5);
    expect(Number.isInteger(spineWidthMm(260, 0.13) * 10)).toBe(true);
  });
});

describe('padPageCount', () => {
  it.each([[0, 0], [1, 4], [4, 4], [5, 8], [198, 200]])('%i → %i', (n, expected) => {
    expect(padPageCount(n)).toBe(expected);
  });
});

describe('coverSpreadGeometry', () => {
  it('200쪽 · 미색 80g(9.5mm) → 작업사이즈 436 × 303, 남는 0.5mm 는 바깥 여백에 반씩', () => {
    const g = coverSpreadGeometry(9.5);
    expect(g.widthMm).toBe(436);
    expect(g.heightMm).toBe(303);
    expect(g.outerBleedMm).toBeCloseTo(3.25, 10);
    expect(g.spineXMm).toBeCloseTo(213.25, 10);
    expect(g.frontXMm).toBeCloseTo(222.75, 10);
  });

  it.each([7, 7.4, 2.7, 44.5])('책등 %smm — 바깥 여백 + 재단 210 + 책등 + 210 + 바깥 여백 = 작업 폭', (spine) => {
    const g = coverSpreadGeometry(spine);
    expect(g.widthMm).toBe(Math.ceil(TRIM_W_MM * 2 + spine + 6));
    expect(g.frontXMm + TRIM_W_MM + g.outerBleedMm).toBeCloseTo(g.widthMm, 9);
    expect(g.outerBleedMm).toBeGreaterThanOrEqual(BLEED_MM);
    expect(g.outerBleedMm).toBeLessThan(BLEED_MM + 0.5);
  });
});

describe('spineInkFor', () => {
  it('어두운 바탕에는 흰 글자, 밝은 바탕에는 검은 글자', () => {
    expect(spineInkFor('#1f3a5f')).toBe('#ffffff');
    expect(spineInkFor('#000000')).toBe('#ffffff');
    expect(spineInkFor('#ffffff')).toBe('#111111');
    expect(spineInkFor('#f5d76e')).toBe('#111111');
  });

  it('모양이 틀리면 흰 글자', () => {
    expect(spineInkFor('navy')).toBe('#ffffff');
  });
});

describe('spineTypeSize', () => {
  it('짧은 제목은 책등 폭에 맞춘 기준 크기 그대로', () => {
    const size = spineTypeSize('국어 문학', '아라국어논술', 9.5);
    expect(size.titlePx).toBeCloseTo(Math.min(30, 9.5 * MM_TO_PX * 0.5), 0);
    expect(size.brandPx).toBeLessThan(size.titlePx);
  });

  it('긴 제목은 세로 자리에 들어가도록 줄인다', () => {
    const short = spineTypeSize('국어', '아라국어논술', 9.5).titlePx;
    const long = spineTypeSize('2026 고등 1학년 2학기 기말고사 대비 현대시·고전시가·현대소설 기출 문제 모음집', '아라국어논술', 9.5).titlePx;
    expect(long).toBeLessThan(short);
    expect(long).toBeGreaterThan(0);
  });

  it('글자 몸이 작은 글꼴은 제목만 키우고(학원 이름은 그대로), 긴 제목은 키운 크기에서 다시 맞춘다', () => {
    const plain = spineTypeSize('국어 문학', '아라국어논술', 9.5);
    const scaled = spineTypeSize('국어 문학', '아라국어논술', 9.5, 1.5);
    expect(scaled.titlePx).toBeCloseTo(plain.titlePx * 1.5, 0);
    expect(scaled.brandPx).toBe(plain.brandPx);
    const longTitle = '2026 고등 1학년 2학기 기말고사 대비 현대시·고전시가·현대소설 기출 문제 모음집 · 정답 및 해설';
    // 같은 자리를 쓰므로 키운 기준에서 출발해도 결과 크기는 키우지 않은 쪽의 1.5 배를 넘지 않는다
    expect(spineTypeSize(longTitle, '아라국어논술', 9.5, 1.5).titlePx)
      .toBeLessThanOrEqual(spineTypeSize(longTitle, '아라국어논술', 9.5).titlePx * 1.5 + 0.1);
    expect(spineTypeSize('국어', '아라국어논술', 9.5, 0).titlePx).toBe(spineTypeSize('국어', '아라국어논술', 9.5).titlePx);
  });
});

describe('inner-papers', () => {
  it('기본 용지는 모조지(미색) 80g · 0.09mm', () => {
    expect(innerPaperOf(DEFAULT_INNER_PAPER)).toEqual({ code: '1011', name: '모조지(미색) 80g', thicknessMm: 0.09 });
  });

  it('모르는 코드는 기본 용지로', () => {
    expect(innerPaperOf('9999').code).toBe(DEFAULT_INNER_PAPER);
  });

  it('18종, 코드는 겹치지 않는다', () => {
    expect(INNER_PAPERS).toHaveLength(18);
    expect(new Set(INNER_PAPERS.map((p) => p.code)).size).toBe(18);
  });
});
