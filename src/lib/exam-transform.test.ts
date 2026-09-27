import { describe, expect, it } from 'vitest';
import { resolveTransformMode } from './exam-transform';
import type { TransformMode } from './exam-transform';

/**
 * 이 테스트가 고정하는 것: 개념지 탭의 클릭 가능한 마크(`concept-interactive`)는
 * **마킹 모드가 켜져 있을 때만** 나온다. 꺼지면 같은 마크를 클릭할 수 없는 `concept` 로 그린다 —
 * 인쇄하려다 단어를 한 번 누른 것만으로 문서가 바뀌면 안 된다.
 */
describe('resolveTransformMode', () => {
  it('마킹 모드가 켜져 있으면 개념지 탭은 클릭 가능한 마크로 그린다', () => {
    expect(resolveTransformMode('concept-interactive', true)).toBe('concept-interactive');
  });

  it('마킹 모드가 꺼져 있으면 개념지 탭도 클릭할 수 없는 하이라이트로 내린다', () => {
    expect(resolveTransformMode('concept-interactive', false)).toBe('concept');
  });

  const OTHER_MODES: TransformMode[] = ['concept', 'stage1', 'stage2', 'stage3', 'answer'];

  it.each(OTHER_MODES)('%s 모드는 마킹 모드와 무관하게 그대로다', (mode) => {
    expect(resolveTransformMode(mode, true)).toBe(mode);
    expect(resolveTransformMode(mode, false)).toBe(mode);
  });
});
