import { foldLoose, foldStrict } from '@/lib/concept-pick/fold';
import {
  PASSAGE_QUIZ_ANSWER_MAX, PASSAGE_QUIZ_EVIDENCE_MAX, PASSAGE_QUIZ_MAX_PER_TYPE,
  PASSAGE_QUIZ_QUESTION_MAX, PASSAGE_QUIZ_STATEMENT_MAX,
} from './constants';
import type { OxItem, PassageQuizCounts, ShortItem } from './schema';

/**
 * 출제 응답을 검증한다 (순수 함수).
 *
 * 스키마는 모양만 강제하므로 **지문과 맞는지**는 여기서 본다. 막아야 할 것이 둘이다:
 *  ① 지어낸 근거 — 지문에 없는 구절을 근거라고 적으면, 선생님이 채점할 때 근거가 어디에도 없다.
 *  ② 지어낸 답 — 단답형 답이 지문에 없으면 학생이 아무리 읽어도 쓸 수 없다.
 *
 * ⚠️ 대조는 **`foldStrict`** 로 한다. `foldLoose` 로 접으면 공백이 사라져
 *    '아버지가 방에' 와 '아버지 가방에' 가 같아진다 — 지어낸 문장이 그대로 통과한다
 *    (`concept-pick/fold.ts` 에 적힌 코덱스 리뷰 2R 의 결론).
 * ⚠️ 빈 배열은 **정상**이다(낼 것이 없다고 본 것). 모양이 깨진 것과 가른다.
 */

/** 왜 버렸는지 — "왜 적게 나왔는지" 를 사람에게 설명할 재료다 */
export interface PassageQuizDropped {
  /** 근거 구절이 지문에 없었다 */
  evidenceNotInText: number;
  /** 단답형 답이 지문에 없었다 */
  answerNotInText: number;
  /** 같은 문항이 두 번 왔다 */
  duplicate: number;
  /** 모양이 안 맞는다(빈 값·길이 초과·O/X 아님) */
  malformed: number;
}

export interface PassageQuizResult {
  ox: OxItem[];
  short: ShortItem[];
  dropped: PassageQuizDropped;
}

export interface PassageQuizParseContext {
  /** 지문 평문 — '지문에 있는가' 판정의 기준 */
  plain: string;
  /** 유형별 요청 개수 (상한을 여기서도 지킨다) */
  counts: PassageQuizCounts;
}

/**
 * 모델이 적어 오는 O/X 표기들 — 뜻이 같은 것만 받아 준다.
 *
 * ⚠️ 객체가 아니라 `Map` 인 까닭: 객체로 두면 `'__proto__'`·`'constructor'` 같은 값을 받았을 때
 *    **물려받은 속성**이 잡혀 O 도 X 도 아닌 것이 통과한다(그 값은 화면에서 그릴 수도 없다).
 */
const OX_ALIASES = new Map<string, 'O' | 'X'>([
  ['O', 'O'], ['o', 'O'], ['○', 'O'], ['〇', 'O'],
  ['X', 'X'], ['x', 'X'], ['×', 'X'], ['✕', 'X'],
]);

/**
 * 요청 개수와 상한 중 작은 쪽. 음수는 0 으로 본다.
 * @param count - 요청 개수 (`null` 이면 상한까지)
 * @returns 이번에 받을 최대 개수
 */
function capOf(count: number | null): number {
  if (count === null) return PASSAGE_QUIZ_MAX_PER_TYPE;
  return Math.max(0, Math.min(Math.floor(count), PASSAGE_QUIZ_MAX_PER_TYPE));
}

/** 문자열 필드를 다듬어 꺼낸다 */
function str(row: Record<string, unknown>, key: string): string {
  return typeof row[key] === 'string' ? (row[key] as string).trim() : '';
}

/**
 * 응답 JSON 을 검증해 문항 목록으로.
 * @param raw - 검증 전 JSON 문자열
 * @param ctx - 지문 평문과 요청 개수
 * @returns 만든 문항과 버린 이유. 모양이 깨졌으면 null (빈 배열은 정상이다)
 */
export function parsePassageQuiz(
  raw: string,
  ctx: PassageQuizParseContext,
): PassageQuizResult | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object') return null;

  const value = parsed as Record<string, unknown>;
  if (!Array.isArray(value.ox) || !Array.isArray(value.short)) return null;

  const folded = foldStrict(ctx.plain);
  const dropped: PassageQuizDropped = {
    evidenceNotInText: 0, answerNotInText: 0, duplicate: 0, malformed: 0,
  };
  /** 유형을 가리지 않고 같은 문장을 두 번 내지 않는다 */
  const seen = new Set<string>();

  /**
   * 두 유형이 함께 쓰는 검증 — 문장·근거를 보고, 통과하면 다듬은 값을 돌려준다.
   * @returns 통과한 값. 버려야 하면 null (이유는 dropped 에 적는다)
   */
  const check = (
    item: unknown, textKey: string, textMax: number,
  ): { row: Record<string, unknown>; text: string; evidence: string; key: string } | null => {
    if (!item || typeof item !== 'object') {
      dropped.malformed += 1;
      return null;
    }
    const row = item as Record<string, unknown>;
    const text = str(row, textKey);
    const evidence = str(row, 'evidence');
    const foldedEvidence = foldStrict(evidence);
    // ⚠️ 접은 뒤에도 비었는지 본다. '|' 나 '#' 는 접으면 빈 글자가 되는데,
    //    빈 글자는 **무엇에든 들어 있어** 대조를 그냥 통과한다
    if (text === '' || text.length > textMax || foldedEvidence === '') {
      dropped.malformed += 1;
      return null;
    }
    // 지어낸 근거를 막는다 — 근거가 지문에 없으면 채점할 자리가 없다
    if (!folded.includes(foldedEvidence)) {
      dropped.evidenceNotInText += 1;
      return null;
    }
    const key = foldLoose(text);
    if (seen.has(key)) {
      dropped.duplicate += 1;
      return null;
    }
    // ⚠️ `seen` 에는 **모든 검사를 통과한 뒤**에 넣는다(호출부가 넣는다).
    //    여기서 넣으면 뒤에 오는 검사에 걸려 버려진 문항이 자리를 맡아 버려,
    //    같은 물음의 **멀쩡한 문항**이 중복으로 몰려 함께 사라진다
    return { row, text, evidence: evidence.slice(0, PASSAGE_QUIZ_EVIDENCE_MAX), key };
  };

  const ox: OxItem[] = [];
  const oxCap = capOf(ctx.counts.ox);
  for (const item of value.ox) {
    // 스키마 maxItems 가 막지만 파서는 스키마를 믿지 않는다 — 순수 함수 쪽에서도 상한을 지킨다
    if (ox.length >= oxCap) break;
    const checked = check(item, 'statement', PASSAGE_QUIZ_STATEMENT_MAX);
    if (!checked) continue;
    const answer = OX_ALIASES.get(str(checked.row, 'answer'));
    if (!answer) {
      dropped.malformed += 1;
      continue;
    }
    seen.add(checked.key);
    ox.push({ statement: checked.text, answer, evidence: checked.evidence });
  }

  const short: ShortItem[] = [];
  const shortCap = capOf(ctx.counts.short);
  for (const item of value.short) {
    if (short.length >= shortCap) break;
    const checked = check(item, 'question', PASSAGE_QUIZ_QUESTION_MAX);
    if (!checked) continue;
    const answer = str(checked.row, 'answer');
    const foldedAnswer = foldStrict(answer);
    // 근거와 같은 이유로 접은 뒤에도 비었는지 본다 — 빈 답은 대조를 그냥 통과한다
    if (foldedAnswer === '' || answer.length > PASSAGE_QUIZ_ANSWER_MAX) {
      dropped.malformed += 1;
      continue;
    }
    // 학생이 지문에서 찾아 쓰는 문항이다 — 지문에 없는 답은 쓸 길이 없다
    if (!folded.includes(foldedAnswer)) {
      dropped.answerNotInText += 1;
      continue;
    }
    seen.add(checked.key);
    short.push({ question: checked.text, answer, evidence: checked.evidence });
  }

  return { ox, short, dropped };
}

/**
 * 버린 문항의 총수.
 * @param dropped - 버린 내역
 * @returns 합계
 */
export function droppedTotal(dropped: PassageQuizDropped): number {
  return dropped.evidenceNotInText + dropped.answerNotInText + dropped.duplicate + dropped.malformed;
}
