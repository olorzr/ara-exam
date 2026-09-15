import { normalizeWorkTitle } from '@/lib/problem-bank/work-title';
import { QUIZ_MATCH_TITLE_MIN } from './constants';
import type { PickedPassageMeta, QuizMatchSignals } from './types';

/**
 * 화면 입력값에서 **찾기 신호**를 뽑는다 (순수 함수).
 *
 * 신호는 두 곳에서 온다: 선생님이 친 작품명·지은이와, 아카이브에서 고른 지문이 들고 온
 * 단원·학교 정보. 둘째 것이 훨씬 강한 신호인데(교과서 단원까지 알므로) 붙여넣기로 쓸 때는
 * 아예 없다 — 그래서 있는 것만 쓴다.
 */

/** 화면 입력값 가운데 신호가 되는 것만 */
export interface SignalDraft {
  title: string;
  author: string;
}

const EMPTY_SIGNALS: QuizMatchSignals = {
  title: '', author: '', excludePassageId: null,
  unitPath: [], textbook: '', grade: '', schoolName: '', year: '',
};

/**
 * 제목·지은이를 표준 표기로.
 *
 * `normalizeWorkTitle` 을 쓰는 까닭: 선생님은 `「봄봄」` 이라고 치고 DB 에는 `봄봄` 으로
 * 저장돼 있다(작품 축의 규약). 감싼 기호를 안 벗기면 `ilike` 가 하나도 못 찾는다.
 * @param value - 친 값
 * @returns 표준 표기 (너무 짧으면 '')
 */
function matchName(value: string, min: number): string {
  const normalized = normalizeWorkTitle(value);
  return normalized.length >= min ? normalized : '';
}

/**
 * 지금 화면에서 자료를 찾을 신호를 만든다.
 * @param draft - 작품명·지은이
 * @param picked - 아카이브에서 고른 지문의 정보 (붙여넣기면 null)
 * @returns 찾기 신호
 */
export function signalsFromDraft(
  draft: SignalDraft,
  picked: PickedPassageMeta | null,
): QuizMatchSignals {
  return {
    ...EMPTY_SIGNALS,
    title: matchName(draft.title, QUIZ_MATCH_TITLE_MIN),
    // 지은이는 한 글자인 경우가 없고, 한 글자면 어차피 신호로 못 쓴다
    author: matchName(draft.author, QUIZ_MATCH_TITLE_MIN),
    ...(picked
      ? {
        excludePassageId: picked.id,
        unitPath: picked.unitPath,
        textbook: picked.textbook,
        grade: picked.grade,
        schoolName: picked.schoolName,
        year: picked.year,
      }
      : {}),
  };
}

/**
 * 찾아볼 만한 신호가 하나라도 있는가.
 *
 * 없는데 찾으러 가면 최근 자료를 아무거나 붙이게 된다 — 그럴 바에는 아무것도 안 붙이고
 * '직접 추가' 를 쓰게 하는 편이 낫다.
 * @param signals - 찾기 신호
 * @returns 찾을 수 있으면 true
 */
export function hasMatchSignals(signals: QuizMatchSignals): boolean {
  return Boolean(
    signals.title
    || signals.author
    || (signals.textbook && signals.unitPath[0])
    || signals.schoolName,
  );
}

/**
 * 신호를 비교할 수 있는 열쇠로 — 같은 신호로 두 번 찾지 않으려고 쓴다.
 * @param signals - 찾기 신호
 * @returns 안정된 문자열
 */
export function signalsKey(signals: QuizMatchSignals): string {
  return JSON.stringify([
    signals.title, signals.author, signals.excludePassageId,
    signals.unitPath, signals.textbook, signals.grade, signals.schoolName, signals.year,
  ]);
}
