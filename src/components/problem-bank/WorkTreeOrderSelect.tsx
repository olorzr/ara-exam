'use client';

import { ArrowUpDown } from 'lucide-react';
import { OptionSelect, type SelectOption } from '@/components/ui/option-select';
import { isWorkTreeOrder, type WorkTreeOrder } from '@/lib/problem-bank/work-tree';
import { writeWorkTreeOrder } from '@/lib/problem-bank/work-tree-pref';

/** 정렬 선택지 — 값은 `WorkTreeOrder`, 이름은 선생님이 읽는 말 */
const ORDER_OPTIONS: SelectOption[] = [
  { value: 'author', label: '지은이순 (ㄱ~ㅎ)' },
  { value: 'title', label: '작품명순 (ㄱ~ㅎ)' },
];

interface WorkTreeOrderSelectProps {
  value: WorkTreeOrder;
  onChange: (order: WorkTreeOrder) => void;
}

/**
 * 작품 트리의 정렬 칸 (지은이순 · 작품명순).
 *
 * 문제 은행 작품 패널, 작품 전문의 작품 패널, 작품 고르기 창이 함께 쓴다 — 셋이 같은 선택을
 * 브라우저에 남기고(`writeWorkTreeOrder`) 같은 이름을 보여 줘야 한 곳에서 바꾼 정렬이
 * 다른 곳에서도 그대로다. 처음 값은 부르는 쪽이 `readWorkTreeOrder()` 로 lazy 초기화한다.
 * @param props - 지금 정렬과 바뀐 정렬을 받을 콜백
 * @returns 정렬 칸
 */
export default function WorkTreeOrderSelect({ value, onChange }: WorkTreeOrderSelectProps) {
  const handle = (next: string) => {
    // 칸은 string 을 준다 — 단정하지 않고 좁힌다
    if (!isWorkTreeOrder(next)) return;
    writeWorkTreeOrder(next);
    onChange(next);
  };

  return (
    <OptionSelect
      value={value}
      options={ORDER_OPTIONS}
      className="h-8 w-[128px] text-xs"
      ariaLabel="작품 트리 정렬"
      triggerIcon={<ArrowUpDown className="h-3 w-3 mr-1" />}
      onChange={handle}
    />
  );
}
