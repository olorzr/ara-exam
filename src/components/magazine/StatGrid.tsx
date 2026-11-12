import { cn } from '@/lib/utils';

/** 숫자 칸 하나 */
export interface StatItem {
  /** 영문 작은 대문자(꾸밈) */
  en: string;
  /** 한글 이름 — 숫자의 실제 이름 */
  label: string;
  value: number;
}

interface StatGridProps {
  items: readonly StatItem[];
  className?: string;
}

/**
 * 숫자 격자 — 칸 사이를 1px 잉크 줄로 가른 흰 종이 칸에 큰 숫자(잡지 테마, 2026-11-12).
 * 숫자는 천 단위 쉼표로 적는다.
 * @param props - 칸 목록
 * @returns 숫자 격자(dl)
 */
export default function StatGrid({ items, className }: StatGridProps) {
  return (
    <dl className={cn('grid grid-cols-2 gap-px border border-ink bg-ink sm:grid-cols-4', className)}>
      {items.map((item) => (
        <div key={item.label} className="flex flex-col gap-1 bg-card px-4 pt-3.5 pb-4">
          <span aria-hidden="true" className="font-label text-[10px] font-bold tracking-[0.18em] text-ink">
            {item.en}
          </span>
          <dt className="text-[13px] text-gray-500">{item.label}</dt>
          <dd className="font-label text-[34px] leading-none font-extrabold tracking-[0.01em] text-ink tabular-nums sm:text-[40px]">
            {item.value.toLocaleString('ko-KR')}
          </dd>
        </div>
      ))}
    </dl>
  );
}
