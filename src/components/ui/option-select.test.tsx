import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { OptionSelect, toSelectOptions } from './option-select';

/** 트리거(닫힌 상태의 칸)에 보이는 글 */
function triggerText(): string {
  return screen.getByRole('combobox').textContent ?? '';
}

describe('toSelectOptions', () => {
  it('문자열 목록은 값과 이름을 같게 맞춘다', () => {
    expect(toSelectOptions(['1학기', '2학기'])).toEqual([
      { value: '1학기', label: '1학기' },
      { value: '2학기', label: '2학기' },
    ]);
  });

  it('값·이름 쌍은 그대로 둔다', () => {
    const options = [{ value: '__all__', label: '유형 전체' }];
    expect(toSelectOptions(options)).toEqual(options);
  });
});

describe('OptionSelect', () => {
  /**
   * 이 테스트가 고정하는 것: base-ui 는 `Select.Root` 에 `items` 가 없으면 고른 **값**을
   * 그대로 그린다. 예전 아카이브 필터 줄이 전부 `__all__` 로 보이던 바로 그 증상이라,
   * 여기서 값이 새어 나오면 실패해야 한다.
   */
  it('값과 이름이 다르면 트리거에 이름이 보인다 (값이 아니라)', () => {
    render(
      <OptionSelect
        value="__all__"
        options={[{ value: '__all__', label: '유형 전체' }, { value: '내신기출', label: '내신기출' }]}
        onChange={() => {}}
      />,
    );

    expect(triggerText()).toContain('유형 전체');
    expect(triggerText()).not.toContain('__all__');
  });

  it("'미지정' 센티널도 이름으로 보인다", () => {
    render(
      <OptionSelect
        value="__none__"
        options={[{ value: '__none__', label: '미지정' }]}
        onChange={() => {}}
      />,
    );

    expect(triggerText()).toContain('미지정');
    expect(triggerText()).not.toContain('__none__');
  });

  it('경로 축처럼 값이 이름의 축약형일 때도 이름을 보여 준다', () => {
    render(
      <OptionSelect
        value="문학>현대시"
        options={[{ value: '문학>현대시', label: '문학 > 현대시' }]}
        onChange={() => {}}
      />,
    );

    expect(triggerText()).toContain('문학 > 현대시');
  });

  it('문자열 목록을 그대로 받는다', () => {
    render(<OptionSelect value="1학기" options={['1학기', '2학기']} onChange={() => {}} />);

    expect(triggerText()).toContain('1학기');
  });

  it('고른 값이 선택지에 없으면 값이 그대로 보인다 (base-ui 폴백 고정)', () => {
    render(<OptionSelect value="옛개념" options={['명사']} onChange={() => {}} />);

    expect(triggerText()).toContain('옛개념');
  });

  it('딸린 라벨이 없는 자리에서는 aria-label 로 이름을 준다', () => {
    render(
      <OptionSelect value="__all__" options={[{ value: '__all__', label: '유형 전체' }]} ariaLabel="유형" onChange={() => {}} />,
    );

    expect(screen.getByRole('combobox', { name: '유형' })).toBeDefined();
  });
});
