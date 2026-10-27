import { normalizeGrammarPaths } from '@/lib/problem-bank/grammar-tree';
import { sanitizeProblemHTML } from '@/lib/sanitize-problem';
import type {
  ReferenceText, ReferenceTextFormat, ReferenceTextKind, ReferenceUnit,
} from '@/types/reference-text';
import { bodyLength, bodyPlainText, normalizeTags, parseSeq } from './body-format';
import {
  DEFAULT_FORMAT_BY_KIND, REFERENCE_NOTE_MAX, REFERENCE_SEQ_MAX, REFERENCE_TAGS_MAX, REFERENCE_TEXT_BODY_MAX,
} from './constants';
import { isReferenceUnit, normalizeReferenceUnits, stringsEqual, unitsEqual } from './units';

/**
 * 작품 전문 · 개념 편집 화면의 입력값과 그 검사 (순수 함수).
 *
 * 본문은 형식(`format`)이 둘이다 — 작품은 대개 **평문**(텍스트 노드로만 그린다), 개념은 표·목록이 든
 * **HTML**(문항 정화기 `sanitizeProblemHTML` 프로필 — 저장할 때 정화하고 그릴 때 또 정화한다).
 */

/** 편집 화면이 들고 있는 값 */
export interface ReferenceTextDraft {
  title: string;
  author: string;
  /** 본문 — `format` 이 정한 모양 */
  body: string;
  /** 작품 전문 / 개념 정리 */
  kind: ReferenceTextKind;
  /** 본문 형식 */
  format: ReferenceTextFormat;
  /** 단원 안 차례 — **입력칸 글자**(비워 둘 수 있다). 저장할 때 숫자로 바꾼다 */
  seq: string;
  /** 꼬리표 */
  tags: string[];
  /** 실린 교과서 단원들 (sql/60) */
  units: ReferenceUnit[];
  /** 문법 분류 경로 문자열들 ('단어 > 품사 > 명사') */
  grammar_paths: string[];
  /** 판본 메모 */
  note: string;
}

export const EMPTY_REFERENCE_DRAFT: ReferenceTextDraft = {
  title: '', author: '', body: '', kind: '작품', format: 'text', seq: '', tags: [],
  units: [], grammar_paths: [], note: '',
};

/**
 * 새로 만들 때의 빈 입력값 — 종류에 맞는 본문 형식으로.
 * @param kind - 종류 (주소 `?kind=개념` 에서 온다)
 * @returns 빈 입력값
 */
export function emptyReferenceDraft(kind: ReferenceTextKind = '작품'): ReferenceTextDraft {
  return { ...EMPTY_REFERENCE_DRAFT, kind, format: DEFAULT_FORMAT_BY_KIND[kind] };
}

/** 화면 값의 칸 이름 — 저장이 끝난 뒤 칸마다 가려 맞출 때(편집기의 `settle`) 순회한다 */
export const REFERENCE_DRAFT_KEYS = [
  'title', 'author', 'body', 'kind', 'format', 'seq', 'tags', 'units', 'grammar_paths', 'note',
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
  if (draft.title.trim() === '') {
    return draft.kind === '개념' ? '개념 제목을 적어 주세요.' : '작품 제목을 적어 주세요.';
  }
  // ⚠️ 보이는 글자로 본다 — 빈 HTML 편집기는 `<p></p>` 라 글자열로는 비지 않았다
  if (bodyPlainText(draft.body, draft.format).trim() === '') return '본문을 붙여 넣거나 파일에서 불러와 주세요.';
  if (bodyLength(draft.body, draft.format) > REFERENCE_TEXT_BODY_MAX) {
    return `본문이 너무 길어요 (${REFERENCE_TEXT_BODY_MAX.toLocaleString()}자까지).`;
  }
  // 입력칸이 maxLength 로 막지만 붙여 넣기·옛 값은 넘을 수 있다 — DB CHECK 에 막히기 전에 알린다
  if (draft.note.trim().length > REFERENCE_NOTE_MAX) {
    return `판본 메모가 너무 길어요 (${REFERENCE_NOTE_MAX}자까지).`;
  }
  if (parseSeq(draft.seq) === 'invalid') return `차례는 0~${REFERENCE_SEQ_MAX} 사이의 숫자로 적어 주세요.`;
  if (draft.tags.length > REFERENCE_TAGS_MAX) return `태그는 ${REFERENCE_TAGS_MAX}개까지예요.`;
  return null;
}

/**
 * DB 에 보낼 값 — `user_id`·`char_count`·`source_key` 는 **보내지 않는다**
 * (앞의 둘은 트리거가 채우고, 적재 열쇠는 헤드리스 적재만 쓴다).
 */
export interface ReferenceTextPayload {
  title: string;
  author: string;
  body: string;
  kind: ReferenceTextKind;
  format: ReferenceTextFormat;
  seq: number | null;
  tags: string[];
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
  const seq = parseSeq(draft.seq);
  return {
    title: draft.title.trim(),
    author: draft.author.trim(),
    body: draft.format === 'html' ? sanitizeProblemHTML(draft.body).trim() : normalizeBody(draft.body),
    kind: draft.kind,
    format: draft.format,
    // 차단 조건이 잘못된 차례를 먼저 막는다 — 여기 닿았으면 숫자이거나 빈칸이다
    seq: seq === 'invalid' ? null : seq,
    tags: normalizeTags(draft.tags),
    // ⚠️ DB 는 모양만 검사하고 다듬지 않는다(sql/60) — 겹침·빈 단원·상한은 여기서 정리한다
    units: normalizeReferenceUnits(draft.units),
    grammar_paths: normalizeGrammarPaths(draft.grammar_paths),
    note: draft.note.trim(),
  };
}

/**
 * DB 에 들어간 값을 화면 입력값 모양으로 — 저장 뒤 '저장된 값' 이 된다(편집기의 `settle`).
 * 차례만 모양이 다르다(숫자 ↔ 입력칸 글자).
 * @param payload - 보낸 값
 * @returns 화면 입력값
 */
export function draftFromPayload(payload: ReferenceTextPayload): ReferenceTextDraft {
  return { ...payload, seq: payload.seq === null ? '' : String(payload.seq) };
}

/**
 * 읽어 온 행을 화면 입력값으로.
 * @param row - DB 행
 * @returns 화면 입력값
 */
export function draftFromReferenceText(row: ReferenceText): ReferenceTextDraft {
  const format: ReferenceTextFormat = row.format === 'html' ? 'html' : 'text';
  return {
    title: row.title,
    author: row.author,
    // HTML 은 읽을 때도 정화한다(직접 DB 쓰기·옛 값이 남을 수 있다 — 개념지와 같은 규약)
    body: format === 'html' ? sanitizeProblemHTML(row.body) : row.body,
    kind: row.kind === '개념' ? '개념' : '작품',
    format,
    seq: typeof row.seq === 'number' ? String(row.seq) : '',
    tags: Array.isArray(row.tags) ? row.tags.filter((t): t is string => typeof t === 'string') : [],
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
  if (key === 'tags') return stringsEqual(a.tags, b.tags);
  if (key === 'body') return bodyEquals(a, b);
  return a[key] === b[key];
}

/**
 * 본문이 같은가 — HTML 이면 **정화한 모양으로** 견준다.
 *
 * ⚠️ 편집기(TipTap)는 저장된 HTML 을 제 모양으로 다시 써서 내보낸다(`<colgroup>`·폭 같은, 정화기가 지우는 것).
 *    글자열로만 견주면 아무것도 안 고쳐도 '저장 안 됨' 이 되고, 새로 만든 뒤 주소 옮기기(`/new → /{id}`)가
 *    영영 미뤄진다(`navigateWhenSafe`). 같은 글자열이면 정화를 건너뛴다(대부분의 경우).
 * @param a - 한쪽
 * @param b - 다른 쪽
 * @returns 같으면 true
 */
function bodyEquals(a: ReferenceTextDraft, b: ReferenceTextDraft): boolean {
  if (a.body === b.body) return true;
  if (a.format !== 'html' || b.format !== 'html') return false;
  return sanitizeProblemHTML(a.body).trim() === sanitizeProblemHTML(b.body).trim();
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
