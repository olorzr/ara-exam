/**
 * 선지 배열 다듬기 (순수 함수).
 *
 * ⚠️ **빈 칸을 걸러내며 압축하면 안 된다.** 정답은 위치 번호(`'3'`)로 저장되는데,
 *    가운데 선지를 비우고 압축하면 뒤 선지들이 한 칸씩 앞으로 당겨지면서
 *    정답 번호가 **다른 선지를 가리키게 된다**(코덱스 리뷰 3R).
 *    뒤쪽 빈 칸만 잘라 내고 가운데는 자리를 지킨다.
 */

/**
 * 저장할 선지 배열을 만든다.
 * @param choices - 화면에서 입력한 다섯 칸
 * @returns 뒤쪽 빈 칸을 잘라 낸 배열 (가운데 빈 칸은 자리를 지킨다)
 */
export function trimTrailingChoices(choices: readonly string[]): string[] {
  const values = choices.map((c) => c.trim());
  let last = values.length - 1;
  while (last >= 0 && values[last] === '') last -= 1;
  return values.slice(0, last + 1);
}

/**
 * 가운데가 빈 선지가 있는가 — 저장 전에 사람에게 알린다.
 * @param choices - 다듬은 선지 배열
 * @returns 비어 있는 자리의 번호들 (1-based). 없으면 빈 배열
 */
export function blankChoicePositions(choices: readonly string[]): number[] {
  const out: number[] = [];
  choices.forEach((choice, i) => {
    if (choice.trim() === '') out.push(i + 1);
  });
  return out;
}
