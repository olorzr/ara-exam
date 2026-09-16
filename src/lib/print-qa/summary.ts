import type { PrintBundle, PrintQaItem, PrintQaMeta } from '@/types/print-scan';
import { PRINT_QA_BUNDLE_LIMIT, PRINT_QA_HINT_MIN_ANSWERS } from './constants';
import { countAnswerMarks } from './marks';

/**
 * 문답 시험지의 **상태를 한 줄로** 말하는 순수 함수들.
 *
 * 목록 칩·편집 화면 머리글·인쇄 여부 판정이 전부 이 파일을 본다 — 화면마다 따로 세면
 * "칩에는 12문항인데 인쇄하면 8문항" 같은 거짓말이 생긴다.
 */

/**
 * 이 프린트가 **문답 프린트로 보이는가** (목록 힌트 전용).
 *
 * ⚠️ 이 판정으로 기능을 막거나 자동으로 돌리지 않는다. 프린트 모양은 제각각이라 '답:' 없이
 *    괄호로만 답을 적은 것도 있고, 시 한 편만 실린 프린트에 '답:' 이 두 번 나오기도 한다 —
 *    맞히려 들면 틀리고, 틀리면 선생님이 기능을 못 찾는다. **권하기만 한다.**
 * @param plain - 프린트 본문 평문
 * @returns 문답 프린트로 보이면 true
 */
export function looksLikeQaPrint(plain: string): boolean {
  // 표시 모양은 `marks.ts` 한곳에서 정한다 — 여기서 따로 세면 `대답:` 이 답으로 잡힌다
  return countAnswerMarks(plain) >= PRINT_QA_HINT_MIN_ANSWERS;
}

/**
 * 나눠 둔 문답이 **지금 원문과 어긋나는가**.
 *
 * '다시 읽기' 로 `ocr_html` 이 바뀌면 문답은 옛 본문에서 나온 것이 된다. 그때 **지우지 않고
 * 알리는** 까닭: 선생님이 손으로 고친 답과 만들어 둔 모범답안이 거기 들어 있다.
 * @param bundle - 묶음
 * @param hash - 지금 `ocr_html` 의 해시
 * @returns 어긋나면 true (아직 안 나눴으면 false)
 */
export function isQaStale(
  bundle: Pick<PrintBundle, 'qa_items' | 'qa_meta'>,
  hash: string,
): boolean {
  const items = bundle.qa_items ?? [];
  const saved = bundle.qa_meta?.sourceHash;
  if (items.length === 0 || !saved) return false;
  return saved !== hash;
}

/** 답이 어떻게 채워져 있는가 */
export interface QaAnswerCounts {
  total: number;
  /** 선생님이 인쇄해 둔 답 */
  printed: number;
  /** 학생이 손으로 쓴 답 */
  handwritten: number;
  /** AI 모범답안 */
  ai: number;
  /** 선생님이 직접 쓴 답 */
  teacher: number;
  /** 아직 답이 없는 문항 */
  none: number;
  /** 원문과 대조되지 않은 물음 — 화면이 '확인 필요' 로 짚는다 */
  unverified: number;
  /** 근거를 어디에서도 못 찾은 AI 답 */
  withoutEvidence: number;
}

/**
 * 문답 목록을 세어 한 묶음으로.
 * @param items - 문답 목록
 * @returns 세어 둔 값들
 */
export function qaAnswerCounts(items: readonly PrintQaItem[]): QaAnswerCounts {
  const counts: QaAnswerCounts = {
    total: items.length,
    printed: 0, handwritten: 0, ai: 0, teacher: 0, none: 0,
    unverified: 0, withoutEvidence: 0,
  };
  for (const item of items) {
    counts[item.answerSource] += 1;
    if (!item.verified) counts.unverified += 1;
    if (item.answerSource === 'ai' && item.evidenceSource === null) counts.withoutEvidence += 1;
  }
  return counts;
}

/** 목록 줄에 붙일 문답 칩 */
export interface QaChip {
  label: string;
  tone: 'ok' | 'muted' | 'error';
  /** 마우스를 올렸을 때 보일 자세한 설명 */
  title: string;
}

/**
 * 문답 상태를 목록 칩 한 줄로.
 *
 * ⚠️ '확인 필요'(읽기 경고)·단어 칩과 **따로 둔다.** 셋은 다음에 할 일이 전혀 달라서
 *    (원본 대조 / 단어 관리 / 문답 손보기) 한 칩에 뭉치면 무엇을 보라는 것인지 흐려진다.
 * @param items - 문답 목록
 * @param meta - 나누기 영수증
 * @returns 칩. 한 번도 안 나눴으면 null
 */
export function qaChip(
  items: readonly PrintQaItem[] | null | undefined,
  meta: PrintQaMeta | null | undefined,
): QaChip | null {
  const list = items ?? [];
  if (list.length === 0) {
    if (meta?.status !== 'failed') return null;
    return {
      label: '문답 실패',
      tone: 'error',
      title: meta.warnings?.join('\n') || '문답으로 나누지 못했어요.',
    };
  }

  const counts = qaAnswerCounts(list);
  const detail = [
    `문항 ${counts.total}개`,
    counts.printed ? `프린트에 적힌 답 ${counts.printed}개` : '',
    counts.handwritten ? `학생 손글씨 ${counts.handwritten}개` : '',
    counts.ai ? `AI 모범답안 ${counts.ai}개` : '',
    counts.teacher ? `직접 쓴 답 ${counts.teacher}개` : '',
    counts.none ? `아직 답이 없는 문항 ${counts.none}개` : '',
    counts.unverified ? `원문과 다른 물음 ${counts.unverified}개 — 확인이 필요해요` : '',
    counts.withoutEvidence ? `근거를 못 찾은 답 ${counts.withoutEvidence}개` : '',
  ].filter(Boolean).join('\n');

  return {
    label: `문답 ${counts.total}개`,
    tone: counts.none > 0 || counts.unverified > 0 ? 'muted' : 'ok',
    title: detail,
  };
}

/** 참고자료가 지금 어떤 상태인가 */
export interface QaReferenceState {
  /** 붙은 자료 본문의 글자 수 합 */
  referenceChars: number;
  /** 아직 본문을 불러오는 중인 자료가 있는가 */
  loading: boolean;
  /** 붙일 자료를 찾고 있는가 */
  searching: boolean;
}

/**
 * 지금 모범답안을 만들 수 없는 까닭 (순수 함수).
 *
 * ⚠️ **찾는 중에도 막는다**(`passage-quiz/draft.ts` 의 `referenceBlocker` 와 같은 판단).
 *    화면을 열자마자 누르면 자동 찾기가 막 시작된 참이라 붙은 자료가 아직 없다 — 그대로 보내면
 *    참고자료 없이 만들어지는데, 사람은 곧 화면에 뜬 자료를 보고 그것을 썼다고 여긴다.
 * @param plainChars - 프린트 본문 글자 수
 * @param state - 참고자료 상태
 * @returns 못 만드는 까닭. 만들 수 있으면 null
 */
export function qaReferenceBlocker(
  plainChars: number,
  state: QaReferenceState,
): string | null {
  if (state.searching) return '참고자료를 찾는 중이에요.';
  if (state.loading) return '참고자료를 불러오는 중이에요.';
  if (plainChars + state.referenceChars > PRINT_QA_BUNDLE_LIMIT) {
    return `프린트와 참고자료를 합쳐 너무 길어요 (${PRINT_QA_BUNDLE_LIMIT.toLocaleString()}자까지).`
      + ' 참고자료를 빼 주세요.';
  }
  return null;
}
