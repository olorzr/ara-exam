import type { ConceptPickResult } from './parse';

/**
 * 하나도 마킹하지 못했을 때 사람에게 할 말 (순수 함수).
 *
 * 개수를 AI 가 정하므로 **빈 응답이 정상**일 때가 있다 — 이미 마킹한 것으로 충분하다고 본 경우다.
 * 그것을 '골랐는데 전부 걸러진' 경우와 같은 경고로 알리면, 멀쩡한 응답을 오류로 읽게 된다.
 * 셋을 가른다: ① AI 가 일부러 안 고름 ② 골라 놓고 본문에 못 붙임(서식으로 쪼개진 낱말)
 * ③ 골랐지만 검증에서 전부 걸러짐.
 */

/** 안내문과 토스트 종류 */
export interface ConceptPickEmptyNotice {
  level: 'info' | 'warning';
  text: string;
}

/**
 * 하나도 못 붙였을 때의 안내를 고른다.
 * @param result - 검증을 거친 추천 결과
 * @param hasExisting - 이미 마킹된 용어가 있었는가(다시 누른 경우)
 * @returns 토스트 종류와 문구
 */
export function conceptPickEmptyNotice(
  result: ConceptPickResult,
  hasExisting: boolean,
): ConceptPickEmptyNotice {
  const { notInText, duplicate, malformed } = result.dropped;
  const pickedNothing = result.picks.length === 0 && notInText + duplicate + malformed === 0;

  if (pickedNothing && hasExisting) {
    return { level: 'info', text: '더 추천할 용어가 없어요.' };
  }
  if (pickedNothing) {
    return { level: 'warning', text: '외울 만한 용어를 찾지 못했어요. 본문을 확인해 주세요.' };
  }
  // 골라 놓고 하나도 못 붙인 경우 — '못 찾았다' 고 하면 거짓말이다. 자리를 못 찾은 것뿐이라
  // 사이드바의 '자리를 못 찾은 용어' 줄이 그 이름을 보여 준다
  if (result.picks.length > 0) {
    return {
      level: 'warning',
      text: '고른 용어를 본문에 붙이지 못했어요. 서식으로 나뉜 낱말은 직접 드래그해 주세요.',
    };
  }
  // 골랐지만 검증에서 전부 걸러진 경우 — 본문을 봐야 한다
  return { level: 'warning', text: '마킹할 용어를 찾지 못했어요. 본문을 확인해 주세요.' };
}
