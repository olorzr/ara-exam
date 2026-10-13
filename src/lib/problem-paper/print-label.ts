/**
 * 문제지 보기 화면의 인쇄 단추 글자 (순수 함수).
 *
 * 단추가 잠겨 있으면 **왜** 잠겼는지를 단추 글자로 말한다 — 앞에 오는 까닭일수록 먼저 풀어야 한다
 * (표지를 못 읽었으면 이미지가 다 와도 인쇄할 수 없다).
 */

/** 인쇄 단추 글자를 정하는 상태 */
export interface PaperPrintLabelInput {
  /** 표지를 처음 읽는 중 */
  coverLoading: boolean;
  /** 표지를 못 읽었거나(표지 없이 가기를 고르지 않았다) 그림 표지가 깨졌다 */
  coverNeedsCheck: boolean;
  /** 그림 표지의 그림을 받는 중 */
  coverImagePending: boolean;
  /** 문항 이미지를 받는 중(문항을 인쇄하는 모드일 때만 참) */
  imagesPending: boolean;
  /** 디자인 표지의 글꼴을 받는 중 */
  fontsPending: boolean;
  /** 중철 제본으로 그리는가 */
  booklet: boolean;
}

/**
 * 인쇄 단추에 찍을 글자.
 * @param input - 화면 상태
 * @returns 잠긴 까닭 또는 '인쇄' · '인쇄 (A3 중철)'
 */
export function paperPrintLabel(input: PaperPrintLabelInput): string {
  if (input.coverLoading) return '표지 준비 중…';
  if (input.coverNeedsCheck) return '표지 확인 필요';
  if (input.coverImagePending) return '표지 준비 중…';
  if (input.imagesPending) return '이미지 준비 중…';
  if (input.fontsPending) return '글꼴 준비 중…';
  return input.booklet ? '인쇄 (A3 중철)' : '인쇄';
}
