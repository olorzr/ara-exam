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

/** 객관식 정답 한 토막은 **자리 번호**로 저장된다(`'3'` = 셋째 선지) */
const CHOICE_ANSWER_RE = /^[1-9]$/;

/** 복수 정답을 잇는 글자 — 저장값은 `'1,4'` 꼴이다(공백 없이 쉼표) */
const ANSWER_SEPARATOR = ',';

/** 복수 정답을 사람에게 보일 때 잇는 글자 — 좁은 격자 칸에서도 둘로 읽힌다 */
const ANSWER_JOINER = ', ';

/**
 * 객관식 정답이 가리키는 선지 자리 — **여럿일 수 있다**.
 *
 * ⚠️ 저장값은 기호(`③`)가 아니라 **번호 문자열**(`'3'`)이고, 복수 정답은 쉼표로 이은
 *    `'1,4'` 다(운영 실측: 복수 정답 58건이 전부 이 꼴). 선지 기호는 본문에 저장하지
 *    않고 그릴 때 붙인다(`choices.ts`).
 *
 * ⚠️ **한 자리만 받던 것을 넓힌 것이다**(2026-09-21). 답지·교사용·아카이브 셋이 이
 *    함수 하나로 정답을 고르므로, 여기서 복수를 못 읽으면 답지에는 `1,4` 라는 날숫자가
 *    찍히고 교사용·아카이브에서는 **어느 선지에도 색이 안 칠해진다**.
 *
 * ⚠️ **조각 하나라도 어긋나면 통째로 빈 배열이다**(`'1,0'`·`'1,'`·`',1'`, 그리고 **없는
 *    선지를 가리키는 번호**). 성한 조각만 골라 읽으면 잘못 적힌 답의 절반을 멀쩡한
 *    정답처럼 인쇄한다 — 그럴 바에는 선지로 읽지 않고 `formatAnswer` 가 적힌 그대로
 *    내보내 사람이 알아보게 둔다.
 * @param questionType - 문항 유형
 * @param answer - 저장된 정답 문자열
 * @param choiceCount - 이 문항의 선지 수. **0 이면 검사하지 않는다**(선지를 본문 그림이
 *   통째로 들고 있는 문항은 셀 것이 없다)
 * @returns 0부터 세는 자리를 **오름차순·중복 없이**. 객관식이 아니거나 번호가 아니면 빈 배열
 */
export function correctChoiceIndices(
  questionType: QuestionType,
  answer: string,
  choiceCount: number,
): number[] {
  if (questionType !== '객관식') return [];
  const parts = answer.split(ANSWER_SEPARATOR).map((p) => p.trim());
  if (!parts.every((p) => CHOICE_ANSWER_RE.test(p))) return [];
  // 손으로 적은 `'3,1'`·`'1,1'` 이 격자에서 튀지 않게 — 실데이터는 이미 오름차순이다.
  // ⚠️ 비교자를 빼지 말 것: `sort()` 기본값은 **사전순**이라 자리가 두 자리로 늘면 뒤집힌다
  const indices = [...new Set(parts.map((p) => Number(p) - 1))].sort((a, b) => a - b);
  /*
   * ⚠️ **없는 선지를 가리키면 통째로 버린다**(코덱스 리뷰 1R). 5지선다에 `'1,6'` 이
   *    적혀 있으면 답지는 `①, (6)` 을 찍는데 교사용·아카이브는 그릴 선지가 없어
   *    **①만 칠한다** — 선생님은 그 한 칸을 완전한 정답으로 읽는다. 단일 정답(`'6'`)은
   *    아무 칸도 안 칠해져 티가 나지만, **복수는 반쪽이 정답처럼 보이는 것이 더 나쁘다.**
   *    오름차순이라 마지막 하나만 보면 된다.
   */
  if (choiceCount > 0 && indices[indices.length - 1] >= choiceCount) return [];
  return indices;
}

/**
 * 사람이 읽을 정답 한 토막.
 *
 * 객관식은 **선지 기호**로 바꿔 찍는다 — 문제지에는 `①②③` 으로 인쇄되는데 정답표만
 * `3` 이면 눈으로 맞춰 보는 동안 한 번씩 셈을 해야 한다. 복수 정답도 마찬가지라
 * `③, ⑤` 로 잇는다(사용자 결정 2026-09-21) — 한 격자 안에서 `③` 과 `1,4` 가 섞이면
 * 같은 줄의 두 칸이 서로 다른 규칙으로 적힌 것처럼 보인다.
 * @param questionType - 문항 유형
 * @param answer - 저장된 정답 문자열
 * @param choiceCount - 이 문항의 선지 수 (0 이면 범위를 검사하지 않는다)
 * @returns `③` · `③, ⑤` · 적어 둔 답 · '미입력'
 */
export function formatAnswer(
  questionType: QuestionType,
  answer: string,
  choiceCount: number,
): string {
  const indices = correctChoiceIndices(questionType, answer, choiceCount);
  if (indices.length > 0) return indices.map(choiceGlyph).join(ANSWER_JOINER);
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
    answer: formatAnswer(item.question_type, item.answer, item.choices.length),
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
      answer: formatAnswer(item.question_type, item.answer, item.choices.length),
      explanation_html: html,
    });
  });
  return out;
}
