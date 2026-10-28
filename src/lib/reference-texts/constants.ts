import type { ReferenceTextFormat, ReferenceTextKind } from '@/types/reference-text';

/** 작품 전문 · 개념의 정책값 */

/**
 * 전문 한 편의 길이 상한 (글자).
 *
 * 장편 소설은 이 상한을 넘는데, 그런 글은 **참고자료로 통째로 실을 수도 없다**
 * (`QUIZ_REFERENCE_TEXT_MAX` 가 앞에서 자른다). 시·단편·수필을 담는 크기다.
 */
export const REFERENCE_TEXT_BODY_MAX = 200_000;

/** 목록에 한 번에 읽는 최대 줄 수 — 작품 수백 편 규모라 페이지를 나누지 않는다 */
export const REFERENCE_TEXT_LIST_LIMIT = 200;

/** 참고자료 고르기·자동 매칭 목록의 최대 줄 수 */
export const REFERENCE_TEXT_PICK_LIMIT = 30;

/** 목록 검색을 서버에 물어보기까지 기다리는 시간 (ms) — 글자마다 조회하면 왕복만 는다 */
export const REFERENCE_SEARCH_DEBOUNCE_MS = 250;

/**
 * 전문 하나에 붙일 수 있는 교과서 단원 수.
 * ⚠️ DB 검사 함수(`exam.reference_units_valid`, sql/60)의 상한과 **같아야 한다** —
 *    한쪽만 늘리면 화면은 받는데 저장이 CHECK 에 막힌다.
 */
export const REFERENCE_UNITS_MAX = 8;

/** 판본 메모 길이 상한 (글자) — DB CHECK `reference_texts_note_len` 과 같다 */
export const REFERENCE_NOTE_MAX = 200;

/**
 * 패싯(트리) 스캔 — 한 번에 읽는 줄 수와 전체 상한.
 * PostgREST 기본 상한(1,000)에서 말없이 잘리면 트리에서 작품이 조용히 사라진다
 * (문제 은행 `facets.ts` 와 같은 값·같은 이유).
 */
export const REFERENCE_FACET_CHUNK = 1000;
export const REFERENCE_FACET_MAX_ROWS = 20_000;

/** 종류 — 화면 순서가 곧 이 순서다 */
export const REFERENCE_KINDS: readonly ReferenceTextKind[] = ['작품', '개념'];

/**
 * 종류마다 새로 만들 때의 본문 형식 — 둘 다 문제집 서식(HTML).
 * 작품도 평가문제집 쪽처럼 원문 옆 여백 해설·어휘 풀이를 함께 담는다(2026-10-28 원장 결정).
 * 옛 평문(`text`) 행은 그대로 읽히고, 참고자료로는 해설을 걷은 원문만 간다(`referenceBodyPlainText`).
 */
export const DEFAULT_FORMAT_BY_KIND: Readonly<Record<ReferenceTextKind, ReferenceTextFormat>> = {
  작품: 'html',
  개념: 'html',
};

/** 태그 수 상한 — DB CHECK `reference_texts_tags_max`(sql/79)와 같다 */
export const REFERENCE_TAGS_MAX = 8;

/** 태그 하나의 길이 상한 (글자) — 앱만의 값(DB 는 개수만 본다) */
export const REFERENCE_TAG_MAX_LEN = 30;

/** 단원 안 차례 상한 — DB CHECK `reference_texts_seq_range`(sql/79)와 같다 */
export const REFERENCE_SEQ_MAX = 9999;

/** 태그 입력칸의 제안 — 평가문제집 적재가 쓰는 이름과 같다 */
export const REFERENCE_TAG_SUGGESTIONS: readonly string[] = [
  '핵심 정리', '제재 개관', '제재', '더 읽어 보기', '학습 목표', '맞춤법',
];
