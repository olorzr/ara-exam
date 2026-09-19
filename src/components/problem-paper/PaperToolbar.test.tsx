import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import PaperToolbar from './PaperToolbar';
import { DEFAULT_PAPER_SETTINGS } from '@/lib/problem-paper/settings';
import type { PaperSettings } from '@/types/problem-bank';

/**
 * 이 테스트가 고정하는 것: 체크박스는 '숨기기' 인데 저장 키는 `showSource`(표시) 라
 * **뜻이 뒤집혀 있다**. 한쪽만 고치면 체크를 켤수록 출처가 찍히는 조용한 반대 동작이 된다.
 */
function renderToolbar(settings: Partial<PaperSettings> = {}, onSettings = vi.fn()) {
  render(
    <PaperToolbar
      title="테스트 문제지"
      settings={{ ...DEFAULT_PAPER_SETTINGS, ...settings }}
      count={3}
      saving={false}
      longestPassageChars={100}
      onTitle={() => {}}
      onSettings={onSettings}
      onShuffle={() => {}}
      onClear={() => {}}
      onSave={() => {}}
    />,
  );
  return { onSettings, checkbox: screen.getByLabelText('출처 숨기기') as HTMLInputElement };
}

describe('PaperToolbar 출처 체크박스', () => {
  it('기본값에서는 출처가 찍히므로 숨기기가 꺼져 있다', () => {
    const { checkbox } = renderToolbar();

    expect(checkbox.checked).toBe(false);
  });

  it('숨기기를 켜면 showSource 를 false 로 보낸다', () => {
    const { checkbox, onSettings } = renderToolbar();

    fireEvent.click(checkbox);

    expect(onSettings).toHaveBeenCalledWith({ showSource: false });
  });

  it('출처를 끈 문제지에서는 체크돼 있고, 풀면 다시 표시로 보낸다', () => {
    const { checkbox, onSettings } = renderToolbar({ showSource: false });
    expect(checkbox.checked).toBe(true);

    fireEvent.click(checkbox);

    expect(onSettings).toHaveBeenCalledWith({ showSource: true });
  });
});
