import { describe, it, expect } from 'vitest';
import { QUIZ_REFERENCE_TEXT_MAX } from './constants';
import { truncateReferencePlain, uniqueReferenceLabels } from './reference';

describe('truncateReferencePlain', () => {
  it('상한 안이면 그대로 두고 잘리지 않았다고 한다', () => {
    expect(truncateReferencePlain('짧은 글')).toEqual({ plain: '짧은 글', truncated: false });
  });

  it('상한을 넘으면 자르고 잘렸다고 알린다 — 안 알리면 "왜 뒷부분을 못 봤지" 가 남는다', () => {
    const long = 'ㄱ'.repeat(QUIZ_REFERENCE_TEXT_MAX + 100);
    const result = truncateReferencePlain(long);
    expect(result.plain).toHaveLength(QUIZ_REFERENCE_TEXT_MAX);
    expect(result.truncated).toBe(true);
  });

  it('딱 상한이면 자르지 않는다', () => {
    const exact = 'ㄱ'.repeat(QUIZ_REFERENCE_TEXT_MAX);
    expect(truncateReferencePlain(exact).truncated).toBe(false);
  });
});

describe('uniqueReferenceLabels', () => {
  it('같은 이름이 겹치면 번호를 붙인다 — 출처가 어느 자료인지 가려야 한다', () => {
    const out = uniqueReferenceLabels([
      { label: '개념지 · 제목 없음' },
      { label: '개념지 · 제목 없음' },
      { label: '전문 · 봄봄' },
      { label: '개념지 · 제목 없음' },
    ]);
    expect(out.map((r) => r.label)).toEqual([
      '개념지 · 제목 없음', '개념지 · 제목 없음 (2)', '전문 · 봄봄', '개념지 · 제목 없음 (3)',
    ]);
  });

  it('하나씩 더해도 이름이 겹치지 않는다 — 이 함수는 번호가 붙은 목록 위에서 다시 돈다', () => {
    // 직접 추가는 붙을 때마다 전체 목록으로 다시 돈다. 원래 이름만 세면 셋째 '봄봄' 이
    // 또 '(2)' 가 되어 앞의 것과 같아지고, 두 자료의 근거가 정답표에서 한 출처로 찍힌다
    let cur: { label: string }[] = [];
    for (let i = 0; i < 4; i += 1) cur = uniqueReferenceLabels([...cur, { label: '개념지 · 봄봄' }]);
    expect(cur.map((r) => r.label)).toEqual([
      '개념지 · 봄봄', '개념지 · 봄봄 (2)', '개념지 · 봄봄 (3)', '개념지 · 봄봄 (4)',
    ]);
    expect(new Set(cur.map((r) => r.label)).size).toBe(4);
  });

  it('이미 번호가 붙어 있는 이름과도 부딪히지 않는다', () => {
    const out = uniqueReferenceLabels([
      { label: '개념지 · 봄봄 (2)' }, { label: '개념지 · 봄봄' }, { label: '개념지 · 봄봄' },
    ]);
    expect(new Set(out.map((r) => r.label)).size).toBe(3);
  });

  it('원본을 건드리지 않는다', () => {
    const input = [{ label: '가', plain: 'x' }, { label: '가', plain: 'y' }];
    const out = uniqueReferenceLabels(input);
    expect(input[1].label).toBe('가');
    expect(out[1]).toEqual({ label: '가 (2)', plain: 'y' });
  });
});
