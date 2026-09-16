import { answersDroppedTotal, type PrintQaAnswersResult } from './parse-answers';
import { splitDroppedTotal, type PrintQaSplitResult } from './parse-split';

/**
 * 결과를 사람 말로 옮기는 순수 함수들.
 *
 * '아무것도 안 나왔다' 를 뭉뚱그리지 않는다 — **낼 것이 없었다**(문답 프린트가 아니다)와
 * **만들었는데 전부 걸러졌다**(다시 눌러 볼 만하다)는 다음에 할 일이 전혀 다르다
 * (`passage-quiz/notice.ts` 와 같은 규약).
 */

/** 안내문과 토스트 종류 */
export interface PrintQaNotice {
  level: 'info' | 'success' | 'warning';
  text: string;
}

/**
 * 나누기 결과를 한 줄로.
 * @param result - 검증을 거친 결과
 * @returns 토스트 종류와 문구
 */
export function splitNotice(result: PrintQaSplitResult): PrintQaNotice {
  if (result.items.length === 0) {
    if (splitDroppedTotal(result.dropped) === 0) {
      return {
        level: 'info',
        text: '이 프린트에서 물음을 찾지 못했어요. 문답이 아니라 설명만 있는 프린트인 것 같아요.',
      };
    }
    return {
      level: 'warning',
      text: '나눈 문항이 모두 원문과 맞지 않아 뺐어요. 원본을 확인하고 다시 시도해 주세요.',
    };
  }

  const blank = result.items.filter((item) => item.answer === '').length;
  const tail = blank > 0 ? ` 답이 없는 문항 ${blank}개는 모범답안을 만들 수 있어요.` : '';
  return { level: 'success', text: `문항 ${result.items.length}개로 나눴어요.${tail}` };
}

/**
 * 나누기에서 사람이 확인해야 할 것들.
 * @param result - 검증을 거친 결과
 * @returns 경고 문구들 (없으면 빈 배열)
 */
export function splitWarnings(result: PrintQaSplitResult): string[] {
  // ⚠️ **우리 경고를 앞에 둔다**(코덱스 4R). 호출부가 상한(20)으로 자르는데 모델 경고를
  //    먼저 넣으면, 모델이 경고를 스무 개 내는 순간 '지문을 못 실었다'·'답 짝이 어긋났다' 가
  //    **통째로 사라진다** — 그 둘은 사람이 반드시 봐야 하는 것이다
  const out: string[] = [];
  const unverified = result.items.filter((item) => !item.verified).length;
  if (unverified > 0) {
    out.push(
      `물음 ${unverified}개가 원문과 글자가 달라요. 원본과 대조해 확인해 주세요`
      + ' (문항은 그대로 두었어요).',
    );
  }
  if (result.dropped.answerNotInText > 0) {
    out.push(
      `프린트에 없는 답 ${result.dropped.answerNotInText}개는 비웠어요.`
      + ' 모범답안으로 채울 수 있어요.',
    );
  }
  if (result.dropped.duplicate > 0) {
    out.push(`같은 물음 ${result.dropped.duplicate}개는 한 번만 담았어요.`);
  }
  if (result.dropped.answerOutOfRegion > 0) {
    out.push(
      `답 ${result.dropped.answerOutOfRegion}개를 그 문항 옆이 아니라 프린트 다른 곳에서 찾았어요.`
      + ' 짝이 맞는지 확인해 주세요.',
    );
  }
  if (result.dropped.droppedLeads > 0) {
    out.push(
      `문항 ${result.dropped.droppedLeads}개는 앞에 있던 글을 가져오지 못했어요.`
      + ' 지문이 필요하면 왼쪽 원본 쪽 그림에서 확인하시고 직접 넣어 주세요.',
    );
  }
  if (result.dropped.answerInQuestion > 0) {
    out.push(
      `문항 ${result.dropped.answerInQuestion}개는 **물음 안에 답이 남아 있을 수 있어요.**`
      + ' 문제에 주어진 값이거나 물음의 일부일 수도 있어 지우지 않았습니다 —'
      + ' 문제지를 한 번 보시고 답이 보이면 물음을 고쳐 주세요.',
    );
  }
  if (result.dropped.truncatedLeads > 0) {
    out.push(
      '맨 앞 지문이 너무 길어 **앞부분을 잘랐어요.** 원본과 대조해 확인해 주세요.',
    );
  }
  // 모델이 남긴 말은 **맨 뒤**다 — 위의 것들이 상한에 잘려 사라지면 안 된다
  out.push(...result.warnings);
  return out;
}

/**
 * 모범답안 결과를 한 줄로.
 * @param result - 검증을 거친 결과
 * @param asked - 물어본 문항 수
 * @returns 토스트 종류와 문구
 */
export function answersNotice(result: PrintQaAnswersResult, asked: number): PrintQaNotice {
  if (result.answers.length === 0) {
    if (answersDroppedTotal(result.dropped) === 0) {
      return {
        level: 'warning',
        text: '자료만으로는 답할 수 없다고 판단했어요. 참고자료를 붙이고 다시 시도해 보세요.',
      };
    }
    return { level: 'warning', text: '만든 답이 모두 모양이 맞지 않아 뺐어요. 다시 시도해 주세요.' };
  }

  const missed = asked - result.answers.length;
  const parts = [`모범답안 ${result.answers.length}개를 만들었어요.`];
  if (missed > 0) parts.push(`${missed}개는 자료만으로 답할 수 없어 비워 뒀어요.`);
  if (result.withoutEvidence > 0) {
    parts.push(`근거를 못 찾은 답 ${result.withoutEvidence}개는 꼭 확인해 주세요.`);
  }
  return {
    level: result.withoutEvidence > 0 || missed > 0 ? 'warning' : 'success',
    text: parts.join(' '),
  };
}

/**
 * 모범답안을 붙이고 나서 사람이 확인해야 할 것.
 *
 * ⚠️ 나누기 때는 답이 비어 있어 아무 경고도 못 냈다 — **답이 생긴 지금이 알릴 유일한 때**다
 *    (코덱스 23R). 지우지 않는 까닭은 프린트가 답이라고 밝혀 둔 자리가 아니기 때문이다.
 * @param left - 물음 안에 답이 그대로 보이는 문항 수
 * @returns 경고 문구 (없으면 빈 배열)
 */
export function answersWarnings(left: number): string[] {
  if (left <= 0) return [];
  return [
    `문항 ${left}개는 **물음 안에 그 답이 그대로 보여요.**`
    + ' 문제에 주어진 값이거나 고를 말일 수도 있어 지우지 않았습니다 —'
    + ' 문제지를 한 번 보시고 답이 보이면 물음을 고쳐 주세요.',
  ];
}
