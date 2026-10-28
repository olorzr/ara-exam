import { describe, expect, it } from 'vitest';
import {
  CALLOUT_LABEL_MAX, CALLOUT_PRESETS, CALLOUT_TONE_LABELS, CALLOUT_TONES, REFERENCE_TABLE_LAYOUTS,
  isCalloutLabel, isCalloutTone, isFlowDirection,
} from './workbook-markup';

describe('isCalloutLabel', () => {
  it('책에 인쇄된 말머리를 받는다', () => {
    for (const { label } of CALLOUT_PRESETS) expect(isCalloutLabel(label)).toBe(true);
    expect(isCalloutLabel('개념 1')).toBe(true);
    expect(isCalloutLabel('한 걸음 더!')).toBe(true);
    expect(isCalloutLabel('원인 · 결과')).toBe(true);
  });

  it('CSS content 로 새는 글자(따옴표·꺾쇠·&)와 앞뒤 공백을 막는다', () => {
    for (const bad of ['', ' 학습', '학습 ', '"x"', "a'b", '<b>', 'a&b', '·앞', 'a\\b']) {
      expect(isCalloutLabel(bad)).toBe(false);
    }
  });

  it('길이 상한', () => {
    expect(isCalloutLabel('가'.repeat(CALLOUT_LABEL_MAX))).toBe(true);
    expect(isCalloutLabel('가'.repeat(CALLOUT_LABEL_MAX + 1))).toBe(false);
  });
});

describe('갈래·방향·표 모양', () => {
  it('고르기 칸의 갈래는 전부 아는 갈래이고 이름이 있다', () => {
    for (const { tone } of CALLOUT_PRESETS) expect(isCalloutTone(tone)).toBe(true);
    for (const tone of CALLOUT_TONES) expect(CALLOUT_TONE_LABELS[tone]).toBeTruthy();
    expect(isCalloutTone('red')).toBe(false);
  });

  it('도식 방향은 아래·오른쪽뿐', () => {
    expect(isFlowDirection('down')).toBe(true);
    expect(isFlowDirection('right')).toBe(true);
    expect(isFlowDirection('up')).toBe(false);
  });

  it('표 모양은 나란히·여백 해설·어휘 풀이 셋', () => {
    expect([...REFERENCE_TABLE_LAYOUTS].sort()).toEqual(['gloss', 'verse', 'vocab']);
  });
});
