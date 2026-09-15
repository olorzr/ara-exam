import {
  CONCEPT_PICK_CONTEXT_MAX, CONCEPT_PICK_MAX_COUNT, CONCEPT_PICK_REASON_MAX,
  CONCEPT_PICK_TEXT_MAX,
} from './constants';

/** 추천 하나 */
export interface ConceptPick {
  /** 본문에 **글자 그대로** 있는 용어 */
  text: string;
  /** 왜 외워야 하는지 한 줄 */
  reason: string;
  /**
   * 이 용어가 있던 자리의 본문 구절 (없으면 `''`).
   * 같은 낱말이 작품 원문과 설명 표에 다 있을 때 **설명 쪽**에 빈칸을 뚫는 데 쓴다.
   */
  context: string;
}

/**
 * 구조화 출력 계약 (엄격 모드 — `problem-ocr/schema.ts` 와 같은 규약).
 * 모양만 강제하고, 값이 말이 되는지는 `parse.ts` 가 다시 본다.
 */
export const CONCEPT_PICK_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['picks'],
  properties: {
    picks: {
      type: 'array',
      maxItems: CONCEPT_PICK_MAX_COUNT,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['text', 'reason', 'context'],
        properties: {
          text: { type: 'string', maxLength: CONCEPT_PICK_TEXT_MAX },
          reason: { type: 'string', maxLength: CONCEPT_PICK_REASON_MAX },
          context: { type: 'string', maxLength: CONCEPT_PICK_CONTEXT_MAX },
        },
      },
    },
  },
} as const;
