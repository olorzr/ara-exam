import type { PrintQaItem } from '@/types/print-scan';
import type { PrintQaGeneratedAnswer } from './parse-answers';
import type { PrintQaAnswerTarget } from './prompt-answers';
import { answerOccurrences } from './redact-scan';

/**
 * 문답 목록을 다루는 순수 함수들 — 번호·대상 고르기·답 붙이기.
 *
 * ⚠️ **번호는 이 파일 하나에서 매긴다.** 문제지·교사용·답지가 각자 세면 문항을 하나 뺐을 때
 *    세 인쇄물이 어긋나고, 그 사실은 채점할 때에야 드러난다
 *    (`passage-quiz/items.ts` 의 `numberQuizItems` 와 같은 규약).
 */

/** 번호가 매겨진 문항 */
export interface NumberedQaItem {
  item: PrintQaItem;
  /** 인쇄되는 번호. **프린트에 찍혀 있던 번호를 그대로 쓴다** */
  number: string;
}

/** 번호 앞머리의 숫자 — '3-1' 의 3, '(2)' 의 2 */
const LEADING_DIGITS = /\d+/;

/**
 * 문항에 번호를 매긴다.
 *
 * **프린트에 인쇄된 번호(`label`)를 그대로 찍는다**(사용자 결정 2026-09-16). 새로 1번부터
 * 매기지 않는 까닭: 선생님도 학생도 원본 프린트와 나란히 놓고 보는데, 번호가 다르면
 * 어느 문항 얘기인지 맞춰 볼 수가 없다. 대신 **문항을 빼면 번호가 빈다** — 감수한 값이다.
 *
 * 번호가 인쇄돼 있지 않은 문항만 앞 번호 다음 수로 채운다.
 * @param items - 문답 목록
 * @returns 번호가 매겨진 목록 (차례는 그대로)
 */
export function numberPrintQaItems(items: readonly PrintQaItem[]): NumberedQaItem[] {
  let auto = 0;
  return items.map((item) => {
    const label = item.label.trim();
    if (label === '') {
      auto += 1;
      return { item, number: String(auto) };
    }
    const digits = label.match(LEADING_DIGITS);
    if (digits) auto = Number(digits[0]);
    return { item, number: label };
  });
}

/**
 * 모범답안을 만들 **기본 대상** — 답이 없거나 학생이 손으로 쓴 것.
 *
 * 선생님이 인쇄해 둔 답(`printed`)은 건드리지 않는다. 이미 만든 AI 답(`ai`)과 선생님이 직접
 * 쓴 답(`teacher`)도 기본에서 뺀다 — 다시 만들려면 화면에서 골라 더한다
 * (사용자 결정 2026-09-16).
 * @param items - 문답 목록
 * @returns 대상 문항의 id 들
 */
export function defaultAnswerTargets(items: readonly PrintQaItem[]): string[] {
  return items
    .filter((item) => item.answerSource === 'none' || item.answerSource === 'handwritten')
    .map((item) => item.id);
}

/** 프롬프트에 실을 대상과, 번호를 되돌릴 표 */
export interface AnswerTargetPlan {
  targets: PrintQaAnswerTarget[];
  /** 일련번호 → 문항 id */
  byNo: Map<number, string>;
}

/**
 * 고른 문항을 **일련번호를 붙여** 프롬프트용 목록으로 만든다.
 *
 * ⚠️ 문항을 가리키는 값으로 인쇄된 번호(`label`)를 쓰지 않는다 — 비어 있을 수도, 겹칠 수도
 *    있다('(2)' 가 두 번 나오는 프린트가 실제로 있다). 되돌릴 표를 함께 돌려주는 까닭이다.
 * @param items - 문답 목록
 * @param ids - 고른 문항의 id 들
 * @returns 프롬프트에 실을 목록과 번호 표
 */
export function planAnswerTargets(
  items: readonly PrintQaItem[],
  ids: ReadonlySet<string>,
): AnswerTargetPlan {
  const targets: PrintQaAnswerTarget[] = [];
  const byNo = new Map<number, string>();
  for (const item of items) {
    if (!ids.has(item.id)) continue;
    const no = targets.length + 1;
    byNo.set(no, item.id);
    targets.push({
      no,
      label: item.label,
      question: item.question,
      lead: item.lead,
      studentAnswer: item.studentAnswer,
    });
  }
  return { targets, byNo };
}

/**
 * 만들어 온 답을 문항에 붙인다.
 *
 * ⚠️ **학생이 적어 둔 답(`studentAnswer`)은 그대로 둔다.** 아이가 무엇이라고 썼는지가
 *    사라지면 선생님이 무엇을 고쳐 줘야 하는지 알 수 없다.
 * @param items - 문답 목록
 * @param byNo - 일련번호 → 문항 id
 * @param answers - 검증을 거친 답들
 * @returns 답이 붙은 새 목록 (원본은 건드리지 않는다)
 */
export function applyGeneratedAnswers(
  items: readonly PrintQaItem[],
  byNo: ReadonlyMap<number, string>,
  answers: readonly PrintQaGeneratedAnswer[],
): PrintQaItem[] {
  const byId = new Map<string, PrintQaGeneratedAnswer>();
  for (const row of answers) {
    const id = byNo.get(row.no);
    if (id !== undefined) byId.set(id, row);
  }
  if (byId.size === 0) return [...items];

  return items.map((item) => {
    const found = byId.get(item.id);
    if (!found) return item;
    return {
      ...item,
      answer: found.answer,
      answerSource: 'ai',
      evidence: found.evidence,
      evidenceSource: found.source,
    };
  });
}

/**
 * 만든 답이 **물음에 그대로 남아 있는** 문항 수.
 *
 * ⚠️ 나누기 때는 답이 비어 있어 `answerInQuestion` 이 0이었는데, 모범답안이 붙고 나면
 *    그 말이 물음 안에 보인다는 사실이 **그때 처음 드러난다**(코덱스 23R). 지우지는 않되
 *    (프린트가 답이라고 밝힌 자리가 아니다) **반드시 알린다** — 안 그러면 학생 문제지에
 *    답이 그대로 찍히고 아무도 모른다.
 * @param items - 답이 붙은 문답 목록
 * @returns 물음 안에 답이 보이는 문항 수
 */
export function answersLeftInQuestions(items: readonly PrintQaItem[]): number {
  return items.filter((item) => (
    item.answer.trim() !== '' && answerOccurrences(item.question, item.answer.trim()).length > 0
  )).length;
}

/**
 * 문항 하나를 뺀다 — **그 문항이 들고 있던 앞글은 뒤 문항이 물려받는다.**
 *
 * ⚠️ 그냥 걸러 내면 **지문이 함께 사라진다**(코덱스 2R). 한 지문에 딸린 문항이 여럿이면
 *    그 지문은 **첫 문항의 `lead` 에만** 들어 있어서, 첫 문항을 빼는 순간 남은 문항들이
 *    지문 없는 물음이 된다. 원문에서는 `지운 문항의 앞글 → 지운 물음 → 뒤 문항의 앞글`
 *    차례였으므로, 둘을 이어 붙이면 지운 물음만 빠진 원래 글이 된다.
 * ⚠️ 이어 붙인 글은 **승인을 되돌린다**(`leadApproved: false`) — 글이 달라졌으니 확인도 새로
 *    받아야 한다. 안 그러면 아무도 안 본 글이 승인된 자리에 얹혀 학생 문제지로 나간다.
 * @param items - 문답 목록
 * @param id - 뺄 문항 id
 * @returns 새 목록 (원본은 건드리지 않는다)
 */
export function removeQaItem(items: readonly PrintQaItem[], id: string): PrintQaItem[] {
  const index = items.findIndex((item) => item.id === id);
  if (index < 0) return [...items];

  const removed = items[index];
  const next = items.filter((_, i) => i !== index);
  const heir = next[index];
  if (removed.lead.trim() === '' || !heir) return next;

  next[index] = {
    ...heir,
    lead: heir.lead.trim() === '' ? removed.lead : `${removed.lead}\n${heir.lead}`,
    // ⚠️ **물려받은 글은 다시 확인받아야 한다**(Stop 게이트). 승인해 둔 문항에 **승인 안 된
    //    글**을 합치면서 승인을 물려주면, 아무도 안 본 글이 학생 문제지에 인쇄된다
    leadApproved: false,
  };
  return next;
}

/**
 * 답을 사람이 직접 고쳤을 때의 출처.
 *
 * 손으로 고친 답은 **`teacher`** 다 — 그래야 다시 만들기의 기본 대상에서 빠지고(선생님이
 * 이미 정한 답이다), 교사용에 'AI 모범답안' 이라고 잘못 찍히지 않는다.
 *
 * ⚠️ 글자를 **다듬지 않는다.** 이 함수는 글을 치는 도중에 글자마다 불린다 — 여기서 앞뒤
 *    공백을 떼면 띄어쓰기를 칠 수가 없다(인쇄·판정은 쓰는 자리에서 접어 본다).
 * @param item - 고치기 전 문항
 * @param answer - 새 답
 * @returns 새 문항
 */
export function editAnswer(item: PrintQaItem, answer: string): PrintQaItem {
  if (answer === item.answer) return item;
  return {
    ...item,
    // ⚠️ **적은 그대로 담는다**(코덱스 리뷰). 여기서 `trim` 하면 칸에 글을 치는 동안
    //    띄어쓰기가 **글자마다 지워져** '관심 표현' 을 칠 수 없다(칸이 이 값을 그대로 그린다).
    //    비었는지 보는 자리에서만 접어서 본다
    answer,
    answerSource: answer.trim() === '' ? 'none' : 'teacher',
    // 근거는 그 답의 것이었다 — 답을 바꿨으면 함께 버린다(남기면 거짓 근거가 된다)
    evidence: '',
    evidenceSource: null,
  };
}
