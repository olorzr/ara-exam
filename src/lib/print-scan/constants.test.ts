import { describe, it, expect } from 'vitest';
import { MAX_TURN_IMAGES } from '@/lib/ai/codex/protocol';
import { OCR_SPLIT_COLUMNS } from '@/lib/problem-ocr/constants';
import { PRINT_BATCH_OVERLAP, PRINT_PAGES_PER_BATCH } from './constants';

/**
 * 어기면 **조용히 내용이 사라지거나 겹치는** 조합을 고정한다.
 * 실행해 봐야 드러나지 않고 인쇄물에서야 알게 되므로 테스트로 막는다.
 */
describe('학교 프린트 읽기 정책값', () => {
  it('2단 쪽을 갈라도 한 turn 의 이미지 상한을 넘지 않는다', () => {
    // ⚠️ generateDraft 는 상한을 넘는 이미지를 **말없이 잘라낸다**(protocol.ts).
    //    쪽을 갈라 보내면 한 쪽이 두 장이므로 묶음 크기를 올릴 때 여기가 먼저 깨져야 한다
    expect(OCR_SPLIT_COLUMNS).toBe(true);
    expect(PRINT_PAGES_PER_BATCH * 2).toBeLessThanOrEqual(MAX_TURN_IMAGES);
  });

  it('겹치지 않는다 — 평문은 지문처럼 합칠 수 없어 겹치면 같은 글이 두 번 들어간다', () => {
    expect(PRINT_BATCH_OVERLAP).toBe(0);
  });

  it('겹침은 묶음 크기보다 작다 — 같으면 묶음 나누기가 제자리걸음한다', () => {
    expect(PRINT_BATCH_OVERLAP).toBeLessThan(PRINT_PAGES_PER_BATCH);
  });
});
