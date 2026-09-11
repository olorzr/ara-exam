import { describe, it, expect } from 'vitest';
import { buildAnswerKeyPrompt } from './prompt-answer-key';
import type { OcrSourceMeta } from './prompt';

const source: OcrSourceMeta = {
  source_type: '내신기출',
  title: '상현중 2학년 1학기 중간고사',
  school_name: '상현중',
  year: '2026',
  grade: '중2',
  semester: '1학기',
  exam_type: '중간',
  publisher: '',
  textbook: '천재(노미숙)',
};

describe('buildAnswerKeyPrompt', () => {
  it('정답표만 읽고 풀지 말라고 한다', () => {
    const p = buildAnswerKeyPrompt({ source, pages: [12], maxNumber: 20 });
    expect(p).toContain('문제를 풀어서 정답을 만들어내는 것은 금지');
    expect(p).toContain('1~20');
  });

  it('배점은 읽지 않는다', () => {
    const p = buildAnswerKeyPrompt({ source, pages: [12] });
    expect(p).toContain('배점은 읽지 않는다');
  });

  it('문항 수를 모르면 범위를 강요하지 않는다', () => {
    const p = buildAnswerKeyPrompt({ source, pages: [12] });
    expect(p).toContain('문항 수를 모른다');
  });

  it('별도 답지는 쪽 번호 대신 장수를 알린다 — 원본과 쪽 번호가 무관하다', () => {
    const p = buildAnswerKeyPrompt({ source, pages: [1, 2], imageLabel: '답지 사진' });
    expect(p).toContain('답지 사진 2장');
    expect(p).not.toContain('1·2쪽');
  });
});
