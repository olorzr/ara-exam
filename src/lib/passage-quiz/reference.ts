import { QUIZ_REFERENCE_TEXT_MAX } from './constants';

/**
 * 프롬프트·파서가 보는 **참고자료** (순수 함수).
 *
 * 참고자료는 지문 말고도 근거로 삼을 수 있는 글이다 — 개념지·학교 프린트 원문·
 * 같은 작품의 다른 기출 지문·작품 전문. 어디서 왔는지(고르기·본문 읽기)는
 * `lib/quiz-references` 가 맡고, 이 모듈은 **글자만** 다룬다.
 *
 * ⚠️ `label` 은 **유일해야 한다.** 파서가 근거의 출처로 그 이름을 그대로 돌려주고
 *    정답표에 `[개념지 · 봄봄]` 으로 찍히는데, 같은 이름이 둘이면 채점하는 사람이
 *    어느 자료를 펴야 할지 알 수 없다.
 */

/** 참고자료 한 건 — 이름과 평문 */
export interface QuizReferenceText {
  /** 화면·정답표에 찍히는 이름. 유일해야 한다 */
  label: string;
  /** 평문 본문 (HTML 이면 `htmlToPlainText` 를 거친 값) */
  plain: string;
}

/** 자른 결과 — 잘렸는지 사람에게 알려야 "왜 뒷부분을 못 봤지" 가 안 생긴다 */
export interface TruncatedPlain {
  plain: string;
  truncated: boolean;
}

/**
 * 참고자료 본문을 상한까지 자른다.
 *
 * 자르는 까닭: 개념지 한 장은 짧지만 작품 전문은 몇만 자가 될 수 있어, 자르지 않으면
 * 참고자료 하나가 프롬프트를 통째로 차지한다. 자른 사실은 **화면에 표시**한다.
 * @param plain - 평문 본문
 * @returns 자른 본문과 잘렸는지 여부
 */
export function truncateReferencePlain(plain: string): TruncatedPlain {
  if (plain.length <= QUIZ_REFERENCE_TEXT_MAX) return { plain, truncated: false };
  return { plain: plain.slice(0, QUIZ_REFERENCE_TEXT_MAX), truncated: true };
}

/**
 * 같은 이름이 겹치면 뒤에 번호를 붙여 **유일하게** 만든다.
 *
 * 개념지 제목은 '제목 없음' 이 기본값이라 실제로 겹친다. 겹친 채로 두면 파서가 돌려준
 * 출처 이름이 어느 자료인지 가리지 못한다.
 *
 * ⚠️ **붙여 만든 이름까지 쓴 이름으로 센다.** 이 함수는 자료를 하나 더할 때마다 **이미 번호가
 *    붙은 목록 위에서 다시 돈다** — 원래 이름만 세면 `봄봄` 을 셋째로 더할 때 `봄봄 (2)` 를
 *    또 만들어 앞의 것과 같아진다(코덱스 리뷰). 그러면 두 자료의 근거가 정답표에서
 *    **같은 출처로 찍힌다.**
 * @param refs - 참고자료들 (label 을 가진 무엇이든)
 * @returns 이름이 유일해진 새 배열 (원본은 건드리지 않는다)
 */
export function uniqueReferenceLabels<T extends { label: string }>(refs: readonly T[]): T[] {
  const used = new Set<string>();
  return refs.map((ref) => {
    if (!used.has(ref.label)) {
      used.add(ref.label);
      return ref;
    }
    let n = 2;
    while (used.has(`${ref.label} (${n})`)) n += 1;
    const label = `${ref.label} (${n})`;
    used.add(label);
    return { ...ref, label };
  });
}
