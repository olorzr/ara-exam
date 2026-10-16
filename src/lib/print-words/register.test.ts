import { describe, expect, it, vi } from 'vitest';

/**
 * 단어 등록 영수증의 저장이 실패해도 **던지지 않는다** (2026-10-15 리뷰 7번 점검).
 *
 * `updateBundle` 이 이제 0행(지워진 묶음)에 던지므로, 영수증 저장이 그 오류를 그대로 올리면
 * `runBundle` 바깥에서 이미 저장된 시험지가 실패로 보인다. 경고로만 남는지 고정한다.
 */

vi.mock('./run', () => ({
  runPrintWords: async () => ({
    entries: [],
    dropped: { noMeaning: [], unverified: [], notInText: 0, malformed: 0 },
  }),
}));
vi.mock('@/lib/words-save', () => ({ ensureCategoryId: vi.fn(), insertWordsToCategory: vi.fn() }));
vi.mock('@/lib/problem-ocr/batch-run', () => ({ FATAL_CODES: new Set() }));

const { registerBundleWords } = await import('./register');

describe('registerBundleWords — 영수증 저장 실패', () => {
  it('⚠️ 영수증을 못 저장해도 던지지 않고 경고로 알린다', async () => {
    const onWarnings = vi.fn();
    const result = await registerBundleWords({
      bundle: { name: '합성 프린트', school_name: '합성중', grade: '중2' } as never,
      html: '<p>본문</p>',
      category: {} as never,
      persist: async () => { throw new Error('이 프린트를 찾지 못했어요.'); },
      port: 8899,
      pref: { model: null, effort: null },
      onWarnings,
    });

    expect(result.fatal).toBeNull();
    expect(onWarnings).toHaveBeenCalledWith(expect.arrayContaining([
      expect.stringContaining('단어 등록 결과를 저장하지 못했어요'),
    ]));
  });
});
