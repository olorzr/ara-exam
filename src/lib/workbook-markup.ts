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
 * | 구절 풀이 | `<span data-note="시각적 심상">푸른 파도가</span>` — 구절 바로 밑(`data-note-pos="over"` 면 위)에 작은 글씨, 밑줄은 따로 `<u>` |
 * | 어휘 풀이(낱말) | `<span data-note="닭의 수컷" data-note-kind="vocab">수탉</span>` — 낱말 오른쪽 위 ★, 뜻은 글 끝 어휘 목록(`vocab-list.ts`) |
 * | 표식 | `<span data-shape="box">바다</span>` — □ ○ 는 낱말을 두르고, △ ◇ ☆ 는 낱말 앞 작은 기호(범례는 여백 해설 칸에 글로) |
 *
 * ⚠️ 문항 정화기(`sanitizeProblemHTML`)는 이 표시를 **하나도** 받지 않는다 — 기출 지문·발문의 규칙은 그대로다.
 * ⚠️ 참고자료 편집기는 `code`(네모) 마크의 `excludes` 를 푼다(`ReferenceCodeMark`) — StarterKit 의 `code` 는 다른 마크를
 *    전부 밀어내서 네모 친 낱말에 풀이를 달면 조용히 실패한다.
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

/** 구절 풀이 글자 수 상한 — 칸보다 길면 화면이 꺾지만, 줄 사이 풀이라 두 줄 안쪽이 읽기 좋다 */
export const PHRASE_NOTE_MAX = 60;

/**
 * 제어·서식·사용자 영역·미할당 글자(`\p{C}`)를 막는다 — CSS `content: attr(data-note)` 로 그대로 찍힌다(PUA 는 □ 로 보인다).
 * ⚠️ 꺾쇠도 막는다. 평문 변환(`htmlToText`·`bodyPlainText`·`stripWorkbookNotes`)과 DB 글자 수 트리거·적재 도구가 태그를
 *    `<[^>]*>` 로 걷는데, 속성값의 `>` 는 이스케이프되지 않아 거기서 태그가 끊기고 풀이 뒷글자가 원문으로 샌다.
 */
const PHRASE_NOTE = /^[^\p{C}<>]+$/u;

/**
 * 구절 풀이로 쓸 수 있는 글자인가 — 비지 않고, 앞뒤 공백 없이, 상한 안에서, 보이는 글자만.
 * @param value - `data-note` 값
 * @returns 쓸 수 있으면 true
 */
export function isPhraseNote(value: string): boolean {
  return value.length > 0 && value.length <= PHRASE_NOTE_MAX && value.trim() === value && PHRASE_NOTE.test(value);
}

/** 풀이 자리 — 속성이 없으면 구절 아래, 이 값이면 구절 위(원관념 '항구' 를 '우리 집 현관' 위에) */
export const NOTE_POS_OVER = 'over';

/**
 * 아는 풀이 자리인가 — `over` 하나뿐이다(아래는 속성을 비운다).
 * @param value - `data-note-pos` 값
 * @returns 아는 자리면 true
 */
export function isNotePos(value: string): boolean {
  return value === NOTE_POS_OVER;
}

/** 풀이 갈래 — 속성이 없으면 구절 해설(구절 밑 글), 이 값이면 낱말 뜻풀이(★ + 글 끝 어휘 목록) */
export const NOTE_KIND_VOCAB = 'vocab';

/**
 * 아는 풀이 갈래인가 — `vocab` 하나뿐이다(해설은 속성을 비운다).
 * @param value - `data-note-kind` 값
 * @returns 아는 갈래면 true
 */
export function isNoteKind(value: string): boolean {
  return value === NOTE_KIND_VOCAB;
}

/** 표식 — 낱말에 그리는 다섯 가지. □ ○ 는 테두리로 두르고 △ ◇ ☆ 는 낱말 앞에 작은 기호를 붙인다 */
export const SHAPE_KINDS = ['box', 'circle', 'triangle', 'diamond', 'star'] as const;

/** 표식 갈래 */
export type ShapeKind = (typeof SHAPE_KINDS)[number];

/**
 * 아는 표식인가.
 * @param value - `data-shape` 값
 * @returns 아는 표식이면 true
 */
export function isShapeKind(value: string): value is ShapeKind {
  return (SHAPE_KINDS as readonly string[]).includes(value);
}

/** 편집기 고르기 칸의 표식 이름 */
export const SHAPE_LABELS: Readonly<Record<ShapeKind, string>> = {
  box: '□ 네모',
  circle: '○ 동그라미',
  triangle: '△ 세모',
  diamond: '◇ 마름모',
  star: '☆ 별',
};

/** 낱말 앞에 붙는 기호 — 테두리로 두르는 표식(□ ○)은 없다. 화면 CSS 의 `::before` 와 짝(reference-phrase-marks.test 가 대조) */
export const SHAPE_GLYPHS: Readonly<Partial<Record<ShapeKind, string>>> = {
  triangle: '△',
  diamond: '◇',
  star: '☆',
};
