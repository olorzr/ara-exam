import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { ComponentProps } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import ExamPreview from './ExamPreview';
import { DEFAULT_CONCEPT_CATEGORY } from '@/lib/concept-sheet-form';

/**
 * 이 테스트가 고정하는 것: 미리보기에서 마킹은 **마킹 모드가 켜져 있을 때만** 바뀐다.
 * 기존 개념지는 미리보기로 바로 열리므로, 꺼진 상태에서 단어를 누르거나 드래그한 것만으로
 * 문서가 바뀌면 안 된다.
 *
 * ⚠️ 렌더러(`ExamSheetRenderer`)를 목으로 두지 않는다 — 목이면 모드 가르기가 깨져도 초록이다.
 * 조회는 `.a4-stack`(실제 인쇄면)으로 좁힌다: `.a4-measure` 가 같은 블록을 한 벌 더 그린다.
 */

/** jsdom 은 레이아웃을 하지 않으므로 모든 요소에 같은 높이를 준다(푸터 0 이면 측정이 멈춘다) */
const STUB_H = 20;

beforeAll(() => {
  Object.defineProperty(Element.prototype, 'getBoundingClientRect', {
    configurable: true,
    value() {
      return { height: STUB_H, width: 0, top: 0, left: 0, right: 0, bottom: STUB_H, x: 0, y: 0, toJSON: () => ({}) };
    },
  });

  // jsdom 에 ResizeObserver 가 없다
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const WORD = '갈래';
const HTML = `<p>이 시의 <mark data-concept="true">${WORD}</mark>는 자유시다.</p>`;

function renderPreview(over: Partial<ComponentProps<typeof ExamPreview>> = {}) {
  const onConceptClick = vi.fn();
  const onConceptDrag = vi.fn();
  const onToggle = vi.fn();
  const utils = render(
    <ExamPreview
      editorHTML={HTML}
      category={DEFAULT_CONCEPT_CATEGORY}
      markCount={1}
      activeTab="concept"
      onTabChange={() => {}}
      onBack={() => {}}
      onConceptClick={onConceptClick}
      onConceptDrag={onConceptDrag}
      markingMode={false}
      onToggleMarkingMode={onToggle}
      {...over}
    />,
  );
  const stack = utils.container.querySelector('.a4-stack');
  if (!stack) throw new Error('인쇄면(.a4-stack)을 찾지 못했어요');
  const area = utils.container.querySelector('.eb-preview-area');
  if (!area) throw new Error('미리보기 영역(.eb-preview-area)을 찾지 못했어요');
  return { stack, area, onConceptClick, onConceptDrag, onToggle };
}

/** 드래그로 단어를 고른 것처럼 선택 영역을 흉내 낸다 */
function stubSelection(text: string) {
  const removeAllRanges = vi.fn();
  vi.spyOn(window, 'getSelection').mockReturnValue({
    toString: () => text,
    removeAllRanges,
  } as unknown as Selection);
  return removeAllRanges;
}

describe('ExamPreview 마킹 모드 꺼짐', () => {
  it('마크를 클릭할 수 없는 하이라이트로 그리고, 눌러도 해제하지 않는다', () => {
    const { stack, onConceptClick } = renderPreview();

    expect(stack.querySelector('[data-concept-interactive]')).toBeNull();
    const highlight = stack.querySelector<HTMLElement>('.eb-concept-highlight');
    expect(highlight?.textContent).toBe(WORD);

    fireEvent.click(highlight!);

    expect(onConceptClick).not.toHaveBeenCalled();
  });

  it('본문을 드래그해도 마킹하지 않는다', () => {
    const { area, onConceptDrag } = renderPreview();
    const removeAllRanges = stubSelection(WORD);

    fireEvent.mouseUp(area);

    expect(onConceptDrag).not.toHaveBeenCalled();
    expect(removeAllRanges).not.toHaveBeenCalled();
  });
});

describe('ExamPreview 마킹 모드 켜짐', () => {
  it('마크를 누르면 그 낱말로 해제를 부른다', () => {
    const { stack, onConceptClick } = renderPreview({ markingMode: true });
    const mark = stack.querySelector<HTMLElement>('.eb-concept-preview-mark[data-concept-interactive="true"]');
    expect(mark?.textContent).toBe(WORD);

    fireEvent.click(mark!);

    expect(onConceptClick).toHaveBeenCalledWith(WORD);
  });

  it('본문을 드래그하면 고른 글자로 마킹을 부르고 선택을 지운다', () => {
    const { area, onConceptDrag } = renderPreview({ markingMode: true });
    const removeAllRanges = stubSelection(WORD);

    fireEvent.mouseUp(area);

    expect(onConceptDrag).toHaveBeenCalledWith(WORD);
    expect(removeAllRanges).toHaveBeenCalled();
  });
});

describe('ExamPreview 마킹 모드 단추', () => {
  it('개념지 탭에서 상태를 aria-pressed 로 알리고, 누르면 토글을 부른다', () => {
    const { onToggle } = renderPreview();
    const toggle = screen.getByRole('button', { name: '마킹 모드' });
    expect(toggle.getAttribute('aria-pressed')).toBe('false');

    fireEvent.click(toggle);

    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('켜져 있으면 aria-pressed 가 true 다', () => {
    renderPreview({ markingMode: true });

    expect(screen.getByRole('button', { name: '마킹 모드' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('다른 탭에는 단추가 없다(원래 마킹이 없는 탭이다)', () => {
    renderPreview({ activeTab: 'stage1', markingMode: true });

    expect(screen.queryByRole('button', { name: '마킹 모드' })).toBeNull();
  });
});

describe('ExamPreview 전체 출력 탭', () => {
  it('마킹 모드가 켜져 있어도 클릭할 수 있는 마크를 그리지 않는다(인쇄용 탭이다)', () => {
    const { stack, onConceptClick } = renderPreview({ activeTab: 'all', markingMode: true });

    expect(stack.querySelector('[data-concept-interactive]')).toBeNull();
    const highlight = stack.querySelector<HTMLElement>('.eb-concept-highlight');
    expect(highlight?.textContent).toBe(WORD);
    fireEvent.click(highlight!);
    expect(onConceptClick).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: '마킹 모드' })).toBeNull();
  });
});
