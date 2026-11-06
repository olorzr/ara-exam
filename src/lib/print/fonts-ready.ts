/**
 * 웹폰트 로딩이 끝났는가 (지원하지 않는 환경이면 끝난 것으로 본다).
 *
 * 글꼴이 늦게 오면 글자 폭과 줄 수가 달라져, 폴백 글꼴로 재서 쪼갠 조각은 다시 쪼개야 한다.
 * 개념지 표(`useConceptSheetBlocks`)와 문제지 쪼개기(`usePaperSplit`)가 같은 판정을 쓴다.
 * @returns 끝났으면 true
 */
export function areFontsReady(): boolean {
  return typeof document === 'undefined' || document.fonts?.status !== 'loading';
}
