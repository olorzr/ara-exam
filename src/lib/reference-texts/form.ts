import { REFERENCE_TEXT_BODY_MAX } from './constants';
import type { ReferenceText } from '@/types/reference-text';

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
}

export const EMPTY_REFERENCE_DRAFT: ReferenceTextDraft = { title: '', author: '', body: '' };

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
  return null;
}

/** DB 에 보낼 값 — `user_id`·`char_count` 는 **보내지 않는다**(트리거가 채운다) */
export interface ReferenceTextPayload {
  title: string;
  author: string;
  body: string;
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
  };
}

/**
 * 읽어 온 행을 화면 입력값으로.
 * @param row - DB 행
 * @returns 화면 입력값
 */
export function draftFromReferenceText(row: ReferenceText): ReferenceTextDraft {
  return { title: row.title, author: row.author, body: row.body };
}

/**
 * 두 입력값이 같은가 — 저장하지 않고 떠나려 할 때 물을지 정한다.
 * @param a - 한쪽
 * @param b - 다른 쪽
 * @returns 같으면 true
 */
export function referenceDraftEquals(a: ReferenceTextDraft, b: ReferenceTextDraft): boolean {
  return a.title === b.title && a.author === b.author && a.body === b.body;
}
