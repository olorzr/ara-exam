import { CAPACITY_SAFETY_PX } from './constants';

/** 한 페이지의 컬럼별 블록 인덱스 배치 */
export interface PagePlan {
  /** columns[c] = c 번 컬럼에 들어갈 블록 인덱스들 (원본 순서 유지) */
  columns: number[][];
}

export interface PaginateInput {
  /** 블록별 실측 높이(px). 순서 = 문서상 순서 */
  blockHeights: number[];
  columns: 1 | 2;
  /** 1페이지 본문 영역 높이 (전체 헤더가 커서 보통 더 작다) */
  firstPageBodyHeight: number;
  /** 2페이지 이후 본문 영역 높이 (컴팩트 헤더 기준) */
  laterPageBodyHeight: number;
  /** 매 페이지·매 컬럼 상단에 반복되는 헤더 높이 (단어장 컬럼 헤더 등) */
  columnHeaderHeight?: number;
  /** 블록별 '행 단위로 더 쪼갤 수 있음' 표시 (개념지의 표). 없으면 전부 불가 */
  splittable?: readonly boolean[];
}

/**
 * 남은 공간에 안 들어간 분할 가능 블록 — 호출부가 앞 조각은 `firstCapacity`,
 * 나머지 조각은 `laterCapacity` 에 맞춰 쪼개면 지금 페이지를 채우고 다음으로 이어진다.
 */
export interface SplitRequest {
  index: number;
  /** 블록이 놓이려던 자리의 남은 높이(px). 0 이하일 수 있다(앞 블록이 넘친 뒤) */
  firstCapacity: number;
  /** 뒤 조각들이 놓일 칸의 용량(px) */
  laterCapacity: number;
}

export interface PaginateResult {
  pages: PagePlan[];
  /** 한 페이지에도 통째로 안 들어가 축소 배치한 블록 인덱스 */
  oversized: number[];
  /**
   * 남은 공간에 안 들어간 분할 가능 블록들 (문서 순서).
   * 첫 요청만 정확하다 — 앞 블록을 쪼개면 뒤 블록의 남은 공간이 바뀌므로 호출부는 한 번에 하나만 처리한다.
   */
  splitRequests: SplitRequest[];
}

/**
 * 실측 높이를 받아 블록들을 페이지·컬럼에 그리디로 채운다.
 *
 * 블록 순서는 절대 재배열하지 않는다 — 문항 번호와 답안지 매핑이 어긋난다.
 * 채움 순서는 페이지 안에서 좌 → 우 컬럼, 그다음 새 페이지.
 */
export function paginate({
  blockHeights,
  columns,
  firstPageBodyHeight,
  laterPageBodyHeight,
  columnHeaderHeight = 0,
  splittable,
}: PaginateInput): PaginateResult {
  const pages: PagePlan[] = [];
  const oversized: number[] = [];
  const splitRequests: SplitRequest[] = [];
  if (blockHeights.length === 0) return { pages, oversized, splitRequests };

  const capFirst = Math.max(0, firstPageBodyHeight - columnHeaderHeight - CAPACITY_SAFETY_PX);
  const capLater = Math.max(0, laterPageBodyHeight - columnHeaderHeight - CAPACITY_SAFETY_PX);
  // 1단이면 뒤 조각은 반드시 다음 페이지 이후(컴팩트 헤더)에 놓인다.
  // 2단이면 같은 페이지의 오른쪽 칸일 수도 있어 어디에 놓여도 맞는 작은 쪽을 쓴다
  const laterCapacity = columns === 1 ? capLater : Math.min(capFirst, capLater);

  let colIdx = 0;
  let remaining = 0;

  const capOfCurrentPage = () => (pages.length <= 1 ? capFirst : capLater);
  const currentPage = () => pages[pages.length - 1];
  const pageHasContent = () => {
    const page = currentPage();
    return Boolean(page) && page.columns.some((col) => col.length > 0);
  };
  const openPage = () => {
    pages.push({ columns: Array.from({ length: columns }, () => [] as number[]) });
    colIdx = 0;
    remaining = capOfCurrentPage();
  };
  const commit = (index: number, height: number) => {
    currentPage().columns[colIdx].push(index);
    remaining -= height;
  };

  openPage();

  for (let i = 0; i < blockHeights.length; i++) {
    const height = blockHeights[i];

    if (height <= remaining) {
      commit(i, height);
      continue;
    }

    // 쪼갤 수 있는 블록이면 지금 자리를 채우도록 요청만 남기고, 배치는 아래 규칙대로 계속한다
    // (호출부가 쪼개기 전에도 레이아웃은 유효해야 한다)
    if (splittable?.[i]) splitRequests.push({ index: i, firstCapacity: remaining, laterCapacity });

    // 같은 페이지의 다음 컬럼들을 먼저 시도
    let placed = false;
    while (colIdx < columns - 1) {
      colIdx++;
      remaining = capOfCurrentPage();
      if (height <= remaining) {
        commit(i, height);
        placed = true;
        break;
      }
    }
    if (placed) continue;

    // 새 페이지 — 단, 지금 페이지가 완전히 비어 있으면 빈 장이 생기므로 열지 않는다
    if (pageHasContent()) {
      openPage();
      if (height <= remaining) {
        commit(i, height);
        continue;
      }
    }

    // 빈 페이지 한 장에도 안 들어가는 블록 → 단독 배치하고 렌더 단계에서 축소한다.
    // 페이지가 비어 있는데 컬럼만 넘어와 있으면 왼쪽 컬럼이 빈 채로 남으므로 되돌린다
    if (!pageHasContent()) colIdx = 0;
    oversized.push(i);
    commit(i, height);
    remaining = -1;
    colIdx = columns - 1; // 다음 블록은 반드시 새 페이지에서 시작
  }

  return { pages, oversized, splitRequests };
}

/** 페이지네이션 결과에서 블록이 배치된 페이지 번호(0-based)를 찾는다. 없으면 -1 */
export function findBlockPage(pages: PagePlan[], blockIndex: number): number {
  for (let p = 0; p < pages.length; p++) {
    if (pages[p].columns.some((col) => col.includes(blockIndex))) return p;
  }
  return -1;
}
