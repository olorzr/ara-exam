import {
  CONCEPT_PICK_MAX_COUNT, CONCEPT_PICK_REASON_MAX, CONCEPT_PICK_TEXT_MAX,
} from './constants';

/** 추천 하나 */
export interface ConceptPick {
  /** 본문에 **글자 그대로** 있는 용어 */
  text: string;
  /** 왜 외워야 하는지 한 줄 */
  reason: string;
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
        required: ['text', 'reason'],
        properties: {
          text: { type: 'string', maxLength: CONCEPT_PICK_TEXT_MAX },
          reason: { type: 'string', maxLength: CONCEPT_PICK_REASON_MAX },
        },
      },
    },
  },
} as const;
