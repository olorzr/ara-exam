import { describe, it, expect } from 'vitest';
import type { PrintBundle } from '@/types/print-scan';
import { hasMatchSignals, signalsFromBundle, signalsFromDraft, signalsKey } from './signals';
import type { PickedPassageMeta } from './types';

const picked: PickedPassageMeta = {
  id: 'p1', unitPath: ['1. 문학의 갈래', '(1) 소설'], textbook: '천재(정호웅)',
  grade: '중2', schoolName: '상현중', year: '2026',
};

describe('signalsFromDraft', () => {
  it('감싼 기호를 벗긴다 — DB 에는 「」 없이 저장돼 있다', () => {
    expect(signalsFromDraft({ title: '「봄봄」', author: ' 김유정 ' }, null).title).toBe('봄봄');
    expect(signalsFromDraft({ title: '「봄봄」', author: ' 김유정 ' }, null).author).toBe('김유정');
  });

  it('한 글자 제목은 신호로 쓰지 않는다 — 그 글자가 든 자료가 전부 걸려 온다', () => {
    expect(signalsFromDraft({ title: '봄', author: '' }, null).title).toBe('');
    expect(signalsFromDraft({ title: '봄봄', author: '' }, null).title).toBe('봄봄');
  });

  it('붙여넣기면 단원·학교 신호가 없다', () => {
    const s = signalsFromDraft({ title: '봄봄', author: '' }, null);
    expect(s.unitPath).toEqual([]);
    expect(s.excludePassageId).toBeNull();
    expect(s.textbook).toBe('');
  });

  it('아카이브에서 고른 지문은 단원·학교까지 들고 오고 자기 자신을 뺀다', () => {
    const s = signalsFromDraft({ title: '봄봄', author: '' }, picked);
    expect(s.unitPath).toEqual(['1. 문학의 갈래', '(1) 소설']);
    expect(s.textbook).toBe('천재(정호웅)');
    expect(s.excludePassageId).toBe('p1');
  });
});

describe('hasMatchSignals', () => {
  it('아무 신호도 없으면 찾으러 가지 않는다 — 최근 자료를 아무거나 붙이면 안 된다', () => {
    expect(hasMatchSignals(signalsFromDraft({ title: '', author: '' }, null))).toBe(false);
    expect(hasMatchSignals(signalsFromDraft({ title: '봄', author: '' }, null))).toBe(false);
  });

  it('제목·지은이·단원·학교 가운데 하나만 있어도 찾는다', () => {
    expect(hasMatchSignals(signalsFromDraft({ title: '봄봄', author: '' }, null))).toBe(true);
    expect(hasMatchSignals(signalsFromDraft({ title: '', author: '김유정' }, null))).toBe(true);
    expect(hasMatchSignals(signalsFromDraft({ title: '', author: '' }, picked))).toBe(true);
  });

  it('교과서만 있고 단원이 없으면 단원 신호로 치지 않는다', () => {
    const onlyTextbook = { ...picked, unitPath: [], schoolName: '' };
    expect(hasMatchSignals(signalsFromDraft({ title: '', author: '' }, onlyTextbook))).toBe(false);
  });
});

describe('signalsKey', () => {
  it('같은 신호면 같은 열쇠다 — 그래야 두 번 찾지 않는다', () => {
    const a = signalsFromDraft({ title: '봄봄', author: '김유정' }, picked);
    const b = signalsFromDraft({ title: '봄봄', author: '김유정' }, picked);
    expect(signalsKey(a)).toBe(signalsKey(b));
  });

  it('하나라도 다르면 열쇠가 갈린다', () => {
    const a = signalsFromDraft({ title: '봄봄', author: '' }, null);
    const b = signalsFromDraft({ title: '동백꽃', author: '' }, null);
    expect(signalsKey(a)).not.toBe(signalsKey(b));
  });

  it('자기 시험지 id 가 다르면 다른 신호다 — 빠뜨리면 다시 찾기가 건너뛴다', () => {
    const base = signalsFromDraft({ title: '봄봄', author: '' }, null);
    expect(signalsKey({ ...base, excludeSheetId: 'a' }))
      .not.toBe(signalsKey({ ...base, excludeSheetId: 'b' }));
  });
});

/** 학교 프린트 묶음 — 문답 시험지가 자료를 찾을 때 쓰는 신호의 출처다 */
const bundle = (over: Partial<PrintBundle> = {}) => ({
  name: '2026 광희중학교 중2 2학기 중간 홍길동전',
  school_name: '광희중학교',
  grade: '중2',
  year: '2026',
  qa_meta: {},
  ...over,
}) as Pick<PrintBundle, 'name' | 'school_name' | 'grade' | 'year' | 'qa_meta'>;

describe('signalsFromBundle', () => {
  it('프린트 이름에서 작품을 떼어 신호로 쓴다 — 선생님이 직접 친 값이라 가장 믿을 만하다', () => {
    const signals = signalsFromBundle({
      bundle: bundle(), scanTitle: '2026 광희중학교 중2 2학기 중간', sheetId: 's1',
    });
    expect(signals.title).toBe('홍길동전');
    expect(signals).toMatchObject({ schoolName: '광희중학교', grade: '중2', year: '2026' });
  });

  it('이름에 작품이 없으면 프린트에 인쇄돼 있던 작품을 쓴다', () => {
    const signals = signalsFromBundle({
      bundle: bundle({ qa_meta: { work: { title: '동백꽃', author: '김유정' } } }),
      scanTitle: '2026 광희중학교 중2 2학기 중간 홍길동전',
      sheetId: null,
    });
    expect(signals.title).toBe('동백꽃');
    expect(signals.author).toBe('김유정');
  });

  it('⚠️ 자기 시험지는 후보에서 빼도록 id 를 싣는다 — 안 그러면 스스로 붙는다', () => {
    expect(signalsFromBundle({ bundle: bundle(), scanTitle: '', sheetId: 'sheet-1' }).excludeSheetId)
      .toBe('sheet-1');
  });

  it('학교 프린트는 교과서 단원 축이 없다 — 대신 학교·학년·학년도가 신호다', () => {
    const signals = signalsFromBundle({ bundle: bundle(), scanTitle: '', sheetId: null });
    expect(signals.textbook).toBe('');
    expect(signals.unitPath).toEqual([]);
  });

  it('작품을 못 찾아도 학교만 있으면 찾아볼 만하다', () => {
    const signals = signalsFromBundle({
      bundle: bundle({ name: '2026 광희중학교 중2 2학기 중간' }),
      scanTitle: '2026 광희중학교 중2 2학기 중간',
      sheetId: null,
    });
    expect(signals.title).toBe('');
    expect(hasMatchSignals(signals)).toBe(true);
  });
});
