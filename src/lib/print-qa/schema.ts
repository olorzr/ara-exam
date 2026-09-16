import {
  PRINT_QA_ANSWER_MAX, PRINT_QA_ANSWER_MAX_TARGETS, PRINT_QA_EVIDENCE_MAX,
  PRINT_QA_LABEL_MAX, PRINT_QA_MAX_ITEMS, PRINT_QA_QUESTION_MAX,
} from './constants';

/**
 * 문답 시험지의 구조화 출력 계약
 * (엄격 모드 — `problem-ocr/schema.ts` 와 같은 규약: 모든 속성이 `required`,
 * `additionalProperties:false`).
 *
 * 모양만 강제하고, 값이 **원문과 맞는지**는 `parse-split.ts`·`parse-answers.ts` 가 다시 본다.
 *
 * ⚠️ **`lead`(물음 앞 지문·지시문)를 모델에게 묻지 않는다.** 물어서 받으면 그 글이 원문에
 *    있는지 또 대조해야 하고, 길이 상한에 걸려 잘려 온다 — 원문에서 **잘라 오는** 편이
 *    싸고 언제나 정확하다(`parse-split.ts` 의 `sliceLeads`).
 * ⚠️ **`answerSource`(인쇄된 답인가 손글씨인가)도 묻지 않는다.** 그 판정은 OCR 이 남긴
 *    `<em>` 자리로 **기계가** 한다 — 모델에게 물으면 그 말을 믿게 되는데 확인할 길이 없다.
 */

/** 나누기 턴이 돌려주는 문항 하나 */
export interface PrintQaSplitItem {
  /** 프린트에 인쇄된 번호. 없으면 '' */
  label: string;
  /** 물음 — 원문 그대로 */
  question: string;
  /** 프린트에 **인쇄돼 있는** 답. 없으면 '' */
  answer: string;
}

export interface PrintQaSplitDraft {
  items: PrintQaSplitItem[];
  /** 프린트에 인쇄돼 있던 작품명. 없으면 '' */
  work_title: string;
  /** 프린트에 인쇄돼 있던 지은이. 없으면 '' */
  work_author: string;
  warnings: string[];
}

/** 나누기 턴의 스키마 */
export const PRINT_QA_SPLIT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['items', 'work_title', 'work_author', 'warnings'],
  properties: {
    items: {
      type: 'array',
      maxItems: PRINT_QA_MAX_ITEMS,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['label', 'question', 'answer'],
        properties: {
          label: { type: 'string', maxLength: PRINT_QA_LABEL_MAX },
          question: { type: 'string', maxLength: PRINT_QA_QUESTION_MAX },
          answer: { type: 'string', maxLength: PRINT_QA_ANSWER_MAX },
        },
      },
    },
    work_title: { type: 'string', maxLength: 100 },
    work_author: { type: 'string', maxLength: 100 },
    warnings: { type: 'array', maxItems: 20, items: { type: 'string', maxLength: 300 } },
  },
} as const;

/**
 * 모범답안 턴이 돌려주는 답 하나.
 *
 * ⚠️ 문항을 가리키는 값이 **`no`(이번 요청에서 매긴 일련번호)** 다. 우리 `id`(UUID)나 프린트에
 *    인쇄된 번호를 쓰지 않는 까닭: 인쇄된 번호는 비거나 겹칠 수 있고('(2)' 가 두 번 나오는
 *    프린트가 있다), UUID 는 모델이 한 글자씩 옮겨 적다 틀린다. 일련번호는 짧고 유일하다.
 */
export interface PrintQaAnswerRow {
  no: number;
  answer: string;
  /** 답의 근거가 되는 **프린트·참고자료 그대로의** 구절 */
  evidence: string;
}

export interface PrintQaAnswerDraft {
  answers: PrintQaAnswerRow[];
}

/** 모범답안 턴의 스키마 */
export const PRINT_QA_ANSWER_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['answers'],
  properties: {
    answers: {
      type: 'array',
      maxItems: PRINT_QA_ANSWER_MAX_TARGETS,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['no', 'answer', 'evidence'],
        properties: {
          no: { type: 'integer', minimum: 1 },
          answer: { type: 'string', maxLength: PRINT_QA_ANSWER_MAX },
          evidence: { type: 'string', maxLength: PRINT_QA_EVIDENCE_MAX },
        },
      },
    },
  },
} as const;
