import { describe, it, expect } from 'vitest';
import { MAX_TURN_IMAGES } from '@/lib/ai/codex/protocol';
import {
  ANSWER_KEY_PAGES_PER_BATCH, OCR_BATCH_OVERLAP, OCR_PAGES_PER_BATCH,
} from './constants';

/**
 * 정책값끼리의 약속을 고정한다.
 *
 * 여기 걸린 것들은 어기면 **조용히 내용이 사라지는** 조합이다. 실행해 봐야 드러나지 않고
 * (경고도 안 뜬다) 인쇄물에서야 알게 되므로 테스트로 막는다.
 */
describe('OCR 정책값', () => {
  it('2단 쪽을 갈라도 한 turn 의 이미지 상한을 넘지 않는다', () => {
    // ⚠️ generateDraft 는 상한을 넘는 이미지를 **말없이 잘라낸다**(protocol.ts).
    //    쪽을 갈라 보내면 한 쪽이 두 장이므로 묶음 크기를 올릴 때 여기가 먼저 깨져야 한다
    expect(OCR_PAGES_PER_BATCH * 2).toBeLessThanOrEqual(MAX_TURN_IMAGES);
  });

  it('정답표 묶음도 상한 안이다 — 답지 사진은 가르지 않으므로 한 장씩이다', () => {
    expect(ANSWER_KEY_PAGES_PER_BATCH).toBeLessThanOrEqual(MAX_TURN_IMAGES);
  });

  it('겹침은 묶음 크기보다 작다 — 같으면 묶음 나누기가 제자리걸음한다', () => {
    expect(OCR_BATCH_OVERLAP).toBeLessThan(OCR_PAGES_PER_BATCH);
  });

  it('쪽 경계를 넘는 지문을 위해 겹쳐 읽는다 — 0 으로 되돌리지 말 것', () => {
    expect(OCR_BATCH_OVERLAP).toBeGreaterThanOrEqual(1);
  });
});
