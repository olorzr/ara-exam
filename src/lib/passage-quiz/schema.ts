import {
  PASSAGE_QUIZ_ANSWER_MAX, PASSAGE_QUIZ_EVIDENCE_MAX, PASSAGE_QUIZ_MAX_PER_TYPE,
  PASSAGE_QUIZ_QUESTION_MAX, PASSAGE_QUIZ_STATEMENT_MAX,
} from './constants';

/**
 * 지문으로 만드는 O,X·단답형의 구조화 출력 계약
 * (엄격 모드 — `problem-ocr/schema.ts` 와 같은 규약: 모든 속성이 `required`, `additionalProperties:false`).
 *
 * 모양만 강제하고, 값이 **지문과 맞는지**는 `parse.ts` 가 다시 본다.
 */

/** 유형별로 몇 개를 낼지. `null` 이면 AI 가 지문을 보고 정한다 */
export interface PassageQuizCounts {
  ox: number | null;
  short: number | null;
}

/** O,X 문항 하나 */
export interface OxItem {
  /** 지문만 읽고 참·거짓을 가릴 수 있는 한 문장 */
  statement: string;
  answer: 'O' | 'X';
  /** 답의 근거가 되는 **지문 그대로의** 구절 */
  evidence: string;
}

/** 단답형 문항 하나 */
export interface ShortItem {
  question: string;
  /** 지문에 글자 그대로 있는 낱말·구 */
  answer: string;
  /** 답의 근거가 되는 **지문 그대로의** 구절 */
  evidence: string;
}

/**
 * ⚠️ 요청 개수는 스키마에 넣지 않는다. 요청마다 `maxItems` 를 바꾸면 상한이 세 곳(스키마·프롬프트·파서)
 *    에서 갈라진다 — 개수는 프롬프트가 부탁하고 파서가 지킨다.
 */
export const PASSAGE_QUIZ_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['ox', 'short'],
  properties: {
    ox: {
      type: 'array',
      maxItems: PASSAGE_QUIZ_MAX_PER_TYPE,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['statement', 'answer', 'evidence'],
        properties: {
          statement: { type: 'string', maxLength: PASSAGE_QUIZ_STATEMENT_MAX },
          answer: { type: 'string', enum: ['O', 'X'] },
          evidence: { type: 'string', maxLength: PASSAGE_QUIZ_EVIDENCE_MAX },
        },
      },
    },
    short: {
      type: 'array',
      maxItems: PASSAGE_QUIZ_MAX_PER_TYPE,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['question', 'answer', 'evidence'],
        properties: {
          question: { type: 'string', maxLength: PASSAGE_QUIZ_QUESTION_MAX },
          answer: { type: 'string', maxLength: PASSAGE_QUIZ_ANSWER_MAX },
          evidence: { type: 'string', maxLength: PASSAGE_QUIZ_EVIDENCE_MAX },
        },
      },
    },
  },
} as const;
