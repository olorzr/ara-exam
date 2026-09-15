import { droppedTotal, type PassageQuizResult } from './parse';

/**
 * 문항을 하나도 만들지 못했을 때 사람에게 할 말 (순수 함수).
 *
 * 두 경우를 가른다: ① AI 가 낼 것을 못 찾음 ② 만들었지만 검증에서 전부 걸러짐.
 * 뭉뚱그리면 "본문을 바꿔야 하나" 와 "다시 눌러 보면 되나" 를 구분할 수 없다.
 * (`concept-pick/notice.ts` 의 셋 가운데 '붙이지 못함' 은 여기 없다 — 붙이는 단계가 없다.)
 */

/** 안내문과 토스트 종류 */
export interface PassageQuizEmptyNotice {
  level: 'info' | 'warning';
  text: string;
}

/**
 * 하나도 못 만들었을 때의 안내를 고른다.
 * @param result - 검증을 거친 결과
 * @returns 토스트 종류와 문구
 */
export function passageQuizEmptyNotice(result: PassageQuizResult): PassageQuizEmptyNotice {
  if (droppedTotal(result.dropped) === 0) {
    return { level: 'warning', text: '문제로 낼 내용을 찾지 못했어요. 지문을 확인해 주세요.' };
  }
  return {
    level: 'warning',
    text: '만든 문항이 모두 지문·참고자료와 맞지 않아 뺐어요. 지문을 다시 확인하고 시도해 주세요.',
  };
}
