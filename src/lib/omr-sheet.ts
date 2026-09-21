/**
 * 학원에서 쓰는 OMR 용지 **90A** 한 장이 담는 문항 수.
 *
 * ara-system 의 `객관식 90 (A)` 양식(90문항·5지선다·4자리 출결번호)과 같은 값이어야 한다 —
 * 여기서는 시험지에 '답안지 몇 장째' 를 안내하는 데만 쓰고, 실제 인식 좌표는 그쪽 layout 이 갖는다.
 */
export const OMR_SHEET_QUESTIONS = 90;

/** 이 문항 수를 담으려면 90A 용지가 몇 장 필요한가. */
export function omrSheetCount(totalQuestions: number): number {
  if (!Number.isFinite(totalQuestions) || totalQuestions <= 0) return 0;
  return Math.ceil(totalQuestions / OMR_SHEET_QUESTIONS);
}

/**
 * 통번호 문항이 **몇 장째 답안지의 몇 번 칸**인지.
 * @param questionIndex - 0-based 문항 인덱스(통번호 - 1)
 * @returns 1-based 장 번호와 칸 번호
 */
export function omrSlotOf(questionIndex: number): { sheet: number; slot: number } {
  const i = Math.max(0, Math.trunc(questionIndex));
  return {
    sheet: Math.floor(i / OMR_SHEET_QUESTIONS) + 1,
    slot: (i % OMR_SHEET_QUESTIONS) + 1,
  };
}

/**
 * 시험지에 통번호와 나란히 찍는 보조 표기(`2-1` = 2장째 1번 칸).
 *
 * ⚠️ 통번호를 장별 1~90 으로 **다시 시작하지 말 것** — 주관식 시험지·답지와
 *   성적 시스템이 모두 통번호를 쓴다. 보조 표기만 덧붙인다.
 */
export function omrSlotLabel(questionIndex: number): string {
  const { sheet, slot } = omrSlotOf(questionIndex);
  return `${sheet}-${slot}`;
}

/** 이 문항에서 새 답안지가 시작되는가(첫 문항은 제외). */
export function startsNewOmrSheet(questionIndex: number): boolean {
  return questionIndex > 0 && questionIndex % OMR_SHEET_QUESTIONS === 0;
}
