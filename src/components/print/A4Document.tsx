'use client';

import type { ReactNode } from 'react';
import { useA4Pagination, type OversizedHandler } from '@/hooks/useA4Pagination';
import { A4_WIDTH_PX, CONTENT_WIDTH, getColumnWidth } from '@/lib/print/constants';
import A4Sheet, { A4Footer } from './A4Sheet';

interface A4DocumentProps {
  /** 페이지에 채울 최소 단위들. 순서가 곧 문서 순서다 (재배열하지 않는다) */
  blocks: ReactNode[];
  columns?: 1 | 2;
  /** 1페이지 상단 전체 헤더 */
  firstPageHeader: ReactNode;
  /** 2페이지 이후 반복 헤더. 없으면 상단 여백만 남는다 */
  laterPageHeader?: ReactNode;
  /** 매 페이지·매 컬럼 상단에 반복되는 헤더 (단어장 컬럼 헤더) */
  columnHeader?: ReactNode;
  showPageNumber?: boolean;
  /** 마지막 낱장 뒤에도 페이지를 넘긴다 — '전체 출력'에서 시트 사이를 가를 때 */
  breakAfterLast?: boolean;
  /** 한 페이지에 안 들어가는 블록을 더 잘게 쪼갤 수 있으면 여기서 받아 처리한다 */
  onOversized?: OversizedHandler;
  /** 타이포그래피 스코프 클래스 (측정 컨테이너와 낱장 양쪽에 붙는다) */
  className?: string;
}

/**
 * 블록들을 실측해 A4 낱장 여러 장으로 나눠 그린다.
 *
 * 숨김 컨테이너에 블록을 **컬럼 폭 그대로** 렌더해 높이를 재고, 그 값으로 페이지를
 * 배정한다. 측정과 실제 렌더가 같은 폭·같은 래퍼를 쓰기 때문에 화면과 인쇄가 일치한다.
 */
export default function A4Document({
  blocks,
  columns = 1,
  firstPageHeader,
  laterPageHeader,
  columnHeader,
  showPageNumber = true,
  breakAfterLast = false,
  onOversized,
  className = '',
}: A4DocumentProps) {
  const { measureRootRef, layout } = useA4Pagination({ columns, onOversized });
  const columnWidth = getColumnWidth(columns);

  const renderBlock = (index: number) => {
    const scale = layout.oversizedScale[index];
    // 한 페이지에 통째로 못 담는 블록은 잘라내지 않고 축소해서 담는다
    const style = scale ? { transform: `scale(${scale})`, transformOrigin: 'top center' as const } : undefined;
    return (
      <div key={index} className={`a4-block ${scale ? 'a4-block--scaled' : ''}`.trim()} style={style}>
        {blocks[index]}
      </div>
    );
  };

  const pages = layout.pages.length > 0 ? layout.pages : [{ columns: [[]] as number[][] }];

  return (
    <>
      {/* 측정 전용 — 화면·인쇄 어디에도 보이지 않는다 */}
      <div
        ref={measureRootRef}
        className={`a4-measure ${className}`.trim()}
        aria-hidden="true"
        style={{ width: A4_WIDTH_PX }}
      >
        {/* a4-block(flow-root) 로 감싸야 실제 낱장(flex item)과 마진 처리가 같아진다.
            일반 블록으로 재면 헤더 끝의 mb-* 가 상쇄돼 본문 용량을 그만큼 크게 잡는다 */}
        <div data-measure="first-header" className="a4-block" style={{ width: CONTENT_WIDTH }}>
          {firstPageHeader}
        </div>
        {laterPageHeader ? (
          <div data-measure="later-header" className="a4-block" style={{ width: CONTENT_WIDTH }}>
            {laterPageHeader}
          </div>
        ) : null}
        <div data-measure="footer" className="a4-block" style={{ width: CONTENT_WIDTH }}>
          <A4Footer page={1} total={1} showPageNumber={showPageNumber} />
        </div>
        {columnHeader ? (
          <div data-measure="column-header" className="a4-block" style={{ width: columnWidth }}>
            {columnHeader}
          </div>
        ) : null}
        {blocks.map((block, index) => (
          <div key={index} data-measure="block" className="a4-block" style={{ width: columnWidth }}>
            {block}
          </div>
        ))}
      </div>

      <div className="a4-stack">
        {layout.ready ? (
          pages.map((page, pageIndex) => (
            <A4Sheet
              key={pageIndex}
              className={className}
              header={pageIndex === 0 ? firstPageHeader : laterPageHeader}
              page={pageIndex + 1}
              total={pages.length}
              showPageNumber={showPageNumber}
              isLast={pageIndex === pages.length - 1 && !breakAfterLast}
            >
              <div className="a4-cols">
                {page.columns.map((column, columnIndex) => (
                  <div
                    key={columnIndex}
                    className={`a4-col ${columnIndex > 0 && column.length > 0 ? 'a4-col--divided' : ''}`.trim()}
                    style={{ width: columnWidth }}
                  >
                    {columnHeader && column.length > 0 ? (
                      <div className="a4-col__header">{columnHeader}</div>
                    ) : null}
                    {column.map(renderBlock)}
                  </div>
                ))}
              </div>
            </A4Sheet>
          ))
        ) : (
          // 측정 전(첫 페인트 직전)·측정 실패 시 폴백.
          // 페이지를 나누지 못하더라도 내용이 사라지지는 않게 전부 흘려서 그린다.
          <A4Sheet
            className={`${className} a4-sheet--auto`.trim()}
            header={firstPageHeader}
            page={1}
            total={1}
            showPageNumber={showPageNumber}
            isLast={!breakAfterLast}
          >
            <div className="a4-cols">
              <div className="a4-col" style={{ width: columnWidth }}>
                {columnHeader ? <div className="a4-col__header">{columnHeader}</div> : null}
                {blocks.map((_, index) => renderBlock(index))}
              </div>
            </div>
          </A4Sheet>
        )}
      </div>
    </>
  );
}
