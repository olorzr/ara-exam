import type { PrintQaItem } from '@/types/print-scan';

/**
 * 문답 인쇄물의 모양을 정하는 순수 함수들.
 *
 * 세 인쇄물(문제지·교사용·답지)이 **같은 함수**를 쓴다 — 각자 정하면 문제지의 답 쓰는 칸과
 * 교사용의 답 길이가 어긋나고, 제목이 갈린다.
 */

/** 인쇄물 종류 */
export type PrintQaSheetKind = 'paper' | 'teacher' | 'key';

/** 종류별 제목 꼬리표. 문제지에는 아무것도 안 붙인다(학생이 받는 것이다) */
const TITLE_SUFFIX: Record<PrintQaSheetKind, string> = {
  paper: '',
  teacher: ' - 교사용',
  key: ' - 답지',
};

/**
 * 인쇄물 제목.
 * @param name - 프린트 이름 (묶음 이름)
 * @param kind - 인쇄물 종류
 * @returns 머리말에 쓸 제목
 */
export function qaPaperTitle(name: string, kind: PrintQaSheetKind): string {
  const trimmed = name.trim() || '학교 프린트';
  return `${trimmed}${TITLE_SUFFIX[kind]}`;
}

/**
 * 머리말에 찍을 출처 한 줄 — '광희중학교 · 2026학년도 · 중2 · 2학기 · 중간'.
 * @param bundle - 묶음의 분류값
 * @returns 출처 라벨 (비면 빈 배열)
 */
export function qaSourceLabels(bundle: {
  school_name: string; year: string; grade: string; semester: string; exam_type: string;
}): string[] {
  const label = [
    bundle.school_name,
    bundle.year && `${bundle.year}학년도`,
    bundle.grade, bundle.semester, bundle.exam_type,
  ].filter(Boolean).join(' · ');
  return label ? [label] : [];
}

/** 답이 짧다고 볼 길이 (글자) — 낱말이나 한 구절 */
const SHORT_ANSWER = 20;

/** 답이 보통이라고 볼 길이 (글자) — 한 문장 */
const MEDIUM_ANSWER = 80;

/**
 * 답을 모를 때 '길게 써야 하는 물음' 으로 보는 말들.
 *
 * ⚠️ **동사꼴로 본다**(`서술하`이지 `서술`이 아니다). 국어 프린트에는 '서술자는 누구인가?'
 *    처럼 그 글자를 품은 **명사**가 흔해서, 어간만 보면 낱말 하나 쓰는 물음에 네 줄이 그어진다.
 */
const LONG_ANSWER_HINT = /서술하|설명하|밝히|까닭|이유|비교하|분석하/;

/**
 * 문제지에 그릴 **답 쓰는 줄 수**.
 *
 * 답을 알면 그 길이로 정한다 — 낱말 하나를 쓰는 자리에 네 줄을 그으면 학생은 더 써야 하는
 * 줄 알고, 서술형에 한 줄만 그으면 답을 적을 자리가 없다.
 * 답을 모르면(아직 안 채운 문항) 물음의 말투로 가늠한다.
 * @param item - 문항
 * @returns 줄 수 (1 이상)
 */
export function answerLineCount(item: Pick<PrintQaItem, 'answer' | 'question'>): number {
  const length = item.answer.trim().length;
  if (length > 0) {
    if (length <= SHORT_ANSWER) return 2;
    return length <= MEDIUM_ANSWER ? 3 : 4;
  }
  return LONG_ANSWER_HINT.test(item.question) ? 4 : 2;
}

/** 답 옆에 붙일 꼬리표 — **AI 가 만든 답은 반드시 밝힌다**(선생님이 확인해야 한다) */
export interface QaAnswerTag {
  text: string;
  /** 선생님이 꼭 봐야 하는가 (근거 없는 AI 답) */
  check: boolean;
}

/**
 * 교사용·답지에 답과 함께 찍을 꼬리표.
 *
 * ⚠️ `printed`(프린트에 인쇄돼 있던 답)에는 아무것도 붙이지 않는다 — 원래 그 자리에 있던
 *    답이라 따로 밝힐 것이 없다. 나머지 셋은 **어디서 온 답인지가 곧 믿을 만한 정도**다.
 * @param item - 문항
 * @returns 꼬리표. 붙일 것이 없으면 null
 */
export function answerTag(item: PrintQaItem): QaAnswerTag | null {
  if (item.answerSource === 'handwritten') return { text: '학생이 쓴 답', check: true };
  if (item.answerSource === 'teacher') return { text: '직접 쓴 답', check: false };
  if (item.answerSource !== 'ai') return null;
  if (item.evidenceSource === null) return { text: 'AI 모범답안 · 근거 없음', check: true };
  const where = item.evidenceSource === '' ? '이 프린트' : item.evidenceSource;
  return { text: `AI 모범답안 · [${where}]`, check: false };
}
