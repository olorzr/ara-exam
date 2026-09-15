import {
  PASSAGE_QUIZ_BUNDLE_LIMIT, PASSAGE_QUIZ_MAX_PER_TYPE, PASSAGE_QUIZ_TEXT_LIMIT,
} from './constants';
import type { PassageQuizCounts } from './schema';

/**
 * 출제 화면의 입력값과 그 검사 (순수 함수).
 *
 * 개수 칸은 **빈 값이 '자동'** 이다 — 숫자를 넣으면 그 수만큼, 비우면 AI 가 정한다.
 * 그래서 화면은 문자열로 들고 있고 여기서 한 번만 숫자로 바꾼다
 * (`number | null` 로 들고 있으면 '0' 을 지우는 중인 빈 칸과 '자동' 을 구분할 수 없다).
 */

export interface PassageQuizDraft {
  /** 지문 평문 */
  text: string;
  title: string;
  author: string;
  /** O,X 개수 입력값. 빈 문자열이면 자동 */
  oxCount: string;
  /** 단답형 개수 입력값. 빈 문자열이면 자동 */
  shortCount: string;
}

export const EMPTY_DRAFT: PassageQuizDraft = {
  text: '', title: '', author: '', oxCount: '', shortCount: '',
};

/**
 * 개수 입력값을 숫자로 바꾼다.
 * @param raw - 입력 칸의 값
 * @returns 개수. 비었거나 숫자가 아니면 null(자동)
 */
export function parseCountInput(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === '') return null;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) return null;
  return Math.max(0, Math.min(Math.floor(parsed), PASSAGE_QUIZ_MAX_PER_TYPE));
}

/**
 * 입력값을 유형별 개수로.
 * @param draft - 화면 입력값
 * @returns 유형별 개수
 */
export function draftCounts(draft: PassageQuizDraft): PassageQuizCounts {
  return { ox: parseCountInput(draft.oxCount), short: parseCountInput(draft.shortCount) };
}

/**
 * 지금 만들 수 없는 까닭. 버튼을 잠그고 그대로 보여 준다.
 * @param draft - 화면 입력값
 * @returns 못 만드는 까닭. 만들 수 있으면 null
 */
export function draftBlocker(draft: PassageQuizDraft): string | null {
  if (draft.text.trim() === '') return '지문을 붙여 넣어 주세요.';
  if (draft.text.length > PASSAGE_QUIZ_TEXT_LIMIT) {
    return `지문이 너무 길어요 (${PASSAGE_QUIZ_TEXT_LIMIT.toLocaleString()}자까지).`;
  }
  const counts = draftCounts(draft);
  // 둘 다 0 이면 낼 문항이 없다 — 보내 보고 빈 결과를 받느니 먼저 막는다
  if (counts.ox === 0 && counts.short === 0) return '두 유형 가운데 하나는 만들어야 해요.';
  return null;
}

/** 지금 붙어 있는 참고자료의 상태 */
export interface ReferenceState {
  /** 붙은 자료 본문의 글자 수 합 */
  referenceChars: number;
  /** 아직 본문을 불러오는 중인 자료가 있는가 */
  loading: boolean;
  /** 붙일 자료를 찾고 있는가 */
  searching?: boolean;
}

/**
 * 참고자료 때문에 지금 만들 수 없는 까닭.
 *
 * `draftBlocker` 와 따로 두는 까닭: 그쪽은 **입력값만 보는** 순수 함수이고 화면 밖에서도
 * 같은 판정을 하는데, 참고자료는 조회 상태(불러오는 중·합계)라 성질이 다르다.
 * @param draft - 화면 입력값
 * @param state - 참고자료 상태
 * @returns 못 만드는 까닭. 만들 수 있으면 null
 */
export function referenceBlocker(
  draft: PassageQuizDraft,
  state: ReferenceState,
): string | null {
  // ⚠️ **찾는 중에도 막는다**(코덱스 리뷰). 제목을 적자마자 누르면 자동 찾기가 막 시작된
  //    참이라 붙은 자료가 아직 없다 — 그대로 보내면 참고자료 없이 만들어지고, 그 뒤에 붙은
  //    자료는 이번 출제에 쓰이지 않는다(사람은 붙은 것을 보고 썼다고 여긴다)
  if (state.searching) return '참고자료를 찾는 중이에요.';
  // 본문을 아직 못 받은 자료가 있으면 그 자료 없이 만들어진다 — 기다렸다가 보내는 편이 낫다
  if (state.loading) return '참고자료를 불러오는 중이에요.';
  if (draft.text.length + state.referenceChars > PASSAGE_QUIZ_BUNDLE_LIMIT) {
    return `지문과 참고자료를 합쳐 너무 길어요 (${PASSAGE_QUIZ_BUNDLE_LIMIT.toLocaleString()}자까지).`
      + ' 참고자료를 빼 주세요.';
  }
  return null;
}
