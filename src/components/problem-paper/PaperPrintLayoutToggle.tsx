'use client';

import { Button } from '@/components/ui/button';
import type { PaperPrintLayout } from '@/lib/problem-paper/print-layout-pref';

interface PaperPrintLayoutToggleProps {
  value: PaperPrintLayout;
  onChange: (next: PaperPrintLayout) => void;
}

const OPTIONS: { value: PaperPrintLayout; label: string; hint: string }[] = [
  { value: 'single', label: '낱장', hint: 'A4 한 장에 한 쪽씩 인쇄해요' },
  { value: 'booklet', label: '중철 제본', hint: 'A3 가로 한 면에 두 쪽씩, 접어서 철하는 책자로 인쇄해요' },
];

/**
 * 인쇄 방식 고르기 — 낱장(A4) / 중철 제본(A3 가로 양면).
 * 고른 값은 호출부가 기억한다(`print-layout-pref.ts`).
 */
export default function PaperPrintLayoutToggle({ value, onChange }: PaperPrintLayoutToggleProps) {
  return (
    <div role="group" aria-label="인쇄 방식" className="inline-flex gap-1">
      {OPTIONS.map((option) => (
        <Button
          key={option.value}
          type="button"
          size="sm"
          variant={value === option.value ? 'default' : 'outline'}
          aria-pressed={value === option.value}
          title={option.hint}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </Button>
      ))}
    </div>
  );
}

interface PaperPrintLayoutNoticeProps {
  /** 중철을 골랐지만 지금은 낱장으로 보여 주는 까닭 — 있으면 안내 대신 이것을 띄운다 */
  blockedReason?: string;
}

/**
 * 중철을 골랐을 때 인쇄 창에서 무엇을 골라야 하는지 알린다.
 *
 * '짧은 면 뒤집기' 가 A3 가로 책자의 정답이다(`lib/print/booklet.ts` 머리 주석). 다만 드라이버가
 * 방향을 문서 기준으로 해석해 반대가 맞는 경우가 있어 '거꾸로 나오면' 을 함께 적는다.
 */
export function PaperPrintLayoutNotice({ blockedReason }: PaperPrintLayoutNoticeProps) {
  if (blockedReason) {
    return (
      <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900" data-no-print>
        {blockedReason}
      </p>
    );
  }
  return (
    <p className="rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-sm text-gray-700" data-no-print>
      인쇄 창에서 <b>용지 A3 · 가로 · 양면(짧은 면 뒤집기) · 배율 100%</b> 를 고르세요.
      나온 종이를 순서대로 겹쳐 반으로 접고 가운데를 철하면 책자가 돼요.
      뒷면이 거꾸로 나오면 &lsquo;긴 면 뒤집기&rsquo; 로 바꿔 보세요.
    </p>
  );
}
