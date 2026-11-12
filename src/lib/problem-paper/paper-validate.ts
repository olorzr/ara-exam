import { isContiguous, type PaperItem } from './compose';
import { describeOmrBlockers, type OmrKeyPlan } from './omr-payload';

/**
 * 문제지 저장 전 검사 — 만들기와 고치기가 같이 쓴다.
 *
 * 서버(RPC)도 같은 검사를 하지만 여기서 걸러야 사람이 어디를 고쳐야 할지 안다. 만들고 나면(고치고 나면) 성적 등록만
 * 거절되는 OMR 정답 모양은 특히 저장 **전에** 막는다.
 */

/** 저장할 문제지의 지금 상태 */
export interface PaperDraft {
  items: readonly PaperItem[];
  title: string;
  /** OMR 을 켰을 때의 정답표 미리보기 — 켜지 않았거나 원본을 다 못 찾았으면 null(서버가 본다) */
  omrPlan: OmrKeyPlan | null;
}

/**
 * 저장을 막을 까닭.
 * @param draft - 지금 상태
 * @param mode - 만들기 / 고치기 (OMR 객관식 0 안내가 다르다 — 고치기에서는 OMR 을 끌 수 없다)
 * @returns 막을 까닭(사람에게 보일 말), 없으면 null
 */
export function paperSaveProblem(draft: PaperDraft, mode: 'create' | 'edit'): string | null {
  if (draft.items.length === 0) return '문항을 먼저 담아 주세요.';
  if (!draft.title.trim()) return '문제지 제목을 입력해 주세요.';
  if (!isContiguous(draft.items)) return '같은 지문의 문항이 떨어져 있어요. 붙여 주세요.';
  const plan = draft.omrPlan;
  if (plan && plan.blockers.length > 0) return `OMR 로 채점할 수 없어요 — ${describeOmrBlockers(plan.blockers)}`;
  if (plan && plan.objectiveCount === 0) {
    return mode === 'create'
      ? '객관식 문항이 없어 OMR 로 채점할 수 없어요. OMR 채점을 끄고 만들어 주세요.'
      : '객관식 문항이 없어 OMR 로 채점할 수 없어요. OMR 채점 문제지에는 객관식이 하나 이상 있어야 해요.';
  }
  return null;
}
