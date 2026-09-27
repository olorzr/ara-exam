import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { usePassageWorksState, useProblemWorkTitlesState } from './usePassageWorksState';
import type { Passage, PassageWork } from '@/types/problem-bank';

/** 작품 목록과 판만 정한 지문 — 나머지 칸은 이 훅이 보지 않는다 */
function passage(works: PassageWork[], updatedAt: string): Passage {
  return { works, updated_at: updatedAt } as unknown as Passage;
}

const work = (title: string): PassageWork => ({ label: '', title, author: '기형도' });

describe('usePassageWorksState', () => {
  it('저장 뒤 서버가 표준 표기로 바꿨으면 그 값을 받아들인다 — 안 그러면 저장 안 됨 배지가 남는다', () => {
    const { result, rerender } = renderHook(({ p }) => usePassageWorksState(p), {
      initialProps: { p: passage([work('엄마 걱정')], 'v1') },
    });
    act(() => result.current.setWorks([work('엄마걱정')]));
    act(() => result.current.markSaved('v1'));
    // 부모가 저장 결과(대장 표기)로 지문을 갈아 끼운다
    rerender({ p: passage([work('엄마 걱정')], 'v2') });
    expect(result.current.works.map((w) => w.title)).toEqual(['엄마 걱정']);
    expect(result.current.worksRef.current.map((w) => w.title)).toEqual(['엄마 걱정']);
  });

  it('부모가 먼저 갈아 끼우고 저장 함수가 나중에 돌아와도 맞춘다', () => {
    const { result, rerender } = renderHook(({ p }) => usePassageWorksState(p), {
      initialProps: { p: passage([work('이생규장전')], 'v1') },
    });
    act(() => result.current.setWorks([work('이생규장전(李生窺墻傳)')]));
    rerender({ p: passage([work('이생규장전')], 'v2') });
    act(() => result.current.markSaved('v1'));
    expect(result.current.works.map((w) => w.title)).toEqual(['이생규장전']);
  });

  it('저장하지 않았으면 서버 값으로 덮지 않는다 — 치던 칸이 튀어 돌아가면 안 된다', () => {
    const { result, rerender } = renderHook(({ p }) => usePassageWorksState(p), {
      initialProps: { p: passage([work('엄마 걱정')], 'v1') },
    });
    act(() => result.current.setWorks([work('엄마걱정')]));
    rerender({ p: passage([work('엄마 걱정')], 'v2') });
    expect(result.current.works.map((w) => w.title)).toEqual(['엄마걱정']);
  });

  it('표기만이 아니라 작품이 다르면 받아들이지 않는다 — 사람이 고친 것을 지우면 안 된다', () => {
    const { result, rerender } = renderHook(({ p }) => usePassageWorksState(p), {
      initialProps: { p: passage([work('엄마 걱정')], 'v1') },
    });
    act(() => result.current.setWorks([work('빈집')]));
    act(() => result.current.markSaved('v1'));
    rerender({ p: passage([work('엄마 걱정')], 'v2') });
    expect(result.current.works.map((w) => w.title)).toEqual(['빈집']);
  });

  it('같은 작품을 두 표기로 친 줄을 DB 가 하나로 접었어도 받아들인다', () => {
    const { result, rerender } = renderHook(({ p }) => usePassageWorksState(p), {
      initialProps: { p: passage([work('엄마 걱정')], 'v1') },
    });
    act(() => result.current.setWorks([work('엄마 걱정'), work('엄마걱정')]));
    act(() => result.current.markSaved('v1'));
    rerender({ p: passage([work('엄마 걱정')], 'v2') });
    expect(result.current.works.map((w) => w.title)).toEqual(['엄마 걱정']);
  });
});

describe('useProblemWorkTitlesState', () => {
  const problem = (titles: string[], v: string) => ({ work_titles: titles, updated_at: v });

  it('지문 없는 문항도 저장 뒤 표준 표기를 받아들인다', () => {
    const { result, rerender } = renderHook(({ p }) => useProblemWorkTitlesState(p), {
      initialProps: { p: problem([], 'v1') },
    });
    act(() => result.current.setWorkTitles(['엄마걱정', '이생규장전(李生窺墻傳)']));
    act(() => result.current.markSaved('v1'));
    rerender({ p: problem(['엄마 걱정', '이생규장전'], 'v2') });
    expect(result.current.workTitles).toEqual(['엄마 걱정', '이생규장전']);
  });

  it('저장 없이 판만 바뀌면 그대로 둔다', () => {
    const { result, rerender } = renderHook(({ p }) => useProblemWorkTitlesState(p), {
      initialProps: { p: problem(['엄마 걱정'], 'v1') },
    });
    act(() => result.current.setWorkTitles(['엄마걱정']));
    rerender({ p: problem(['엄마 걱정'], 'v2') });
    expect(result.current.workTitles).toEqual(['엄마걱정']);
  });
});
