import { kstYear } from '@/lib/kst-year';
import { suggestTitle, type SourceFormValues } from './source-form';

/**
 * 기출 업로드 폼의 **상태 전이** (순수 함수).
 *
 * `source-form.ts` 에서 뗀 이유는 길이다(300줄 규칙). 값 검증·변환은 그쪽, "무엇을 자동으로
 * 따라가게 둘 것인가" 는 이쪽이다.
 *
 * 자동 채움 세 칸(제목·교과서·작품)의 계약은 하나다:
 *  **직접 고치면 자동을 끄고, 자동으로 채운 값은 조건이 바뀌면 따라간다.**
 * 다시 켜지는 방식만 칸마다 다르다(아래 각 주석).
 */

/** 첫 폼 값 — 학년도만 올해로 채우고 나머지는 비운다 */
export function emptySourceFormValues(): SourceFormValues {
  return {
    source_type: '내신기출', level: '중등', title: '', school_name: '', school_id: '',
    textbook: '', year: String(kstYear()), grade: '', semester: '', exam_type: '',
    publisher: '', works: '',
  };
}

/** 자동으로 채울 수 있는 칸들 — 한 번에 반영한다 */
export interface SourceHint {
  /** 내신 관리에서 찾은 교과서 이름. 못 찾았으면 null */
  textbook?: string | null;
  /** 이 학교에 이미 적혀 있는 작품들(쉼표로 이은 값). 없으면 '' */
  works?: string;
}

/**
 * 화면이 들고 있는 폼 상태 — 값 + '아직 자동인가'.
 *
 * 자동 여부를 값과 **한 덩어리로** 들고 있는 이유: 갱신 함수는 순수해야 하는데(React 가
 * 두 번 부를 수 있다) 따로 두면 그 안에서 다른 state 를 만지게 된다.
 */
export interface SourceFormState {
  values: SourceFormValues;
  /** 제목을 아직 손대지 않았는가 */
  titleAuto: boolean;
  /** 교과서를 아직 손으로 고르지 않았는가 — 내신 관리 힌트가 채워도 되는가 */
  textbookAuto: boolean;
  /** 작품 칸을 아직 손대지 않았는가 — 후보가 채워도 되는가 */
  worksAuto: boolean;
}

/**
 * 첫 상태를 만든다 — 세 칸 모두 자동으로 시작한다.
 * @param values - 초기 값
 * @returns 폼 상태
 */
export function initialSourceFormState(values: SourceFormValues): SourceFormState {
  return { values, titleAuto: true, textbookAuto: true, worksAuto: true };
}

/**
 * 폼 값 하나를 고친 결과 (자동 채움 규칙 포함).
 *
 * 제목은 **선생님이 직접 치기 전까지** `suggestTitle` 을 따라간다. 예전에는 '…로 채우기'
 * 버튼을 눌러야 했는데, 안 누르고 넘어가면 제목이 비어 검증에 걸렸다.
 * 직접 치면 자동을 끄고(치는 대로 둔다), 칸을 비우면 다시 켠다.
 *
 * ⚠️ 교과서는 제목과 **한 가지가 다르다**: `'미지정'` 도 **직접 고른 값**이라 자동을 끈다.
 *    비었다고 다시 켜면 방금 고른 '미지정' 을 힌트가 곧바로 되돌려 놓아, 교과서를 모르겠다고
 *    말할 방법이 아예 없어진다. 교과서 자동은 **학교·학교급을 바꿀 때** 다시 켜진다
 *    (그때는 칸도 함께 비운다) — 폼은 업로드 한 번짜리라 그 사이만 손으로 고른 값이 남는다.
 *
 * 작품 칸도 **교과서 쪽 규칙**이다: 비우는 것까지 '직접 고른 값' 이라 자동을 끈다.
 * 제목처럼 "비우면 다시 자동" 으로 두면 ① 이 시험지엔 작품이 없다고 말할 방법이 없고
 * ② 자동이 켜져도 후보 값이 그대로라 효과가 다시 돌지 않아 **아무 일도 안 일어난다** —
 * 되살아날 것처럼 보이면서 안 되살아나는 것이 가장 나쁘다(코덱스 리뷰).
 *
 * 학교급을 바꾸면 **학교·학년·교과서·작품을 비운다** — 다른 급의 학교가 남아 있으면
 * 목록에 없는 값이 선택된 채로 저장된다.
 * 학교를 바꿔도 **교과서·작품을 비운다** — 안 그러면 이전 학교의 값이 남아 새 학교의
 * 힌트가 "이미 골라 뒀다"고 보고 물러난다(그게 자동 채움이 안 되던 까닭이다).
 * @param state - 지금 상태
 * @param patch - 바꿀 값
 * @returns 새 상태
 */
export function applySourcePatch(
  state: SourceFormState,
  patch: Partial<SourceFormValues>,
): SourceFormState {
  const { values, titleAuto } = state;
  const levelChanged = patch.level !== undefined && patch.level !== values.level;
  const schoolChanged = patch.school_id !== undefined && patch.school_id !== values.school_id;
  const cleared: Partial<SourceFormValues> = levelChanged
    ? { school_id: '', school_name: '', grade: '', textbook: '', works: '' }
    : (schoolChanged ? { textbook: '', works: '' } : {});

  const nextAuto = patch.title === undefined ? titleAuto : patch.title.trim() === '';
  const merged: SourceFormValues = { ...values, ...cleared, ...patch };
  // 칸을 비우는 쪽(학교·학교급 변경)에서만 자동이 다시 켜진다.
  // 직접 고른 값은 '미지정' 이어도 자동을 끈다 — 안 그러면 힌트가 곧바로 되돌려 놓는다
  const nextTextbookAuto = cleared.textbook !== undefined
    ? true
    : (patch.textbook !== undefined ? false : state.textbookAuto);
  // 작품도 교과서와 같다 — 비우는 것도 직접 고른 값이라 자동을 끈다
  const nextWorksAuto = cleared.works !== undefined
    ? true
    : (patch.works !== undefined ? false : state.worksAuto);

  return {
    values: nextAuto ? { ...merged, title: suggestTitle(merged) } : merged,
    titleAuto: nextAuto,
    textbookAuto: nextTextbookAuto,
    worksAuto: nextWorksAuto,
  };
}

/**
 * 자동으로 찾은 값(내신 관리 교과서·이 학교의 작품)을 반영한다.
 *
 * 직접 고친 칸은 **건드리지 않는다**. 자동으로 채워 둔 값은 조건이 바뀌면 따라 바뀌고,
 * 새 조건에 해당하는 값이 없으면 비운다 — 칸과 아래 안내가 어긋나면 안 된다.
 * 바뀐 것이 없으면 **같은 객체**를 돌려준다(StrictMode 이중 호출에 헛렌더가 없다).
 * @param state - 지금 상태
 * @param hint - 찾은 값 (그 칸을 안 건드리려면 필드를 빼고 넘긴다)
 * @returns 새 상태 (바뀐 게 없으면 같은 객체)
 */
export function applySourceHint(state: SourceFormState, hint: SourceHint): SourceFormState {
  const next: Partial<SourceFormValues> = {};
  if (hint.textbook !== undefined && state.textbookAuto) {
    const value = hint.textbook ?? '';
    if (value !== state.values.textbook) next.textbook = value;
  }
  if (hint.works !== undefined && state.worksAuto) {
    const value = hint.works;
    if (value !== state.values.works) next.works = value;
  }
  if (Object.keys(next).length === 0) return state;
  return { ...state, values: { ...state.values, ...next } };
}
