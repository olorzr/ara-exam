import { choiceGlyph } from '@/lib/problem-bank/choices';
import { sanitizeProblemHTML } from '@/lib/sanitize-problem';
import type { PaperItemSnapshot, QuestionType } from '@/types/problem-bank';

/**
 * 문제지의 **정답·해설** 표기 (순수 함수).
 *
 * 세 인쇄물이 이 한 곳을 쓴다 — 교사용(문항 밑의 답), 답지의 빠른 정답 격자,
 * 답지의 해설 머리. 각자 세거나 각자 꾸미면 같은 문항의 정답이 한 장에서는 `③`,
 * 다른 장에서는 `3` 으로 찍혀 채점하는 사람이 둘을 다른 답으로 읽는다.
 */

/** 정답이 비었을 때 찍는 문구 — 빈칸으로 두면 인쇄물에서 누락과 구분되지 않는다 */
export const MISSING_ANSWER_LABEL = '미입력';

/** 객관식 정답은 **자리 번호**로 저장된다(`'3'` = 셋째 선지) */
const CHOICE_ANSWER_RE = /^[1-9]$/;

/**
 * 객관식 정답이 가리키는 선지 자리.
 *
 * ⚠️ 저장값은 기호(`③`)가 아니라 **번호 문자열**(`'3'`)이다 — 선지 기호는 본문에
 *    저장하지 않고 그릴 때 붙이기 때문이다(`choices.ts`).
 * @param questionType - 문항 유형
 * @param answer - 저장된 정답 문자열
 * @returns 0부터 세는 자리. 객관식이 아니거나 번호가 아니면 null
 */
export function correctChoiceIndex(questionType: QuestionType, answer: string): number | null {
  if (questionType !== '객관식') return null;
  const value = answer.trim();
  if (!CHOICE_ANSWER_RE.test(value)) return null;
  return Number(value) - 1;
}

/**
 * 사람이 읽을 정답 한 토막.
 *
 * 객관식은 **선지 기호**로 바꿔 찍는다 — 문제지에는 `①②③` 으로 인쇄되는데 정답표만
 * `3` 이면 눈으로 맞춰 보는 동안 한 번씩 셈을 해야 한다.
 * @param questionType - 문항 유형
 * @param answer - 저장된 정답 문자열
 * @returns `③` · 적어 둔 답 · '미입력'
 */
export function formatAnswer(questionType: QuestionType, answer: string): string {
  const index = correctChoiceIndex(questionType, answer);
  if (index !== null) return choiceGlyph(index);
  return answer.trim() || MISSING_ANSWER_LABEL;
}

/** 빠른 정답 격자 한 칸 */
export interface AnswerRow {
  number: number;
  /** 미입력이면 '미입력' — 빈칸이면 누락과 구분되지 않는다 */
  answer: string;
  question_type: QuestionType;
}

/**
 * 빠른 정답 줄을 만든다.
 *
 * 번호는 **문제지에서의 자리**(1부터)다 — 원본 시험지 번호를 쓰면 문제지에 찍힌 번호와
 * 어긋난다.
 * @param items - 문제지 항목 (order_index 순서)
 * @returns 자리 순서대로의 줄
 */
export function buildAnswerRows(items: readonly PaperItemSnapshot[]): AnswerRow[] {
  return items.map((item, i) => ({
    number: i + 1,
    answer: formatAnswer(item.question_type, item.answer),
    question_type: item.question_type,
  }));
}

/**
 * 교사용에서 해설을 **문항 블록 안에 둘 수 있는** 최대 길이(평문 기준).
 *
 * ⚠️ 인쇄 엔진의 블록 하나는 **쪽을 넘겨 쪼갤 수 없는 최소 단위**라, 한 쪽에 못 담으면
 *    통째로 `transform: scale()` 로 줄여 찍는다. 해설은 길이에 상한이 없어서(해설지를
 *    통째로 읽어 온 문항이 있다) 그대로 두면 **문항·선지·답까지 깨알같이 줄어든다.**
 *    이 길이를 넘으면 해설을 문단 단위 블록으로 갈라 흘려 보낸다(지문과 같은 규약).
 *    넉넉히 잡는다 — 갈리면 쪽 경계에서 문항과 떨어질 수 있으니 웬만하면 붙여 둔다.
 */
export const EXPLANATION_INLINE_MAX_CHARS = 400;

/**
 * 인쇄에 실제로 나갈 해설 HTML.
 *
 * ⚠️ 길이를 재고 '실을지' 를 정하는 일은 **정화한 뒤**에 해야 한다. 스냅샷은 jsonb 라
 *    DB 를 직접 건드린 값이 섞일 수 있는데, 정화가 통째로 지우는 태그(`<script>`)로만
 *    이뤄진 해설을 날글자로 재면 **길다고 판정해 놓고 그릴 것은 없는** 상태가 된다
 *    (코덱스 정지 리뷰 2R).
 * @param html - 저장된 해설 HTML
 * @returns 정화한 HTML (실을 것이 없으면 빈 문자열)
 */
export function explanationHtml(html: string | undefined): string {
  const clean = sanitizeProblemHTML(html ?? '').trim();
  return explanationTextLength(clean) > 0 || /<(img|figure|table|hr)\b/i.test(clean) ? clean : '';
}

/**
 * 해설의 평문 길이 — 태그를 걷고 공백을 접어 센다.
 * @param html - 해설 HTML
 * @returns 글자 수
 */
export function explanationTextLength(html: string): number {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().length;
}

/**
 * 이 해설을 **따로 흘려 보내야** 하는가.
 *
 * ⚠️ 블록을 만드는 쪽(`blocks.ts`)과 그리는 쪽(`PaperPrintBlocks`)이 **같은 함수**로
 *    판정해야 한다 — 갈리면 해설이 두 번 찍히거나(양쪽 다 그림) 아예 사라진다(양쪽 다 건너뜀).
 * @param html - 해설 HTML
 * @returns 따로 내보내야 하면 true
 */
export function splitsExplanation(html: string | undefined): boolean {
  return explanationTextLength(explanationHtml(html)) > EXPLANATION_INLINE_MAX_CHARS;
}

/** 답지에 싣는 해설 한 덩어리 */
export interface ExplanationEntry {
  /** 문제지에서의 자리 (빠른 정답 격자와 같은 번호) */
  number: number;
  answer: string;
  explanation_html: string;
}

/**
 * 해설이 **있는** 문항만 골라 낸다.
 *
 * ⚠️ 해설 없는 문항을 '해설 없음' 으로 끼워 넣지 않는다. 기출은 해설이 안 달린 문항이
 *    흔해서, 넣으면 답지 몇 쪽이 '해설 없음' 으로 채워지고 정작 읽을 해설이 묻힌다 —
 *    모든 문항의 답은 위쪽 **빠른 정답 격자**가 이미 보여 준다.
 * @param items - 문제지 항목
 * @returns 자리 순서대로의 해설 목록 (없으면 빈 배열)
 */
export function explanationEntries(items: readonly PaperItemSnapshot[]): ExplanationEntry[] {
  const out: ExplanationEntry[] = [];
  items.forEach((item, i) => {
    // ⚠️ 정화 **뒤**에 본다 — 지워질 태그만 든 해설은 '해설' 띠만 불러내고 빈 줄을 찍는다
    const html = explanationHtml(item.explanation_html);
    if (!html) return;
    out.push({
      number: i + 1,
      answer: formatAnswer(item.question_type, item.answer),
      explanation_html: html,
    });
  });
  return out;
}
