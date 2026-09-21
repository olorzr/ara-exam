import { describe, it, expect } from 'vitest';
import {
  OMR_SHEET_QUESTIONS,
  omrSheetCount,
  omrSlotLabel,
  omrSlotOf,
  startsNewOmrSheet,
} from './omr-sheet';

describe('omrSheetCount', () => {
  it('90문항까지는 한 장이다', () => {
    expect(omrSheetCount(1)).toBe(1);
    expect(omrSheetCount(OMR_SHEET_QUESTIONS)).toBe(1);
  });

  it('90을 넘으면 장이 늘어난다', () => {
    expect(omrSheetCount(91)).toBe(2);
    expect(omrSheetCount(153)).toBe(2);
    expect(omrSheetCount(180)).toBe(2);
    expect(omrSheetCount(181)).toBe(3);
    expect(omrSheetCount(310)).toBe(4);
  });

  it('문항이 없으면 0장이다', () => {
    expect(omrSheetCount(0)).toBe(0);
    expect(omrSheetCount(-5)).toBe(0);
    expect(omrSheetCount(Number.NaN)).toBe(0);
  });
});

describe('omrSlotOf / omrSlotLabel', () => {
  it('첫 장은 통번호와 칸 번호가 같다', () => {
    expect(omrSlotOf(0)).toEqual({ sheet: 1, slot: 1 });
    expect(omrSlotOf(89)).toEqual({ sheet: 1, slot: 90 });
  });

  it('91번은 2장째 1번 칸이다', () => {
    expect(omrSlotOf(90)).toEqual({ sheet: 2, slot: 1 });
    expect(omrSlotLabel(90)).toBe('2-1');
    expect(omrSlotLabel(152)).toBe('2-63');
    expect(omrSlotLabel(180)).toBe('3-1');
  });
});

describe('startsNewOmrSheet', () => {
  it('첫 문항은 새 장의 시작으로 치지 않는다', () => {
    expect(startsNewOmrSheet(0)).toBe(false);
  });

  it('90의 배수 인덱스(91번·181번)에서 새 장이 시작된다', () => {
    expect(startsNewOmrSheet(89)).toBe(false);
    expect(startsNewOmrSheet(90)).toBe(true);
    expect(startsNewOmrSheet(180)).toBe(true);
  });
});
