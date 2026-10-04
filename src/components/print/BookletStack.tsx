import type { ReactNode } from 'react';
import { bookletSheets, type BookletSlot } from '@/lib/print/booklet';
import { A4_HEIGHT_PX, A4_WIDTH_PX } from '@/lib/print/constants';

interface BookletStackProps {
  /** 읽는 순서의 A4 낱장들 (표지가 있으면 맨 앞) */
  pages: ReactNode[];
}

/**
 * 중철 제본 인쇄 — A3 가로 한 면에 A4 두 쪽을 나란히 앉혀 장마다 앞면·뒷면을 차례로 그린다.
 *
 * 프린터 자동 양면('짧은 면 뒤집기')으로 뽑으면 앞·뒤가 번갈아 나가고, 쌓인 그대로 반으로 접으면
 * 쪽 순서가 맞는 책자가 된다. 면 배정은 `bookletSheets` 한 곳이 정한다.
 *
 * ⚠️ 용지 크기는 이 컴포넌트가 그리는 `<style>` 이 덮는다. 전역 `@page`(print-a4.css 의 A4 세로)는
 *    선택자로 좁힐 수 없고, 이름 붙인 페이지(`page:`)는 사파리가 지원하지 않는다. 같은 특이성의
 *    `@page` 는 나중 것이 이기므로 본문 안의 `<style>` 이 이긴다 — 중철로 그릴 때만 A3 가로가 된다.
 * ⚠️ 낱장의 내용은 **이미 그린 것**을 받는다 — 측정 기계(`useA4Pagination`)와 떨어져 있어
 *    쪽 배정에 손대지 않는다.
 */
export default function BookletStack({ pages }: BookletStackProps) {
  const sheets = bookletSheets(pages.length);
  const lastFace = sheets.length * 2 - 1;

  const renderSlot = (slot: BookletSlot, side: 'left' | 'right') => (
    <div data-slot={side} data-page={slot === null ? 'blank' : slot + 1} className="booklet-slot">
      {slot === null ? (
        <div className="booklet-blank" style={{ width: A4_WIDTH_PX, height: A4_HEIGHT_PX }} />
      ) : pages[slot]}
    </div>
  );

  const slotLabel = (slot: BookletSlot) => (slot === null ? '빈 면' : `${slot + 1}쪽`);

  return (
    <>
      <style data-booklet-page>{'@media print { @page { size: A3 landscape; margin: 0; } }'}</style>
      {sheets.flatMap((sheet, k) => (
        (['front', 'back'] as const).map((face, f) => {
          const [left, right] = sheet[face];
          const faceIndex = k * 2 + f;
          const name = `${k + 1}장 ${face === 'front' ? '앞면' : '뒷면'}`;
          return (
            <div key={`${k}-${face}`} className="booklet-leaf" data-sheet={k + 1} data-face={face}>
              <p className="booklet-leaf__caption" data-no-print>
                {name} — 왼쪽 {slotLabel(left)} · 오른쪽 {slotLabel(right)}
              </p>
              <section
                className={`booklet-side${faceIndex === lastFace ? ' booklet-side--last' : ''}`}
                aria-label={name}
                style={{ width: A4_WIDTH_PX * 2, height: A4_HEIGHT_PX }}
              >
                {renderSlot(left, 'left')}
                {renderSlot(right, 'right')}
              </section>
            </div>
          );
        })
      ))}
    </>
  );
}
