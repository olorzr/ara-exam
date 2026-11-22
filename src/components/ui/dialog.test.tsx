import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Dialog, DialogContent, DialogTitle } from './dialog';
import { OptionSelect } from './option-select';

function renderDialog(noPrint: boolean) {
  render(
    <Dialog open>
      <DialogContent noPrint={noPrint}>
        <DialogTitle>제목</DialogTitle>
        <OptionSelect
          value="" options={[{ value: 'a', label: '가' }, { value: 'b', label: '나' }]}
          onChange={() => undefined} ariaLabel="종류" placeholder="고르기"
        />
      </DialogContent>
    </Dialog>,
  );
}

describe('DialogContent noPrint', () => {
  it('창 · 뒤판 · 창 안에서 펼친 고르기 목록이 모두 data-no-print 아래에 있다(인쇄물에서 숨는다)', async () => {
    renderDialog(true);
    fireEvent.click(screen.getByRole('combobox', { name: '종류' }));
    const option = await screen.findByRole('option', { name: '나' });
    expect(option.closest('[data-no-print]')).not.toBeNull();
    expect(screen.getByRole('dialog').closest('[data-no-print]')).not.toBeNull();
    expect(document.querySelector('[data-slot="dialog-overlay"]')?.closest('[data-no-print]')).not.toBeNull();
  });

  it('noPrint 가 없으면 표시도 없다(다른 창의 마크업은 예전 그대로)', () => {
    renderDialog(false);
    expect(document.querySelector('[data-no-print]')).toBeNull();
  });
});
