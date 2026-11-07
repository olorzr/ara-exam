import { describe, expect, it } from 'vitest';
import {
  CALLOUT_LABEL_MAX, CALLOUT_PRESETS, CALLOUT_TONE_LABELS, CALLOUT_TONES, NOTE_KIND_VOCAB, NOTE_POS_OVER, PHRASE_NOTE_MAX,
  REFERENCE_TABLE_LAYOUTS, SHAPE_GLYPHS, SHAPE_KINDS, SHAPE_LABELS,
  isCalloutLabel, isCalloutTone, isFlowDirection, isNoteKind, isNotePos, isPhraseNote, isShapeKind,
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

describe('구절 풀이', () => {
  it('자습서에 적힌 풀이를 받는다', () => {
    for (const note of ['시각적 심상', '부모님의 구두', "'닻' = 휴식", '(비유)', '가'.repeat(PHRASE_NOTE_MAX)]) {
      expect(isPhraseNote(note)).toBe(true);
    }
  });

  it('빈 글자·앞뒤 공백·상한 초과·보이지 않는 글자를 막는다', () => {
    for (const bad of ['', ' 심상', '심상 ', '가'.repeat(PHRASE_NOTE_MAX + 1), '심\u0007상', '심\u200b상', '심\ue000상', '심\n상', '현실 > 이상', 'a<b']) {
      expect(isPhraseNote(bad)).toBe(false);
    }
  });

  it('갈래 값은 vocab 하나뿐이다 — 해설은 속성을 비운다', () => {
    expect(isNoteKind(NOTE_KIND_VOCAB)).toBe(true);
    for (const bad of ['', 'term', 'VOCAB', ' vocab']) expect(isNoteKind(bad)).toBe(false);
  });

  it('자리 값은 over 하나뿐이다 — 아래는 속성을 비운다', () => {
    expect(isNotePos(NOTE_POS_OVER)).toBe(true);
    expect(isNotePos('under')).toBe(false);
    expect(isNotePos('')).toBe(false);
  });
});

describe('표식', () => {
  it('다섯 가지이고 이름이 있다', () => {
    expect([...SHAPE_KINDS]).toEqual(['box', 'circle', 'triangle', 'diamond', 'star']);
    for (const kind of SHAPE_KINDS) {
      expect(isShapeKind(kind)).toBe(true);
      expect(SHAPE_LABELS[kind]).toBeTruthy();
    }
    expect(isShapeKind('square')).toBe(false);
  });

  it('두르는 표식(□ ○)에는 앞붙임 기호가 없다', () => {
    expect(Object.keys(SHAPE_GLYPHS).sort()).toEqual(['diamond', 'star', 'triangle']);
  });
});
