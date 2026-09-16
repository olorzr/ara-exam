import type { PrintQaItem } from '@/types/print-scan';
import type { HandwrittenRange } from './handwriting';
import { placeAnswer, placeQuestions } from './parse-place';
import { foldPlain, withLeads } from './place';

/**
 * 나누기 응답을 검증한다 (순수 함수).
 *
 * 스키마는 모양만 강제하므로 **원문과 맞는지**는 여기서 본다. 막아야 할 것이 둘이다:
 *  ① 지어낸 답 — 프린트에 없는 답이 '선생님이 인쇄한 답' 으로 들어가면 모범답안 대상에서
 *     빠지고 검증 없이 교사용에 찍힌다. 본문에 없으면 **답을 비운다.**
 *  ② 고쳐 쓴 물음 — 다듬은 물음은 원본과 대조되지 않는다.
 *
 * ⚠️ **물음이 본문에 없다고 버리지 않는다**(답과 다른 대접이다). 문항이 통째로 사라지면
 *    선생님은 그 문항이 있었다는 것조차 모르는데, 남겨 두면 '확인 필요' 로 짚어 줄 수 있다.
 *    띄어쓰기만 달라도 대조는 실패하므로 버리는 쪽은 잃는 것이 너무 크다.
 * ⚠️ 대조는 **`foldStrict`** 로 한다(중복 열쇠까지 포함해서). `foldLoose` 로 접으면 공백이
 *    사라져 '아버지가 방에' 와 '아버지 가방에' 가 같아진다 — 대조에서는 지어낸 말이 통과하고,
 *    중복 열쇠에서는 **다른 물음이 같은 물음으로 몰려 사라진다**(코덱스 리뷰).
 * ⚠️ **중복은 번호까지 함께 본다.** 학교 프린트에는 '빈칸에 알맞은 말을 쓰시오.' 처럼 **똑같은
 *    물음이 번호만 바꿔 여러 번** 나온다 — 글자만 열쇠로 삼으면 둘째부터 통째로 사라진다.
 */

/** 왜 뺐는지 — "왜 이것뿐이지" 를 설명할 재료다 */
export interface PrintQaSplitDropped {
  /** 모양이 안 맞는다(빈 물음·길이 초과) */
  malformed: number;
  /** 같은 물음이 두 번 왔다 */
  duplicate: number;
  /** 답이 본문에 없어 **비운** 문항 수 (문항 자체는 남는다) */
  answerNotInText: number;
  /**
   * 답을 **그 문항 옆이 아니라 딴 데서** 찾은 수.
   *
   * 답을 맨 뒤에 몰아 놓은 프린트에서는 정상이지만, 같은 물음이 여러 번 나오는 프린트에서는
   * **짝이 어긋났을 수 있다** — 기계가 가릴 수 없어 사람에게 알린다(코덱스 3R).
   */
  answerOutOfRegion: number;
  /**
   * 앞 문항의 끝을 몰라 **싣지 않은 앞글** 수.
   *
   * 그 자리에 지문이 있었을 수 있다 — 답이 샐 바에는 버리지만, 버린 사실은 알린다.
   */
  droppedLeads: number;
  /** 너무 길어 **앞부분을 잘라 낸** 앞글 수 */
  truncatedLeads: number;
  /**
   * 물음 안에 **답과 같은 말**이 남아 있는 문항 수.
   *
   * ⚠️ 프린트가 `다음 수의 절댓값을 구하시오. / 5 / 답: 5` 처럼 적혀 있으면 물음 속의 `5` 가
   *    **주어진 값**인지 **답**인지 기계는 가릴 수 없다. 지우면 풀 수 없는 문제가 되고 놔두면
   *    답이 보일 수 있어, **놔두고 알린다**(코덱스 9R).
   */
  answerInQuestion: number;
}

export interface PrintQaSplitResult {
  items: PrintQaItem[];
  /** 프린트에 인쇄돼 있던 작품 (없으면 빈 값) */
  work: { title: string; author: string };
  /** 모델이 남긴 경고 */
  warnings: string[];
  dropped: PrintQaSplitDropped;
}

export interface PrintQaSplitContext {
  /** 프린트 본문 평문 — '본문에 있는가' 판정과 앞글 자르기의 기준 */
  plain: string;
  /**
   * 평문에서의 **손글씨 자리들**(`readPlainWithHandwriting`).
   * 손글씨를 안 읽은 묶음이면 빈 배열이다.
   */
  handwritten: readonly HandwrittenRange[];
  /** id 앞머리 — 실행마다 달라야 옛 목록의 id 와 섞이지 않는다 */
  seed: string;
}

/** 문자열 필드를 다듬어 꺼낸다 */
function str(row: Record<string, unknown>, key: string): string {
  return typeof row[key] === 'string' ? (row[key] as string).trim() : '';
}

/**
 * 응답 JSON 을 검증해 문답 목록으로.
 * @param raw - 검증 전 JSON 문자열
 * @param ctx - 본문 평문·손글씨 자리·id 앞머리
 * @returns 문답과 뺀 이유. 모양이 깨졌으면 null (빈 배열은 정상이다)
 */
export function parsePrintQaSplit(
  raw: string,
  ctx: PrintQaSplitContext,
): PrintQaSplitResult | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object') return null;

  const value = parsed as Record<string, unknown>;
  if (!Array.isArray(value.items)) return null;

  const folded = foldPlain(ctx.plain);
  const dropped: PrintQaSplitDropped = {
    malformed: 0,
    duplicate: 0,
    answerNotInText: 0,
    answerOutOfRegion: 0,
    droppedLeads: 0,
    truncatedLeads: 0,
    answerInQuestion: 0,
  };
  const slots = placeQuestions(value.items, ctx.plain, folded, dropped);
  // ⚠️ 답 구역의 끝은 **원문 차례**로 잡는다(코덱스 5R). 모델이 낸 차례로 다음 문항을 찾으면,
  //    차례가 엉킨 순간 '다음 문항' 이 **앞쪽**을 가리켜 구역이 빈다 — 그러면 문서 전체를
  //    뒤져 엉뚱한 문항의 답을 제 답으로 삼는다(손글씨 판정까지 함께 틀어진다)
  const sortedStarts = slots
    .map((slot) => slot.at?.foldedStart)
    .filter((start): start is number => start !== undefined)
    .sort((a, b) => a - b);
  const placed = slots.map((slot, index) => (
    placeAnswer(slot, index, sortedStarts, folded, ctx, dropped)
  ));
  const { items, droppedLeads, truncatedLeads } = withLeads(placed, ctx.plain);
  dropped.droppedLeads = droppedLeads;
  dropped.truncatedLeads = truncatedLeads;

  return {
    items,
    work: {
      title: str(value, 'work_title'),
      author: str(value, 'work_author'),
    },
    warnings: Array.isArray(value.warnings)
      ? value.warnings.filter((w): w is string => typeof w === 'string' && w.trim() !== '')
      : [],
    dropped,
  };
}

/**
 * 뺀 것들의 총수.
 * @param dropped - 뺀 내역
 * @returns 합계
 */
export function splitDroppedTotal(dropped: PrintQaSplitDropped): number {
  return dropped.malformed + dropped.duplicate + dropped.answerNotInText;
}
