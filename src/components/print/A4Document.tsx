'use client';

import type { ReactNode } from 'react';
import {
  useA4Pagination,
  type BeforePaginateHandler,
  type SplitRequestHandler,
} from '@/hooks/useA4Pagination';
import { A4_WIDTH_PX, CONTENT_WIDTH, getColumnWidth } from '@/lib/print/constants';
import type { PagePlan } from '@/lib/print/paginate';
import A4CoverSheet from './A4CoverSheet';
import A4Sheet, { A4Footer } from './A4Sheet';
import BookletStack from './BookletStack';

interface A4DocumentBaseProps {
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
  /**
   * 표지 한 장(본문 앞). 실측 배정 밖의 고정 한 장이라 **쪽 번호를 세지 않는다**.
   * 측정이 끝나기 전 폴백에는 그리지 않는다.
   */
  coverPage?: ReactNode;
  /** 블록별 '행 단위로 더 쪼갤 수 있음' 표시 (개념지의 표). 참조가 안정적이어야 한다 */
  splittable?: readonly boolean[];
  /** 배치 직전 손질 훅 — 블록을 갱신했으면 true (개념지 표 열 폭 맞춤) */
  onBeforePaginate?: BeforePaginateHandler;
  /** 남은 자리에 안 들어간 블록을 더 잘게 쪼갤 수 있으면 여기서 받아 처리한다 */
  onSplitRequest?: SplitRequestHandler;
  /** 타이포그래피 스코프 클래스 (측정 컨테이너와 낱장 양쪽에 붙는다) */
  className?: string;
}

/**
 * 중철 제본은 '인쇄 작업 전체' 를 A3 면으로 바꾸므로, 문서를 이어 붙이는 `breakAfterLast`
 * (개념지 '전체 출력')와 함께 쓸 수 없다 — 타입으로 막는다.
 */
type A4DocumentProps = A4DocumentBaseProps & (
  | {
    booklet?: false;
    /** 마지막 낱장 뒤에도 페이지를 넘긴다 — '전체 출력'에서 시트 사이를 가를 때 */
    breakAfterLast?: boolean;
  }
  | {
    /** 중철 제본 — A3 가로 한 면에 A4 두 쪽씩, 장마다 앞·뒷면을 차례로 그린다 */
    booklet: true;
    breakAfterLast?: never;
  }
);

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
  booklet = false,
  coverPage,
  splittable,
  onBeforePaginate,
  onSplitRequest,
  className = '',
}: A4DocumentProps) {
  const { measureRootRef, layout } = useA4Pagination({
    columns,
    splittable,
    onBeforePaginate,
    onSplitRequest,
  });
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

  const pages: PagePlan[] = layout.pages.length > 0 ? layout.pages : [{ columns: [[]] }];

  /** 본문 낱장 하나 — 낱장 모드와 중철 모드가 같은 마크업을 쓴다 */
  const renderPage = (page: PagePlan, pageIndex: number) => (
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
  );

  const cover = coverPage
    ? [<A4CoverSheet key="cover" className={className}>{coverPage}</A4CoverSheet>]
    : [];

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
          booklet ? (
            <BookletStack pages={[...cover, ...pages.map(renderPage)]} />
          ) : (
            [...cover, ...pages.map(renderPage)]
          )
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
