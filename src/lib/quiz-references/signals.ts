import { printLabelOf } from '@/lib/problem-bank/work-candidates';
import { normalizeWorkTitle } from '@/lib/problem-bank/work-title';
import type { PrintBundle } from '@/types/print-scan';
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
  title: '', author: '', excludePassageId: null, excludeSheetId: null,
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

/** 학교 프린트에서 신호를 뽑을 때 필요한 것만 */
export interface BundleSignalInput {
  bundle: Pick<PrintBundle, 'name' | 'school_name' | 'grade' | 'year' | 'qa_meta'>;
  /** 그 묶음이 딸린 스캔 제목 — 프린트 이름의 앞머리라 벗겨야 작품명이 남는다 */
  scanTitle: string;
  /** 이 묶음으로 만든 시험지 id — **후보에서 뺀다**(자기 자신이 붙으면 안 된다) */
  sheetId: string | null;
}

/**
 * 학교 프린트 문답에 붙일 자료를 찾을 신호를 만든다.
 *
 * 작품명이 둘 중 하나에서 온다:
 *  ① **프린트 이름**('2026 광희중학교 중2 2학기 중간 홍길동전' 의 '홍길동전') — 선생님이
 *     직접 친 값이라 가장 믿을 만하다.
 *  ② 프린트에 **인쇄돼 있던** 작품명(`qa_meta.work`) — 이름에 작품이 없을 때의 단서다.
 *     ⚠️ 본문을 보고 알아낸 이름은 여기 들어오지 않는다(`prompt-split.ts` 가 막는다) —
 *     그런 이름을 쓰면 비슷한 다른 작품의 개념지가 근거 자료로 붙는다.
 *
 * 단원(`textbook`/`unitPath`)은 **없다.** 학교 프린트는 교과서 단원에 매이지 않아
 * 그 축이 아예 비어 있다 — 대신 학교·학년·학년도가 강한 신호다.
 * @param input - 묶음·스캔 제목·그 묶음의 시험지 id
 * @returns 찾기 신호
 */
export function signalsFromBundle(input: BundleSignalInput): QuizMatchSignals {
  const { bundle } = input;
  const fromName = printLabelOf(bundle.name, input.scanTitle);
  const work = bundle.qa_meta?.work;
  return {
    ...EMPTY_SIGNALS,
    title: matchName(fromName, QUIZ_MATCH_TITLE_MIN)
      || matchName(work?.title ?? '', QUIZ_MATCH_TITLE_MIN),
    author: matchName(work?.author ?? '', QUIZ_MATCH_TITLE_MIN),
    excludeSheetId: input.sheetId,
    grade: bundle.grade,
    schoolName: bundle.school_name,
    year: bundle.year,
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
    signals.title, signals.author, signals.excludePassageId, signals.excludeSheetId,
    signals.unitPath, signals.textbook, signals.grade, signals.schoolName, signals.year,
  ]);
}
