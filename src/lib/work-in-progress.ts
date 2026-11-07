/**
 * 지금 화면에 새로 고치면 사라질 것이 있는가 — 탭 하나 안의 표시.
 *
 * 자동 새로 고침을 **미루는** 신호다(`useBuildWatch`). 막는 것이 아니라 안내로 바꿀 뿐이고, 안내의 단추는 사람이 누른다.
 * 여러 화면 조각이 함께 켤 수 있어 참거짓이 아니라 수로 든다.
 */
let holders = 0;

/**
 * 표시를 하나 켠다.
 * @returns 끄는 함수 (여러 번 불러도 한 번만 꺼진다)
 */
export function holdWorkInProgress(): () => void {
  holders += 1;
  let held = true;
  return () => {
    if (!held) return;
    held = false;
    holders -= 1;
  };
}

/**
 * 켜진 표시가 있는가.
 * @returns 새로 고치면 사라질 것이 있으면 true
 */
export function hasWorkInProgress(): boolean {
  return holders > 0;
}
