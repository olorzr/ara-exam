import DOMPurify from 'isomorphic-dompurify';
import { filterStyleAttribute } from './sanitize-css';

/**
 * DOMPurify 훅의 **단일 등록 지점**.
 *
 * ⚠️ `isomorphic-dompurify` 는 인스턴스를 하나만 export 한다. 훅도 전역이라,
 *    다른 모듈에서 `addHook` 을 한 번 더 부르면 **양쪽 sanitize 호출 모두에서 두 훅이
 *    발화한다**(개념지 정화에 문제지 규칙이 섞이고 그 반대도 된다).
 *    그래서 훅은 여기 한 번만 걸고, 문서 종류별 차이는 "활성 프로필"로 바꾼다.
 *
 * 프로필 전환이 안전한 이유: `DOMPurify.sanitize` 는 동기 함수라 호출이 겹치지 않는다.
 */

/** 문서 종류별로 달라지는 부분 */
export interface SanitizeProfile {
  /** inline style 로 허용할 CSS 속성 */
  allowedCss: ReadonlySet<string>;
  /** 허용할 data-* 속성과 그 값 검증기 */
  allowedDataAttrs: ReadonlyMap<string, (value: string) => boolean>;
}

/** 어떤 프로필도 지정되지 않았을 때(있어서는 안 되는 경로) 쓰는 가장 좁은 규칙 */
const EMPTY_PROFILE: SanitizeProfile = {
  allowedCss: new Set(),
  allowedDataAttrs: new Map(),
};

let activeProfile: SanitizeProfile = EMPTY_PROFILE;

DOMPurify.addHook('uponSanitizeAttribute', (_node, data) => {
  if (data.attrName === 'style') {
    const filtered = filterStyleAttribute(data.attrValue ?? '', activeProfile.allowedCss);
    if (filtered) data.attrValue = filtered;
    else data.keepAttr = false;
    return;
  }

  // ALLOW_DATA_ATTR:false + ALLOWED_ATTR 화이트리스트가 1차 방어지만,
  // **값**은 DOMPurify 가 안 본다. 프로필별 검증기로 한 번 더 좁힌다.
  if (data.attrName.startsWith('data-')) {
    const check = activeProfile.allowedDataAttrs.get(data.attrName);
    if (!check || !check(data.attrValue ?? '')) data.keepAttr = false;
  }
});

/**
 * 지정한 프로필로 정화를 수행한다.
 *
 * 프로필을 `finally` 에서 되돌리는 것이 중요하다 — 예외가 나도 다음 호출이
 * 남의 규칙을 물려받으면 안 된다.
 * @param profile - 이번 호출에 적용할 프로필
 * @param run - 실제 `DOMPurify.sanitize` 호출
 * @returns 정화된 HTML
 */
export function withProfile(profile: SanitizeProfile, run: () => string): string {
  activeProfile = profile;
  try {
    return run();
  } finally {
    activeProfile = EMPTY_PROFILE;
  }
}
