import { omrSheetCount } from '@/lib/omr-sheet';
import type { PaperItemSnapshot } from '@/types/problem-bank';

/**
 * 문제지 → 학원 성적 시스템(90A OMR) 정답표 조립 (순수 함수).
 *
 * 조합 화면(담은 행으로 미리 검사)과 발신 라우트(저장된 스냅샷으로 권위 검사)가 **같은 함수**를 쓴다.
 * 둘이 갈리면 화면은 통과시켰는데 등록이 거절되거나, 그 반대가 된다.
 *
 * 규칙:
 * - 번호는 **문제지 안의 자리**(`order_index + 1`)다 — 원본 시험지 번호가 아니다. 학생이 마킹하는
 *   답안지 칸이 이 번호다(인쇄의 `buildAnswerRows` 와 같은 규칙).
 * - 객관식 정답은 **보기 번호 ①~⑤**여야 한다(90A 는 다섯 칸). 복수 정답은 `'1,4'` 로 보낸다 —
 *   성적 시스템이 칠한 보기를 모두 읽어 **전부·그것만** 칠했을 때 정답으로 본다.
 * - 주관식·서술형은 정답이 비어도 된다 — 스캔 뒤 검수 화면에서 선생님이 O/X 로 채점한다.
 *
 * ⚠️ `formatAnswer`(기호 `③`)를 쓰지 말 것 — 성적 시스템은 번호 문자열로 비교한다. 원문자를 보내면
 *    전 문항이 오답이 된다. `correctChoiceIndices` 도 쓰지 않는다 — 이상한 값을 `[]` 로 뭉개서
 *    '왜 못 보내는지' 를 잃는다. 여기서는 사유별로 막는다.
 */

/** 이 함수가 읽는 스냅샷 조각 — 조합 화면의 `ArchiveRow` 도 이 모양을 만족한다 */
export type OmrKeySource = Pick<PaperItemSnapshot, 'question_type' | 'answer' | 'choices'>;

/** 성적 시스템에 보내는 문항 하나 */
export interface OmrKeyItem {
  no: number;
  answer: string;
  type: '객관식' | '주관식';
}

/** OMR 로 보낼 수 없는 까닭 */
export type OmrBlockReason = 'missing' | 'out_of_range' | 'malformed';

/** OMR 을 막는 문항 */
export interface OmrBlocker {
  no: number;
  reason: OmrBlockReason;
}

/** 조립 결과 */
export interface OmrKeyPlan {
  /** 막힌 문항이 없을 때만 온전하다(막힌 문항은 빠져 있다) */
  items: OmrKeyItem[];
  blockers: OmrBlocker[];
  /** 검수 화면에서 O/X 로 채점할 문항 번호 */
  subjectiveNos: number[];
  /** 정답이 둘 이상인 객관식 문항 번호 */
  multiNos: number[];
  objectiveCount: number;
  /** 버블로 채점하는 마지막 번호 — 답안지 장 수를 정한다(0 이면 객관식 없음) */
  lastObjectiveNo: number;
}

/** 90A 답안지의 보기 칸 수 */
const OMR_CHOICE_MAX = 5;
/**
 * 보기 번호 조각 사이의 구분자 — **반각 쉼표 하나**(앞뒤 공백 허용)뿐이다.
 * ⚠️ 교사용·답지의 정답 판독(`correctChoiceIndices`)과 **같은 규칙**이어야 한다(코덱스 2·3R). 그쪽은 반각
 *    쉼표로만 나누고 조각의 공백을 걷는다 — 여기서 공백·전각 쉼표까지 받거나(`'1 4'`·`'4，1'`) 빈 조각을
 *    버리면(`'1,'`·`'1,,3'`) 인쇄물은 정답을 표시하지 못하는데 OMR 은 채점해 둘이 어긋난다.
 */
const SEPARATOR = /\s*,\s*/;
/** 조각 하나 = 보기 번호 한 자리 */
const CHOICE_PIECE = /^[1-9]$/;
/** 규범 꼴 — 번호를 쉼표로 이은 것 */
const CHOICE_FORM = /^[1-9](,[1-9])*$/;
/** 사유를 몇 개까지 나열할지 — 넘치면 '외 N개' 로 줄인다 */
const BLOCKER_LIST_MAX = 6;

const REASON_LABEL: Record<OmrBlockReason, string> = {
  missing: '정답 미입력',
  out_of_range: '정답이 ①~⑤ 밖',
  malformed: '정답을 보기 번호로 읽을 수 없음',
};

/**
 * 보기 번호 문자열을 규범 꼴(오름차순·중복 없음·공백 없는 쉼표)로 맞춘다.
 *
 * ⚠️ ara-system `app/lib/choiceAnswer.ts` 의 `normalizeChoiceAnswer` 와 **1:1 거울**이다 — 보낸 정답표와
 *    채점하는 정답표가 같은 규칙이어야 한다. 한쪽만 바꾸지 말 것.
 * 보기 번호로 읽히지 않는 값은 앞뒤 공백만 걷고 그대로 돌려준다.
 * @param raw - 정답 문자열
 * @returns `'1,4'` 같은 규범 꼴. 문자열이 아니면 빈 문자열
 */
export function normalizeChoiceAnswer(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  const trimmed = raw.trim();
  if (trimmed === '') return '';
  const pieces = trimmed.split(SEPARATOR);
  if (!pieces.every((p) => CHOICE_PIECE.test(p))) return trimmed;
  const nums = [...new Set(pieces.map(Number))].sort((a, b) => a - b);
  return nums.join(',');
}

/**
 * 객관식 정답 하나를 검사한다.
 *
 * ⚠️ DB `exam.omr_choice_answer_ok`(sql/54)가 **1:1 거울**이다 — RPC 가 OMR 문제지를 굳히기 전에 같은
 *    규칙으로 막는다(RPC 직접 호출·조합 화면을 연 사이 정답이 바뀐 경우). 규칙을 바꾸면 양쪽을 함께 고치고,
 *    sql/54 끝의 대표 경우 검사도 맞춘다.
 * @returns 규범 꼴 정답, 또는 막는 까닭
 */
function checkObjective(item: OmrKeySource): { answer: string } | { reason: OmrBlockReason } {
  const answer = normalizeChoiceAnswer(item.answer);
  if (answer === '') return { reason: 'missing' };
  if (!CHOICE_FORM.test(answer)) return { reason: 'malformed' };
  const choiceCount = item.choices?.length ?? 0;
  // 선지를 본문 그림이 통째로 든 문항(0개)은 셀 것이 없어 90A 칸 수만 본다
  const limit = choiceCount > 0 ? Math.min(choiceCount, OMR_CHOICE_MAX) : OMR_CHOICE_MAX;
  if (answer.split(',').some((n) => Number(n) > limit)) return { reason: 'out_of_range' };
  return { answer };
}

/**
 * 문제지 문항(읽는 차례)을 성적 시스템 정답표로 조립한다.
 * @param items - 문제지 차례대로의 문항
 */
export function buildOmrAnswerKey(items: readonly OmrKeySource[]): OmrKeyPlan {
  const plan: OmrKeyPlan = {
    items: [], blockers: [], subjectiveNos: [], multiNos: [], objectiveCount: 0, lastObjectiveNo: 0,
  };
  items.forEach((item, i) => {
    const no = i + 1;
    if (item.question_type !== '객관식') {
      plan.items.push({ no, answer: (item.answer ?? '').trim(), type: '주관식' });
      plan.subjectiveNos.push(no);
      return;
    }
    const checked = checkObjective(item);
    if ('reason' in checked) {
      plan.blockers.push({ no, reason: checked.reason });
      return;
    }
    plan.items.push({ no, answer: checked.answer, type: '객관식' });
    plan.objectiveCount += 1;
    plan.lastObjectiveNo = no;
    if (checked.answer.includes(',')) plan.multiNos.push(no);
  });
  return plan;
}

/**
 * 이 문제지를 OMR 로 채점할 수 있는가 — 막힌 문항이 없고 객관식이 하나 이상.
 * @param plan - `buildOmrAnswerKey` 결과
 */
export function omrEligible(plan: OmrKeyPlan): boolean {
  return plan.blockers.length === 0 && plan.objectiveCount > 0;
}

/**
 * 학생이 쓸 90A 답안지 장 수 — **버블로 채점하는 마지막 번호**로 잰다(ara-system `lastBubbledQuestion` 과 같은 규칙).
 * 뒤쪽이 주관식인 문제지는 그만큼 덜 쓴다.
 * @param plan - `buildOmrAnswerKey` 결과
 */
export function omrSheetCountOf(plan: OmrKeyPlan): number {
  return omrSheetCount(plan.lastObjectiveNo);
}

/**
 * 막힌 까닭을 한 줄로 — '3번 정답 미입력 · 7번 정답이 ①~⑤ 밖'.
 * @param blockers - 막힌 문항
 */
export function describeOmrBlockers(blockers: readonly OmrBlocker[]): string {
  const shown = blockers.slice(0, BLOCKER_LIST_MAX).map((b) => `${b.no}번 ${REASON_LABEL[b.reason]}`);
  const rest = blockers.length - shown.length;
  return rest > 0 ? `${shown.join(' · ')} 외 ${rest}개` : shown.join(' · ');
}

/** 툴바에 띄울 안내 — 막히면 `block`, 알아 둘 것만 있으면 `info` */
export interface OmrPlanNotice {
  tone: 'block' | 'info';
  text: string;
}

/**
 * OMR 을 켠 문제지에 대한 안내 한 줄. 알릴 것이 없으면 null.
 * @param plan - `buildOmrAnswerKey` 결과
 */
export function describeOmrPlan(plan: OmrKeyPlan): OmrPlanNotice | null {
  if (plan.blockers.length > 0) {
    return { tone: 'block', text: `OMR 로 채점할 수 없어요 — ${describeOmrBlockers(plan.blockers)}. 정답을 고치거나 그 문항을 빼 주세요.` };
  }
  if (plan.objectiveCount === 0) {
    return { tone: 'block', text: '객관식 문항이 없어 OMR 로 채점할 수 없어요.' };
  }
  const notes: string[] = [];
  if (plan.subjectiveNos.length > 0) notes.push(`주관식·서술형 ${plan.subjectiveNos.length}문항은 스캔 뒤 검수 화면에서 O/X 로 채점해요`);
  if (plan.multiNos.length > 0) notes.push(`복수 정답 ${plan.multiNos.length}문항은 정답 보기를 모두 칠해야 정답이에요`);
  const sheets = omrSheetCountOf(plan);
  if (sheets > 1) notes.push(`90A 답안지 ${sheets}장`);
  return notes.length > 0 ? { tone: 'info', text: `${notes.join(' · ')}.` } : null;
}
