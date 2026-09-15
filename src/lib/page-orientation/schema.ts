import { ORIENTATION_PAGES_PER_CALL } from './constants';

/** 쪽 하나의 방향 판정 */
export interface OrientationJudgement {
  /** 바로 세우려면 시계 방향으로 돌릴 각도 */
  rotation: 0 | 90 | 180 | 270;
  /** 글자가 있는 쪽인가 (빈 뒷면이면 false) */
  hasText: boolean;
}

/**
 * 구조화 출력 계약 (엄격 모드).
 * `image` 는 이번에 보낸 이미지의 **순번**(1부터)이다 — 쪽 번호가 아니다.
 * 호출부가 순번을 쪽 번호로 되돌리므로 모델에게 쪽 번호를 외우게 하지 않는다.
 */
export const ORIENTATION_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['pages'],
  properties: {
    pages: {
      type: 'array',
      maxItems: ORIENTATION_PAGES_PER_CALL,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['image', 'rotation', 'hasText'],
        properties: {
          image: { type: 'integer', minimum: 1, maximum: ORIENTATION_PAGES_PER_CALL },
          rotation: { type: 'integer', enum: [0, 90, 180, 270] },
          hasText: { type: 'boolean' },
        },
      },
    },
  },
} as const;
