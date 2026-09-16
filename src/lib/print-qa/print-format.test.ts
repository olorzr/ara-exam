import { describe, expect, it } from 'vitest';
import type { PrintQaItem } from '@/types/print-scan';
import { answerLineCount, answerTag, qaPaperTitle, qaSourceLabels } from './print-format';

const item = (over: Partial<PrintQaItem> = {}): PrintQaItem => ({
  id: 'a', label: '1', lead: '', question: '물음', answer: '', answerSource: 'none',
  studentAnswer: '', evidence: '', evidenceSource: null, verified: true, leadApproved: false, ...over,
});

describe('qaPaperTitle', () => {
  it('문제지에는 꼬리표를 안 붙인다 — 학생이 받는 종이다', () => {
    expect(qaPaperTitle('2026 광희중 동백꽃', 'paper')).toBe('2026 광희중 동백꽃');
    expect(qaPaperTitle('2026 광희중 동백꽃', 'teacher')).toBe('2026 광희중 동백꽃 - 교사용');
    expect(qaPaperTitle('2026 광희중 동백꽃', 'key')).toBe('2026 광희중 동백꽃 - 답지');
  });

  it('이름이 비어 있어도 제목은 빈칸으로 두지 않는다', () => {
    expect(qaPaperTitle('  ', 'paper')).toBe('학교 프린트');
  });
});

describe('qaSourceLabels', () => {
  it('분류를 한 줄로 잇는다', () => {
    expect(qaSourceLabels({
      school_name: '광희중학교', year: '2026', grade: '중2', semester: '2학기', exam_type: '중간',
    })).toEqual(['광희중학교 · 2026학년도 · 중2 · 2학기 · 중간']);
  });

  it('미지정 칸은 건너뛰고, 전부 비면 줄을 아예 안 만든다', () => {
    expect(qaSourceLabels({
      school_name: '광희중학교', year: '', grade: '중2', semester: '', exam_type: '',
    })).toEqual(['광희중학교 · 중2']);
    expect(qaSourceLabels({
      school_name: '', year: '', grade: '', semester: '', exam_type: '',
    })).toEqual([]);
  });
});

describe('answerLineCount', () => {
  it('답을 알면 그 길이로 줄 수를 정한다', () => {
    expect(answerLineCount(item({ answer: '나(소년)' }))).toBe(2);
    expect(answerLineCount(item({ answer: '가'.repeat(50) }))).toBe(3);
    expect(answerLineCount(item({ answer: '가'.repeat(120) }))).toBe(4);
  });

  it('답을 모르면 물음의 말투로 가늠한다', () => {
    expect(answerLineCount(item({ question: '심리를 서술하시오.' }))).toBe(4);
    expect(answerLineCount(item({ question: '그렇게 본 까닭을 쓰시오.' }))).toBe(4);
  });

  it("⚠️ '서술자' 는 긴 답이 아니다 — 어간만 보면 낱말 물음에 네 줄이 그어진다", () => {
    expect(answerLineCount(item({ question: '이 글의 서술자는 누구인가?' }))).toBe(2);
    expect(answerLineCount(item({ question: '설명문의 갈래는?' }))).toBe(2);
  });
});

describe('answerTag', () => {
  it('프린트에 인쇄돼 있던 답에는 아무것도 안 붙인다', () => {
    expect(answerTag(item({ answerSource: 'printed', answer: '나' }))).toBeNull();
    expect(answerTag(item({ answerSource: 'none' }))).toBeNull();
  });

  it('AI 답에는 출처를 찍고, 근거가 없으면 확인하라고 한다', () => {
    expect(answerTag(item({ answerSource: 'ai', evidenceSource: '개념지 · 봄봄' })))
      .toEqual({ text: 'AI 모범답안 · [개념지 · 봄봄]', check: false });
    expect(answerTag(item({ answerSource: 'ai', evidenceSource: '' })))
      .toEqual({ text: 'AI 모범답안 · [이 프린트]', check: false });
    expect(answerTag(item({ answerSource: 'ai', evidenceSource: null })))
      .toEqual({ text: 'AI 모범답안 · 근거 없음', check: true });
  });

  it('학생 손글씨는 확인 대상으로 표시한다', () => {
    expect(answerTag(item({ answerSource: 'handwritten' })))
      .toEqual({ text: '학생이 쓴 답', check: true });
    expect(answerTag(item({ answerSource: 'teacher' })))
      .toEqual({ text: '직접 쓴 답', check: false });
  });
});
