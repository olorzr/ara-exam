'use client';

import type { ReactNode } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

/** 값과 보여 줄 글이 다른 선택지 (예: 학교 id ↔ 학교 이름) */
export interface SelectOption {
  value: string;
  label: string;
}

/**
 * 문자열 목록도 선택지 모양으로 맞춰 준다.
 *
 * 값과 이름이 같은 축(학년·학기 등)이 흔해서 그대로 넘길 수 있게 둔다.
 * @param options - 선택지 목록, 또는 값이 곧 이름인 문자열 목록
 * @returns 값·이름 쌍 목록
 */
export function toSelectOptions(
  options: readonly SelectOption[] | readonly string[],
): SelectOption[] {
  return options.map((o) => (typeof o === 'string' ? { value: o, label: o } : o));
}

interface OptionSelectProps {
  /** 지금 고른 값 */
  value: string;
  options: readonly SelectOption[] | readonly string[];
  onChange: (value: string) => void;
  /** 고른 값이 없을 때 트리거에 보일 글 */
  placeholder?: string;
  disabled?: boolean;
  /** 트리거에 붙일 클래스 (높이·폭) */
  className?: string;
  /** 딸린 `<Label htmlFor>` 과 이어 붙일 때 */
  id?: string;
  /** 딸린 `<Label>` 이 없는 자리(필터 줄)에서 화면 낭독기에 읽힐 이름 */
  ariaLabel?: string;
  /** 트리거 안, 값 앞에 놓을 아이콘 */
  triggerIcon?: ReactNode;
}

/**
 * 선택지 목록 하나로 만드는 Select — **선택 칸은 되도록 이것을 쓴다.**
 *
 * ⚠️ **이 컴포넌트가 있는 이유가 `items` 다.** base-ui 의 `Select.Value` 는 `Select.Root` 에
 *    `items`(값→이름 지도)가 없으면 고른 **값을 그대로** 그린다 — `SelectItem` 의 children 은
 *    팝업 안에서만 쓰이고 트리거 라벨로는 읽히지 않는다. 그래서 아카이브 필터 줄이 한동안
 *    `__all__` 로, 단어 정렬이 `asc` 로 보였다. 여기서는 `items` 와 `SelectItem` 이
 *    **같은 배열**에서 나오므로 둘이 어긋날 수가 없다.
 *
 * ⚠️ `SelectItem` 의 `label` 도 **함께** 준다 — 그쪽은 글자를 쳐서 찾는 **타이프어헤드**용이라
 *    `items` 가 대신해 주지 않는다. 하나만 지우면 조용히 반쪽이 죽는다.
 *
 * `onValueChange` 가 `string | null` 을 주는 것(CLAUDE.md Known Issues)도 여기서 흡수한다.
 */
export function OptionSelect({
  value, options, onChange, placeholder, disabled, className, id, ariaLabel, triggerIcon,
}: OptionSelectProps) {
  const items = toSelectOptions(options);

  return (
    <Select
      value={value}
      items={items}
      disabled={disabled}
      onValueChange={(v) => { if (v) onChange(v); }}
    >
      <SelectTrigger id={id} aria-label={ariaLabel} className={className}>
        {triggerIcon}
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {items.map((o) => (
          <SelectItem key={o.value} value={o.value} label={o.label}>{o.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
