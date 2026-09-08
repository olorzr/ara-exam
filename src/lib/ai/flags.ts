// AI 기능 게이트 — **서버 전용**.
//
// `NEXT_PUBLIC_` 접두사를 붙이지 않는다: 붙이면 값이 번들에 박혀 브라우저에서 읽히고,
// 배포 없이 끄는 킬스위치 역할을 못 한다. 클라이언트는 `/api/ai/status` 로 물어본다.
//
// 이 앱에는 역할 개념이 없다(@araeducation.co.kr 로그인 사용자는 전부 동등).
// 그래서 게이트는 "환경변수 하나 + 로그인 도메인" 두 겹뿐이다.

import type { AiFeature } from './types';

/** 켜짐으로 인정하는 값. 오타('yes', 'on')를 켜짐으로 오인하지 않는다. */
const TRUTHY = new Set(['1', 'true']);

/**
 * 문제 은행 OCR 이 켜져 있는지. 기본값은 **꺼짐**이다.
 * 미설정 배포에서 기능이 저절로 열리지 않게 하려는 의도다.
 * @returns 환경변수 `AI_OCR_BETA` 가 '1' 또는 'true' 면 true
 */
export function isAiOcrEnabled(): boolean {
  return TRUTHY.has((process.env.AI_OCR_BETA ?? '').trim().toLowerCase());
}

/**
 * 기능별 활성 여부. 지금은 기능이 하나뿐이라 마스터 스위치와 같다.
 * @param feature - 확인할 기능
 * @returns 사용 가능하면 true
 */
export function isFeatureEnabled(feature: AiFeature): boolean {
  switch (feature) {
    case 'problem_ocr':
      return isAiOcrEnabled();
    default:
      return false;
  }
}
