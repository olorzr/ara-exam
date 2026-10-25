/**
 * 책 내지 용지 — 열림인쇄 '책만들기'(상품 D413)가 내지로 받는 18종과 그 두께.
 *
 * 출처: 열림인쇄 견적 화면이 쓰는 `https://api.yeolimprinting.co.kr/api/paper-type` 의 `thickness`(mm)와
 * `/api/item/D413` 의 `innerPaper.paper` 목록(2026-10-25 확인). 견적 화면은 이 두께로 책등을 계산한다
 * (`spine.ts` 의 `spineWidthMm`). ⚠️ 인쇄소가 용지·두께를 바꾸면 여기를 고친다 — 다르면 우리가 그린 책등과
 * 견적 화면의 '세네카' 값이 어긋난다.
 */

/** 내지 용지 하나 */
export interface InnerPaper {
  /** 열림인쇄 용지 코드 */
  code: string;
  /** 견적 화면에 보이는 이름 */
  name: string;
  /** 종이 한 장 두께(mm) */
  thicknessMm: number;
}

/** 내지 용지 목록 — 견적 화면의 차례 그대로 */
export const INNER_PAPERS: readonly InnerPaper[] = [
  { code: '1011', name: '모조지(미색) 80g', thicknessMm: 0.09 },
  { code: '1013', name: '모조지(미색) 100g', thicknessMm: 0.11 },
  { code: '1021', name: '모조지(백색) 80g', thicknessMm: 0.09 },
  { code: '1023', name: '모조지(백색) 100g', thicknessMm: 0.11 },
  { code: '1024', name: '모조지(백색) 120g', thicknessMm: 0.14 },
  { code: '1025', name: '모조지(백색) 150g', thicknessMm: 0.16 },
  { code: '1033', name: '뉴플러스(백색) 100g', thicknessMm: 0.1 },
  { code: '1041', name: '스노우지 100g', thicknessMm: 0.09 },
  { code: '1042', name: '스노우지 120g', thicknessMm: 0.11 },
  { code: '1043', name: '스노우지 150g', thicknessMm: 0.14 },
  { code: '1051', name: '아트지 100g', thicknessMm: 0.08 },
  { code: '1052', name: '아트지 120g', thicknessMm: 0.09 },
  { code: '1053', name: '아트지 150g', thicknessMm: 0.13 },
  { code: '2062', name: '랑데뷰(내추럴) 105g', thicknessMm: 0.14 },
  { code: '2063', name: '랑데뷰(내추럴) 130g', thicknessMm: 0.17 },
  { code: '2072', name: '랑데뷰(울트라화이트) 105g', thicknessMm: 0.14 },
  { code: '2073', name: '랑데뷰(울트라화이트) 130g', thicknessMm: 0.17 },
  { code: '2074', name: '랑데뷰(울트라화이트) 160g', thicknessMm: 0.22 },
];

/** 기본 내지 — 원장님이 늘 주문하는 모조지(미색) 80g (사용자 결정 2026-10-25) */
export const DEFAULT_INNER_PAPER = '1011';

/**
 * 용지 코드로 용지를 찾는다.
 * @param code - 열림인쇄 용지 코드
 * @returns 용지. 모르는 코드면 기본 용지
 */
export function innerPaperOf(code: string): InnerPaper {
  return INNER_PAPERS.find((p) => p.code === code)
    ?? INNER_PAPERS.find((p) => p.code === DEFAULT_INNER_PAPER)!;
}

/**
 * 알려진 용지 코드인가.
 * @param value - 검사할 값
 * @returns `INNER_PAPERS` 에 있으면 true
 */
export function isInnerPaperCode(value: unknown): value is string {
  return typeof value === 'string' && INNER_PAPERS.some((p) => p.code === value);
}
