import { describe, it, expect } from 'vitest';
import { parseAnswerKeyDraft } from './parse-answer-key';
import { warningText } from './warnings';

/** 경고 메시지를 한 줄로 이어 본다 */
const said = (warnings: { message: string }[]) => warnings.map((w) => w.message).join(' | ');

describe('parseAnswerKeyDraft', () => {
  const key = (answers: unknown[], warnings: string[] = []) =>
    JSON.stringify({ answers, warnings });

  it('번호와 정답을 담는다', () => {
    const draft = parseAnswerKeyDraft(key([{ no: 1, answer: '③', score: 3.5 }]))!;
    // 배점은 스키마에서 뺐다 — 모델이 보내도 담지 않는다
    expect(draft.answers).toEqual([{ no: 1, answer: '3' }]);
  });

  it('문항 범위를 벗어난 번호는 버린다', () => {
    const draft = parseAnswerKeyDraft(key([{ no: 99, answer: '1' }]), { maxNumber: 20 })!;
    expect(draft.answers).toHaveLength(0);
    expect(said(draft.warnings)).toContain('99');
  });

  it('같은 번호가 두 번이면 먼저 읽은 값을 남긴다', () => {
    const draft = parseAnswerKeyDraft(
      key([{ no: 1, answer: '1' }, { no: 1, answer: '5' }]),
    )!;
    expect(draft.answers).toEqual([{ no: 1, answer: '1' }]);
    expect(warningText(draft.warnings[0])).toContain('1번이 두 번');
  });

  it('모양이 깨지면 null', () => {
    expect(parseAnswerKeyDraft('{}')).toBeNull();
    expect(parseAnswerKeyDraft('아니오')).toBeNull();
  });
});
