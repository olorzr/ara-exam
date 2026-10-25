import type { ReactNode } from 'react';
import { COVER_COPY } from '@/lib/problem-paper/cover-copy';
import { BLEED_MM, spineInkFor, TRIM_H_MM, TRIM_W_MM, type BackFill, type CoverSpreadGeometry } from '@/lib/book';
import BookSpine from './BookSpine';

interface BookCoverSpreadProps {
  geometry: CoverSpreadGeometry;
  spineColor: string;
  /** 책등 제목 */
  spineTitle: string;
  /** 앞표지 내용(`renderCoverSlots(...).coverPage`) */
  front: ReactNode;
  /** 뒷표지 내용 — 표지 창에서 고른 뒷표지(디자인 짝·그림). 없으면 `backFill` 바탕에 학원 이름만 */
  back?: ReactNode;
  backFill: BackFill;
}

/**
 * 표지 펼침면 한 장 — 왼쪽부터 **뒷표지 · 책등 · 앞표지**(열림인쇄 가이드 '뒤표지+세네카+앞표지 순').
 *
 * 크기는 mm 로 준다(작업사이즈 = 재단 사이즈 사방 +3mm). 앞·뒤표지 자리는 210 × 297mm 상자이고 그 안에 문제지
 * 표지와 같은 그리기(`renderCoverSlots`)를 넣는다 — px 로 짠 A4 표지가 mm 상자에 0.001px 안에서 맞는다
 * (`MM_TO_PX`). 앞·뒤표지 바깥의 재단 여백은 흰색이다(재단이 비켜도 색 실선이 안 남는다). 뒷표지를 고르지
 * 않았고 바탕을 책등 색으로 골랐을 때만 뒷면 전체(여백 포함)를 칠한다.
 *
 * ⚠️ 용지 크기는 이 컴포넌트가 그리는 `<style>` 이 덮는다(BookletStack 과 같은 수법 — 같은 특이성의 `@page` 는
 *    나중 것이 이긴다. 이름 붙인 페이지는 사파리가 지원하지 않는다). 한 화면에 이 컴포넌트와 내지를 함께 그리지
 *    않는다 — 인쇄 작업 하나에 용지 크기는 하나다.
 * ⚠️ 펼침면 안에는 `.a4-sheet` 를 쓰지 않는다 — `break-after: page` 가 걸려 뒤에 빈 장이 붙는다.
 */
export default function BookCoverSpread({
  geometry, spineColor, spineTitle, front, back, backFill,
}: BookCoverSpreadProps) {
  const { widthMm, heightMm, outerBleedMm, spineXMm, frontXMm, spineMm } = geometry;
  const backBackground = !back && backFill === 'spine' ? spineColor : '#ffffff';
  const backInk = backBackground === '#ffffff' ? '#4b5563' : spineInkFor(spineColor);
  const page = (left: number, content: ReactNode) => (
    <div
      className="book-cover__page pb-sheet"
      style={{ left: `${left}mm`, top: `${BLEED_MM}mm`, width: `${TRIM_W_MM}mm`, height: `${TRIM_H_MM}mm` }}
    >
      {content}
    </div>
  );

  return (
    <>
      <style data-book-cover-page>
        {`@media print { @page { size: ${widthMm}mm ${heightMm}mm; margin: 0; } }`}
      </style>
      <section
        className="book-cover"
        aria-label="표지 펼침면"
        // 바탕을 책등 색으로 깐다 — 맞닿은 구역 사이에 생기는 머리카락 틈(소수 mm 경계의 안티에일리어싱)이
        // 흰 줄이 아니라 책등 색으로 보이게. 앞·뒤표지 구역은 각자 바탕을 칠한다
        style={{ width: `${widthMm}mm`, height: `${heightMm}mm`, background: spineColor }}
      >
        <div className="book-cover__back" style={{ left: 0, width: `${spineXMm}mm`, background: backBackground }}>
          {back ? page(outerBleedMm, back) : (
            <span className="book-cover__brand" style={{ color: backInk, left: `${outerBleedMm}mm`, width: `${TRIM_W_MM}mm` }}>
              {COVER_COPY.brandKo}
            </span>
          )}
        </div>
        <BookSpine leftMm={spineXMm} widthMm={spineMm} color={spineColor} title={spineTitle} />
        <div className="book-cover__front" style={{ left: `${frontXMm}mm`, width: `${TRIM_W_MM + outerBleedMm}mm` }}>
          {page(0, front)}
        </div>
        {/* 재단선·접는 선 — 화면에서만 */}
        <div className="book-cover__guides" data-no-print aria-hidden="true">
          <div
            className="book-cover__trim"
            style={{ left: `${outerBleedMm}mm`, right: `${outerBleedMm}mm`, top: `${BLEED_MM}mm`, bottom: `${BLEED_MM}mm` }}
          />
          <div className="book-cover__fold" style={{ left: `${spineXMm}mm` }} />
          <div className="book-cover__fold" style={{ left: `${frontXMm}mm` }} />
        </div>
      </section>
    </>
  );
}
