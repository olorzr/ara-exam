import { OCR_HTML_MAX } from '@/lib/problem-ocr/constants';
import { PRINT_OCR_MAX_WARNINGS, PRINT_PAGES_PER_BATCH } from './constants';

/**
 * 학교 프린트 읽기의 구조화 출력 계약.
 *
 * 규약(구조화 출력 엄격 모드 — `problem-ocr/schema.ts` 와 같다):
 *  - `additionalProperties: false`
 *  - **모든 속성을 `required` 에** 넣는다(엄격 모드는 속성 누락을 거부한다).
 *  - 길이·개수 상한을 전부 건다(모델이 폭주해도 우리가 감당할 크기로 돌아온다).
 *
 * 기출과 달리 **쪽별 HTML 하나**만 받는다 — 지문·문항으로 가르지 않는다.
 * 그래도 쪽으로 나눠 받는 이유가 둘이다: ① 빠진 쪽을 우리가 셈으로 알아낸다,
 * ② 이어 붙이는 **순서를 우리가 정한다**(모델이 낸 순서를 믿지 않는다).
 */

/** 쪽 하나의 읽기 결과 */
export interface PrintPageDraft {
  page: number;
  html: string;
  /**
   * 모델이 아예 안 낸 쪽이라 **파서가 자리만 만든 것**인가.
   * 그 쪽은 파서가 이미 경고했으므로 뒤에서 또 경고하면 같은 말이 두 번 나간다.
   */
  missing?: boolean;
}

export interface PrintOcrDraft {
  pages: PrintPageDraft[];
  /** 확인이 필요한 것 (흐려서 못 읽은 자리·그림 등). 가리킬 카드가 없어 문자열뿐이다 */
  warnings: string[];
}

export const PRINT_OCR_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['pages', 'warnings'],
  properties: {
    pages: {
      type: 'array',
      // 한 쪽을 두 번 낼 수 있어 여유를 준다 — 중복은 파서가 거른다
      maxItems: PRINT_PAGES_PER_BATCH * 2,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['page', 'html'],
        properties: {
          page: { type: 'integer', minimum: 1 },
          html: { type: 'string', maxLength: OCR_HTML_MAX },
        },
      },
    },
    warnings: {
      type: 'array',
      maxItems: PRINT_OCR_MAX_WARNINGS,
      items: { type: 'string', maxLength: 300 },
    },
  },
} as const;
