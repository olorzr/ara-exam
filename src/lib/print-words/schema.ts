import { PRINT_MEANING_MAX, PRINT_WORD_MAX, PRINT_WORDS_MAX_COUNT } from './constants';

/** 프린트에서 뽑아 온 어휘 한 줄 */
export interface PrintWordDraft {
  /** 프린트에 인쇄된 표제어 */
  word: string;
  /** 프린트에 인쇄된 뜻. **적혀 있지 않으면 빈 문자열**(지어내지 않는다) */
  meaning: string;
}

export interface PrintWordsDraft {
  words: PrintWordDraft[];
}

/**
 * 구조화 출력 계약 (엄격 모드 — `problem-ocr/schema.ts` 와 같은 규약).
 * 모양만 강제하고, 값이 말이 되는지는 `parse.ts` 가 다시 본다.
 */
export const PRINT_WORDS_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['words'],
  properties: {
    words: {
      type: 'array',
      maxItems: PRINT_WORDS_MAX_COUNT,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['word', 'meaning'],
        properties: {
          word: { type: 'string', maxLength: PRINT_WORD_MAX },
          meaning: { type: 'string', maxLength: PRINT_MEANING_MAX },
        },
      },
    },
  },
} as const;
