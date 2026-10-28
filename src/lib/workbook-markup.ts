import { VERSE_LAYOUT } from './sanitize-problem';

/**
 * 문제집 서식 어휘 — 작품 전문 · 개념 본문(`exam.reference_texts`, format html)이 평가문제집 쪽처럼 보이게 하는 표시들.
 *
 * 정화기(`sanitize-reference.ts`) · 편집기 툴바(`WorkbookToolbarControls`) · 화면 CSS(`reference-sheet.css`) ·
 * 헤드리스 적재 도구(`~/.claude/tools/exam-specs/layout-fix-2026-10-26/appfns.cjs`)가 **이 한 곳**의 값을 쓴다.
 * 한쪽만 늘리면 편집기는 넣는데 정화기가 지우거나, 정화기는 받는데 화면이 맨 상자로 그린다.
 *
 * | 구성 | 마크업 |
 * |---|---|
 * | 말머리 상자 | `<blockquote data-callout="학습 목표" data-tone="goal">` |
 * | 어휘 풀이 | `<table data-layout="vocab">` (낱말 · 풀이 두 칸, 한자는 `<small>`) |
 * | 핵심어 강조 | `<mark>` |
 * | 여백 해설 | `<table data-layout="gloss">` (원문 · 해설 두 칸) |
 * | 화살표 도식 | `<ul data-flow="down">` / `"right"` |
 *
 * ⚠️ 문항 정화기(`sanitizeProblemHTML`)는 이 표시를 **하나도** 받지 않는다 — 기출 지문·발문의 규칙은 그대로다.
 */

/** 말머리 상자의 색 갈래 — 화면 CSS 가 갈래마다 규칙 하나를 둔다(reference-sheet.test 가 고정) */
export const CALLOUT_TONES = ['goal', 'point', 'note', 'vocab', 'check', 'more', 'exam', 'answer'] as const;

/** 말머리 상자의 색 갈래 */
export type CalloutTone = (typeof CALLOUT_TONES)[number];

/** 말머리 글자 수 상한 — 책에 인쇄된 이름('시험에는 이렇게 나와')이 다 들어가는 길이 */
export const CALLOUT_LABEL_MAX = 24;

/**
 * 말머리 글자 — 글자·숫자로 시작하고 한글·문자·숫자·공백·`·!?~()-` 만.
 * CSS `content: attr(data-callout)` 로 그대로 찍히므로 좁게 받는다(따옴표·꺾쇠·& 를 막는다).
 */
const CALLOUT_LABEL = /^[\p{L}\p{N}][\p{L}\p{N} ·!?~()-]*$/u;

/**
 * 말머리로 쓸 수 있는 글자인가.
 * @param value - `data-callout` 값
 * @returns 쓸 수 있으면 true
 */
export function isCalloutLabel(value: string): boolean {
  return value.length <= CALLOUT_LABEL_MAX && value.trim() === value && CALLOUT_LABEL.test(value);
}

/**
 * 아는 색 갈래인가.
 * @param value - `data-tone` 값
 * @returns 아는 갈래면 true
 */
export function isCalloutTone(value: string): value is CalloutTone {
  return (CALLOUT_TONES as readonly string[]).includes(value);
}

/** 화살표 도식의 방향 — 아래(전 ↓ 중 ↓ 후) / 오른쪽(화자 → 청자) */
export const FLOW_DIRECTIONS = ['down', 'right'] as const;

/** 화살표 도식의 방향 */
export type FlowDirection = (typeof FLOW_DIRECTIONS)[number];

/**
 * 아는 도식 방향인가.
 * @param value - `data-flow` 값
 * @returns 아는 방향이면 true
 */
export function isFlowDirection(value: string): value is FlowDirection {
  return (FLOW_DIRECTIONS as readonly string[]).includes(value);
}

/** 원문 · 여백 해설 두 칸 표(시의 연마다 '→ 1~2연: …') — 화살표는 CSS 가 그린다, 글자에 넣지 않는다 */
export const GLOSS_LAYOUT = 'gloss';

/** 낱말 · 풀이 두 칸 표(단원 어휘·날개 풀이) — 화면은 낱말 위, 풀이 아래 */
export const VOCAB_LAYOUT = 'vocab';

/** 참고자료 본문의 표 모양 — 칸선 없는 나란히 표(verse, 문항과 같다) + 둘 */
export const REFERENCE_TABLE_LAYOUTS: ReadonlySet<string> = new Set([VERSE_LAYOUT, GLOSS_LAYOUT, VOCAB_LAYOUT]);

/** 편집기의 말머리 상자 고르기 — 평가문제집에 실제로 인쇄된 이름들 */
export const CALLOUT_PRESETS: readonly { label: string; tone: CalloutTone }[] = [
  { label: '학습 목표', tone: 'goal' },
  { label: '개념 잡기', tone: 'goal' },
  { label: '핵심 포인트', tone: 'point' },
  { label: '핵심 정리', tone: 'point' },
  { label: '쌤의 비밀 노트', tone: 'note' },
  { label: '어휘 풀이', tone: 'vocab' },
  { label: '단원 어휘 만나기', tone: 'vocab' },
  { label: '개념 체크', tone: 'check' },
  { label: '한 걸음 더', tone: 'more' },
  { label: '시험에는 이렇게 나와', tone: 'exam' },
  { label: '예시 답안', tone: 'answer' },
];

/** 편집기 고르기 칸의 색 갈래 이름 */
export const CALLOUT_TONE_LABELS: Readonly<Record<CalloutTone, string>> = {
  goal: '보라 (목표)',
  point: '초록 (핵심)',
  note: '주황 (노트)',
  vocab: '연두 (어휘)',
  check: '파랑 (체크)',
  more: '살구 (더 알기)',
  exam: '분홍 (시험)',
  answer: '회색 (답안)',
};
