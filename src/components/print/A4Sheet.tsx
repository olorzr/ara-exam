import type { ReactNode } from 'react';
import {
  A4_HEIGHT_PX,
  A4_WIDTH_PX,
  PAGE_PAD_BOTTOM,
  PAGE_PAD_TOP,
  PAGE_PAD_X,
} from '@/lib/print/constants';

interface A4FooterProps {
  page: number;
  total: number;
  showPageNumber?: boolean;
}

/**
 * 낱장 하단 푸터. 높이를 재는 쪽과 실제 낱장이 **같은 마크업**을 써야
 * 본문 용량 계산이 맞는다.
 */
export function A4Footer({ page, total, showPageNumber = true }: A4FooterProps) {
  return (
    <div className="a4-footer">
      <span className="a4-footer__brand">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="아라국어논술" width={18} height={18} />
        <span>아라국어논술</span>
      </span>
      {showPageNumber && (
        <span className="a4-footer__page">
          {page} / {total}
        </span>
      )}
    </div>
  );
}

interface A4SheetProps {
  /** 이 페이지의 헤더 (1페이지는 전체 헤더, 이후는 컴팩트 헤더) */
  header?: ReactNode;
  page: number;
  total: number;
  showPageNumber?: boolean;
  /** 마지막 낱장이면 뒤에 페이지를 넘기지 않는다 (빈 장 방지) */
  isLast?: boolean;
  className?: string;
  children: ReactNode;
}

/**
 * A4 낱장 한 장.
 *
 * 높이가 A4 로 **고정**돼 있고 본문이 flex:1 을 먹으므로 푸터는 언제나 페이지 바닥에 붙는다.
 * (기존 tfoot 방식은 마지막 페이지에서 내용이 끝나는 자리에 푸터가 따라붙었다.)
 */
export default function A4Sheet({
  header,
  page,
  total,
  showPageNumber = true,
  isLast = false,
  className = '',
  children,
}: A4SheetProps) {
  return (
    <section
      className={`a4-sheet ${isLast ? 'a4-sheet--last' : ''} ${className}`.trim()}
      // 크기·여백은 상수에서 직접 준다 — CSS 에 숫자를 복사해 두면 측정값과 조용히 어긋난다
      style={{
        width: A4_WIDTH_PX,
        height: A4_HEIGHT_PX,
        padding: `${PAGE_PAD_TOP}px ${PAGE_PAD_X}px ${PAGE_PAD_BOTTOM}px`,
      }}
    >
      {header ? <div className="a4-sheet__header">{header}</div> : null}
      <div className="a4-sheet__body">{children}</div>
      <A4Footer page={page} total={total} showPageNumber={showPageNumber} />
    </section>
  );
}

interface A4BlankSheetProps {
  /** 이 쪽의 번호(1부터) — 화면 낭독기와 테스트가 읽는다 */
  page: number;
  /** 문서의 마지막 낱장이면 뒤에 페이지를 넘기지 않는다 */
  isLast?: boolean;
  className?: string;
}

/**
 * 빈 쪽 — 머리글·푸터·쪽 번호 없이 종이 한 장(책 관례: 빈 뒷면엔 번호를 찍지 않는다).
 *
 * 장을 오른쪽 면에서 시작하려고 끼운 쪽(`'odd'`)과 쪽 수를 4의 배수로 맞추려고 붙인 쪽(`padPagesTo`)이다.
 * 쪽 수에는 센다 — 그 뒤 번호 찍힌 쪽은 빈 쪽을 건너뛴 번호이고 `n / N` 의 N 에도 들어간다.
 */
export function A4BlankSheet({ page, isLast = false, className = '' }: A4BlankSheetProps) {
  return (
    <section
      className={`a4-sheet a4-sheet--blank ${isLast ? 'a4-sheet--last' : ''} ${className}`.trim()}
      aria-label={`${page}쪽 (빈 쪽)`}
      data-page={page}
      style={{ width: A4_WIDTH_PX, height: A4_HEIGHT_PX }}
    />
  );
}
