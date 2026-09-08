/**
 * 드래그 위치 계산 (순수 함수).
 *
 * 라이브러리를 쓰지 않는다 — 대시보드 위젯 드래그(ara-system `useCardDrag`)와 같은
 * 포인터 캡처 방식이면 충분하고, 새 패키지를 늘리지 않는다.
 * DOM 을 만지는 부분은 훅(`useListDrag`)에 있고 여기는 산수만 한다.
 */

/** 캔버스 항목 한 줄의 세로 위치 (getBoundingClientRect 값) */
export interface ItemRect {
  top: number;
  height: number;
}

/**
 * 포인터가 있는 세로 위치 → 끼워 넣을 자리.
 *
 * 각 줄의 **중간점**을 기준으로 한다: 위 절반이면 그 앞, 아래 절반이면 그 뒤.
 * 줄 사이 간격에 포인터가 있어도 가장 가까운 경계가 답이 된다.
 * @param rects - 캔버스 항목들의 세로 위치(화면 순서)
 * @param y - 포인터 clientY
 * @returns 0 ~ rects.length 사이의 삽입 위치
 */
export function dropIndexFromPointer(rects: readonly ItemRect[], y: number): number {
  for (let i = 0; i < rects.length; i += 1) {
    const rect = rects[i];
    if (y < rect.top + rect.height / 2) return i;
  }
  return rects.length;
}

/**
 * 옮기기(move)에서 삽입 위치를 실제 목표 index 로 바꾼다.
 *
 * 자기 자신을 뽑아낸 뒤 넣기 때문에, 원래 자리보다 **뒤로** 가는 경우 1을 빼야
 * 사람이 본 위치와 맞는다. 이걸 빼먹으면 항상 한 칸씩 앞에 떨어진다.
 * @param from - 끌고 있는 항목의 현재 index
 * @param dropIndex - dropIndexFromPointer 결과
 * @returns moveItem 에 넘길 목표 index
 */
export function moveTargetIndex(from: number, dropIndex: number): number {
  return dropIndex > from ? dropIndex - 1 : dropIndex;
}

/**
 * 포인터가 캔버스 안에 있는지. 밖에서 놓으면 넣기를 취소한다.
 * @param rect - 캔버스 영역
 * @param x - 포인터 clientX
 * @param y - 포인터 clientY
 * @returns 안이면 true
 */
export function isInside(
  rect: { left: number; top: number; right: number; bottom: number },
  x: number,
  y: number,
): boolean {
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
}

/** 자동 스크롤을 시작할 가장자리 두께(px) */
export const AUTOSCROLL_EDGE_PX = 40;

/** 한 프레임에 굴릴 최대 픽셀 */
const AUTOSCROLL_MAX_STEP = 18;

/**
 * 가장자리에 가까울수록 빠르게 굴린다.
 * @param rect - 스크롤 컨테이너 영역
 * @param y - 포인터 clientY
 * @returns 한 프레임에 더할 scrollTop 변화량 (0 이면 안 굴린다)
 */
export function autoScrollStep(rect: { top: number; bottom: number }, y: number): number {
  const fromTop = y - rect.top;
  const fromBottom = rect.bottom - y;

  if (fromTop < AUTOSCROLL_EDGE_PX) {
    const ratio = Math.min(1, Math.max(0, (AUTOSCROLL_EDGE_PX - fromTop) / AUTOSCROLL_EDGE_PX));
    return -Math.ceil(ratio * AUTOSCROLL_MAX_STEP);
  }
  if (fromBottom < AUTOSCROLL_EDGE_PX) {
    const ratio = Math.min(1, Math.max(0, (AUTOSCROLL_EDGE_PX - fromBottom) / AUTOSCROLL_EDGE_PX));
    return Math.ceil(ratio * AUTOSCROLL_MAX_STEP);
  }
  return 0;
}
