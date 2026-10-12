/**
 * A4 조판 상수.
 *
 * 화면과 인쇄가 **같은 px 값**을 쓰도록 A4 를 96dpi 픽셀로 못 박는다(210mm = 793.7px).
 * 인쇄에서 폭을 다시 잡지 않으므로 미리보기에서 본 배치가 그대로 출력된다.
 * (기존 방식은 화면 210mm / 인쇄 180mm 로 폭이 달라 줄바꿈·페이지 수가 어긋났다.)
 */

/** A4 210mm 를 96dpi 픽셀로 */
export const A4_WIDTH_PX = 793.7;

/** A4 297mm 를 96dpi 픽셀로 (= 1122.53px). 낱장 높이의 정본 */
export const A4_HEIGHT_PX = (A4_WIDTH_PX * 297) / 210;

/** 좌우 여백 ≈ 15mm */
export const PAGE_PAD_X = 57;

/** 상단 여백 ≈ 15mm */
export const PAGE_PAD_TOP = 57;

/** 하단 여백 ≈ 11mm (푸터 아래) */
export const PAGE_PAD_BOTTOM = 42;

/**
 * 중철 면(A3 가로 한 면)을 쪽보다 **이만큼 낮게** 그린다 — 아래 여백(`PAGE_PAD_BOTTOM`) 안에서만 깎는다.
 *
 * ⚠️ 면을 쪽 높이와 똑같이 두지 말 것(2026-10-13 실제 출력 사고). 크롬 인쇄 창의 '여백: 기본값' 은
 *    CSS `@page { margin: 0 }` 이어도 **프린터의 인쇄 불가 영역(보통 4~6mm)** 만큼 여백을 잡는다.
 *    크롬은 넘치는 폭에 맞춰 문서를 줄이는데, 가로 면은 폭을 맞춰도 높이가 남아 면마다 빈 쪽이 하나씩
 *    붙는다(4면 → 8쪽). 양면으로 뽑으면 앞면에 면, 뒷면은 그 빈 쪽 — '한 장에 한 면, 뒷면 백지' 가 된다.
 *    낱장 A4 는 세로라 폭에 맞춰 줄이면 높이도 들어가서 이 일이 없다.
 *    40px 이면 여백 16mm 까지 버틴다(필요한 여유 ≥ 2m(W−H)/(W−2m)). 깎이는 자리는 푸터 아래 빈 여백뿐이다
 *    (표지는 아래 여백이 없어 print-booklet.css 가 면 높이에 맞춰 줄인다).
 */
export const BOOKLET_SIDE_SLACK_PX = 40;

/** 중철 면의 높이 — A4 쪽 높이에서 여유(`BOOKLET_SIDE_SLACK_PX`)를 뺀 값 */
export const BOOKLET_SIDE_HEIGHT_PX = A4_HEIGHT_PX - BOOKLET_SIDE_SLACK_PX;

/** 본문 폭 ≈ 180mm — 측정과 렌더가 반드시 같은 값을 써야 한다 */
export const CONTENT_WIDTH = A4_WIDTH_PX - PAGE_PAD_X * 2;

/** 2단 레이아웃 컬럼 간격 */
export const COLUMN_GAP = 24;

/**
 * 서브픽셀 반올림 안전 마진.
 * 용량을 이만큼 깎아 1~2px 초과로 유령 페이지가 생기는 것을 막는다.
 */
export const CAPACITY_SAFETY_PX = 3;

/**
 * 한 페이지에 못 담는 블록의 축소 배율에는 **하한을 두지 않는다**.
 * 본문이 overflow:hidden 이라 하한에 걸려 덜 줄어들면 넘친 만큼이 인쇄에서 잘려 사라진다.
 * 작게 인쇄되는 것보다 내용이 사라지는 쪽이 훨씬 나쁘다.
 */

/** 측정·렌더 공통 컬럼 폭. 두 곳이 어긋나면 줄바꿈이 달라져 페이지 계산이 틀어진다 */
export function getColumnWidth(columns: 1 | 2): number {
  if (columns === 1) return CONTENT_WIDTH;
  return (CONTENT_WIDTH - COLUMN_GAP) / 2;
}
