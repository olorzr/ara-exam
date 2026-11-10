'use client';

import { Button } from '@/components/ui/button';
import type { BookletDuplex } from '@/lib/print/booklet';
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

/** 양면 넘김 방향 단추 — 차례가 화면 차례다(처음 값이 앞) */
const DUPLEX_OPTIONS: readonly BookletDuplex[] = ['short', 'long'];

const DUPLEX_LABELS: Record<BookletDuplex, string> = {
  short: '짧은 쪽',
  long: '긴 쪽',
};

interface PaperPrintLayoutNoticeProps {
  /** 중철을 골랐지만 지금은 낱장으로 보여 주는 까닭 — 있으면 안내 대신 이것을 띄운다 */
  blockedReason?: string;
  /** 인쇄 창에서 고를 양면 넘김 방향 */
  duplex: BookletDuplex;
  onDuplexChange: (next: BookletDuplex) => void;
}

/**
 * 중철을 골랐을 때 인쇄 창에서 무엇을 골라야 하는지 알리고, 양면 넘김 방향을 고르게 한다.
 *
 * '여백 없음' 이면 면이 종이에 꼭 맞아 접는 선이 한가운데 온다. '기본값' 이어도 면마다 빈 쪽이 붙지는
 * 않는다(면 높이 여유, constants.ts 의 `BOOKLET_SIDE_SLACK_PX`) — 조금 줄어들 뿐이다.
 * 넘김 방향은 인쇄 창이 늘 '긴 쪽' 으로 잡혀 있어 매번 바꾸기 불편하다는 요청(2026-11-10)으로 골라 두게 했다 —
 * 긴 쪽을 고르면 뒷면을 돌려 찍는다(`bookletTurnsBack`). 드라이버가 방향을 반대로 해석하는 경우가 있어
 * '거꾸로 나오면 반대쪽' 을 함께 적는다.
 */
export function PaperPrintLayoutNotice({ blockedReason, duplex, onDuplexChange }: PaperPrintLayoutNoticeProps) {
  if (blockedReason) {
    return (
      <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900" data-no-print>
        {blockedReason}
      </p>
    );
  }
  return (
    <div
      className="space-y-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-sm text-gray-700"
      data-no-print
    >
      <p>
        인쇄 창에서 <b>용지 A3 · 여백 없음 · 양면({DUPLEX_LABELS[duplex]}으로 넘기기) · 배율 기본값</b> 을 고르세요.
        나온 종이를 순서대로 겹쳐 반으로 접고 가운데를 철하면 책자가 돼요.
      </p>
      <div role="group" aria-label="양면 넘김 방향" className="flex flex-wrap items-center gap-2">
        <span>인쇄 창의 양면 방향</span>
        {DUPLEX_OPTIONS.map((option) => (
          <Button
            key={option}
            type="button"
            size="sm"
            variant={duplex === option ? 'default' : 'outline'}
            aria-pressed={duplex === option}
            onClick={() => onDuplexChange(option)}
          >
            {DUPLEX_LABELS[option]}
          </Button>
        ))}
        <span className="text-gray-500">
          고른 쪽에 맞춰 뒷면을 찍어요. 뒷면이 거꾸로 나오면 반대쪽을 누르세요.
        </span>
      </div>
    </div>
  );
}
