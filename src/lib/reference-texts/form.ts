import { normalizeGrammarPaths } from '@/lib/problem-bank/grammar-tree';
import type { ReferenceText, ReferenceUnit } from '@/types/reference-text';
import { REFERENCE_NOTE_MAX, REFERENCE_TEXT_BODY_MAX } from './constants';
import { isReferenceUnit, normalizeReferenceUnits, stringsEqual, unitsEqual } from './units';

/**
 * 작품 전문 편집 화면의 입력값과 그 검사 (순수 함수).
 *
 * 본문은 **평문**이다 — 개념지(TipTap HTML)와 달리 서식이 없다. 문항을 만들 때 AI 에게
 * 넘기는 것도, 화면에 그리는 것도 글자뿐이라 정화할 마크업이 아예 없다.
 */

/** 편집 화면이 들고 있는 값 */
export interface ReferenceTextDraft {
  title: string;
  author: string;
  /** 평문 본문 */
  body: string;
  /** 실린 교과서 단원들 (sql/60) */
  units: ReferenceUnit[];
  /** 문법 분류 경로 문자열들 ('단어 > 품사 > 명사') */
  grammar_paths: string[];
  /** 판본 메모 */
  note: string;
}

export const EMPTY_REFERENCE_DRAFT: ReferenceTextDraft = {
  title: '', author: '', body: '', units: [], grammar_paths: [], note: '',
};

/** 화면 값의 칸 이름 — 저장이 끝난 뒤 칸마다 가려 맞출 때(편집기의 `settle`) 순회한다 */
export const REFERENCE_DRAFT_KEYS = [
  'title', 'author', 'body', 'units', 'grammar_paths', 'note',
] as const satisfies readonly (keyof ReferenceTextDraft)[];

/** 빈 줄이 셋 이상 이어지는 자리 */
const EXTRA_BLANK_LINES = /\n{3,}/g;

/**
 * 붙여 넣은 본문의 모양을 고른다.
 *
 * 줄바꿈 자체는 **지운다가 아니라 지킨다** — 시는 행갈이가 곧 내용이다. 손대는 것은
 * 기기마다 다른 줄바꿈 코드, 자모가 갈린 글자, 줄 끝의 보이지 않는 공백,
 * PDF 에서 옮길 때 잔뜩 생기는 빈 줄뿐이다.
 * @param raw - 붙여 넣었거나 파일에서 읽은 글
 * @returns 저장할 평문
 */
export function normalizeBody(raw: string): string {
  return raw
    .replace(/\r\n?/g, '\n')
    .normalize('NFC')
    .split('\n')
    .map((line) => line.replace(/[ \t]+$/, ''))
    .join('\n')
    .replace(EXTRA_BLANK_LINES, '\n\n')
    .trim();
}

/**
 * 지금 저장할 수 없는 까닭. 버튼을 잠그고 그대로 보여 준다.
 * @param draft - 화면 입력값
 * @returns 못 저장하는 까닭. 저장할 수 있으면 null
 */
export function referenceDraftBlocker(draft: ReferenceTextDraft): string | null {
  // 제목은 자동 매칭이 지문과 맞춰 보는 유일한 열쇠다 — 없으면 영영 안 붙는다
  if (draft.title.trim() === '') return '작품 제목을 적어 주세요.';
  if (draft.body.trim() === '') return '본문을 붙여 넣거나 파일에서 불러와 주세요.';
  if (draft.body.length > REFERENCE_TEXT_BODY_MAX) {
    return `본문이 너무 길어요 (${REFERENCE_TEXT_BODY_MAX.toLocaleString()}자까지).`;
  }
  // 입력칸이 maxLength 로 막지만 붙여 넣기·옛 값은 넘을 수 있다 — DB CHECK 에 막히기 전에 알린다
  if (draft.note.trim().length > REFERENCE_NOTE_MAX) {
    return `판본 메모가 너무 길어요 (${REFERENCE_NOTE_MAX}자까지).`;
  }
  return null;
}

/** DB 에 보낼 값 — `user_id`·`char_count` 는 **보내지 않는다**(트리거가 채운다) */
export interface ReferenceTextPayload {
  title: string;
  author: string;
  body: string;
  units: ReferenceUnit[];
  grammar_paths: string[];
  note: string;
}

/**
 * 입력값을 저장 payload 로.
 * @param draft - 화면 입력값
 * @returns 저장할 값
 */
export function toReferenceTextPayload(draft: ReferenceTextDraft): ReferenceTextPayload {
  return {
    title: draft.title.trim(),
    author: draft.author.trim(),
    body: normalizeBody(draft.body),
    // ⚠️ DB 는 모양만 검사하고 다듬지 않는다(sql/60) — 겹침·빈 단원·상한은 여기서 정리한다
    units: normalizeReferenceUnits(draft.units),
    grammar_paths: normalizeGrammarPaths(draft.grammar_paths),
    note: draft.note.trim(),
  };
}

/**
 * 읽어 온 행을 화면 입력값으로.
 * @param row - DB 행
 * @returns 화면 입력값
 */
export function draftFromReferenceText(row: ReferenceText): ReferenceTextDraft {
  return {
    title: row.title,
    author: row.author,
    body: row.body,
    // JSON 칸이라 런타임에 한 번 더 좁힌다 — 모양이 어긋난 원소가 화면을 깨지 않게
    units: Array.isArray(row.units) ? row.units.filter(isReferenceUnit) : [],
    grammar_paths: Array.isArray(row.grammar_paths) ? row.grammar_paths : [],
    note: row.note ?? '',
  };
}

/**
 * 한 칸이 같은가 — 배열 칸은 내용으로 비교한다.
 *
 * ⚠️ 참조로 비교하면 안 된다: 저장 뒤 정규화된 **새 배열**이 오므로, 손대지 않은 단원 칸이
 *    '저장 중에 고친 칸' 으로 잘못 잡혀 `dirty` 가 영영 안 풀린다.
 * @param key - 칸 이름
 * @param a - 한쪽
 * @param b - 다른 쪽
 * @returns 같으면 true
 */
export function draftFieldEquals(
  key: (typeof REFERENCE_DRAFT_KEYS)[number],
  a: ReferenceTextDraft,
  b: ReferenceTextDraft,
): boolean {
  if (key === 'units') return unitsEqual(a.units, b.units);
  if (key === 'grammar_paths') return stringsEqual(a.grammar_paths, b.grammar_paths);
  return a[key] === b[key];
}

/**
 * 두 입력값이 같은가 — 저장하지 않고 떠나려 할 때 물을지 정한다.
 * @param a - 한쪽
 * @param b - 다른 쪽
 * @returns 같으면 true
 */
export function referenceDraftEquals(a: ReferenceTextDraft, b: ReferenceTextDraft): boolean {
  return REFERENCE_DRAFT_KEYS.every((key) => draftFieldEquals(key, a, b));
}
