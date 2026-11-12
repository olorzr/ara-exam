import { cn } from '@/lib/utils';
import IssueStamp from './IssueStamp';

interface MastheadProps {
  /** 가운데 큰 제호(학원 이름) */
  title: string;
  /** 제호 아래 자간 넓은 한글 부제 */
  subtitle: string;
  /** 맨 아래 작은 안내 한 줄 */
  note?: string;
  /** 호수 날짜(테스트용). 없으면 브라우저의 오늘 */
  date?: Date;
  className?: string;
}

/**
 * 잡지 표지 머리띠 — 대시보드 전용(연한 민트 잡지 테마, 2026-11-12).
 * 왼쪽 위 영문 두 줄 · 오른쪽 위 호수, 가는 줄 사이에 큰 제호, 자간 넓은 부제, 아래 잉크 줄.
 * 제호는 학원 로고 글꼴(지마켓 산스) 그대로다.
 * ⚠️ `<header>` 가 아니라 `<section>` 이다 — 인쇄 CSS 가 `header` 를 숨긴다.
 * @param props - 제호·부제·안내
 * @returns 머리띠
 */
export default function Masthead({ title, subtitle, note, date, className }: MastheadProps) {
  return (
    <section aria-label="표지" className={cn('border-b border-ink pt-1 pb-6 text-center', className)}>
      <div className="flex items-start justify-between gap-3">
        <p aria-hidden="true" className="text-left font-display text-[13px] leading-[1.45] text-ink">
          Exam Desk<br />Teacher&apos;s Workroom
        </p>
        <IssueStamp date={date} className="text-[10.5px]" />
      </div>
      <hr className="mx-auto mt-5 w-36 border-0 border-t border-gray-200" />
      <h1
        className="my-4 text-[44px] leading-[1.05] font-bold tracking-[-0.02em] text-ink sm:text-[60px]"
        style={{ fontFamily: "'Gmarket Sans', sans-serif" }}
      >
        {title}
      </h1>
      <hr className="mx-auto w-36 border-0 border-t border-gray-200" />
      <p className="mt-3.5 pl-[0.5em] font-display text-[15px] tracking-[0.5em] text-ink">{subtitle}</p>
      {note && <p className="mt-2 text-[13px] text-gray-500">{note}</p>}
    </section>
  );
}
