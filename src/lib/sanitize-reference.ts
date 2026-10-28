import DOMPurify from 'isomorphic-dompurify';
import { FORBID_ATTR, FORBID_TAGS, SAFE_URI_REGEXP } from './sanitize-html';
import {
  PROBLEM_ALLOWED_ATTR, PROBLEM_ALLOWED_CSS_PROPS, PROBLEM_ALLOWED_TAGS, PROBLEM_DATA_ATTRS,
} from './sanitize-problem';
import { withProfile, type SanitizeProfile } from './sanitize-profile';
import {
  REFERENCE_TABLE_LAYOUTS, isCalloutLabel, isCalloutTone, isFlowDirection,
} from './workbook-markup';

/**
 * 작품 전문 · 개념 본문(`exam.reference_texts`, format html) 전용 화이트리스트 — **참고자료 프로필**.
 *
 * 문항 프로필(`sanitizeProblemHTML`)의 **엄격한 상위 집합**이다: 〈보기〉 상자·(가) 구역·칸선 없는 나란히 표·
 * 그림 자리표시자는 그대로 받고, 평가문제집 쪽처럼 보이게 하는 표시를 더 받는다(workbook-markup.ts).
 *   - 태그 `mark`(핵심어·채운 빈칸) · `small`(어휘의 한자 풀이)
 *   - `blockquote` 의 `data-callout`(말머리, 24자) · `data-tone`(색 갈래)
 *   - `ul` 의 `data-flow`(화살표 도식 down·right)
 *   - `table` 의 `data-layout` 에 `gloss`(원문·여백 해설) · `vocab`(낱말·풀이)
 *
 * ⚠️ 문항 프로필을 넓히지 않고 따로 두는 이유: 기출 지문·발문이 그 규칙으로 돌고, 적재 도구가 그 정화기와의
 *    왕복으로 화면에서 사라질 서식을 막는다. 문항에 말머리 상자가 들어오면 인쇄가 원본과 달라진다.
 * ⚠️ 훅은 `sanitize-profile.ts` 의 **하나**뿐이다 — 여기서 `addHook` 을 다시 걸면 모든 정화에 두 훅이 발화한다.
 */

const REFERENCE_ALLOWED_TAGS = [...PROBLEM_ALLOWED_TAGS, 'mark', 'small'];

const REFERENCE_ALLOWED_ATTR = [...PROBLEM_ALLOWED_ATTR, 'data-callout', 'data-tone', 'data-flow'];

const REFERENCE_DATA_ATTRS = new Map(PROBLEM_DATA_ATTRS);
REFERENCE_DATA_ATTRS.set('data-layout', (value, tagName) => tagName === 'table' && REFERENCE_TABLE_LAYOUTS.has(value));
REFERENCE_DATA_ATTRS.set('data-callout', (value, tagName) => tagName === 'blockquote' && isCalloutLabel(value));
REFERENCE_DATA_ATTRS.set('data-tone', (value, tagName) => tagName === 'blockquote' && isCalloutTone(value));
REFERENCE_DATA_ATTRS.set('data-flow', (value, tagName) => tagName === 'ul' && isFlowDirection(value));

const REFERENCE_PROFILE: SanitizeProfile = {
  allowedCss: PROBLEM_ALLOWED_CSS_PROPS,
  allowedDataAttrs: REFERENCE_DATA_ATTRS,
};

const REFERENCE_SANITIZE_CONFIG = {
  ALLOWED_TAGS: REFERENCE_ALLOWED_TAGS,
  ALLOWED_ATTR: REFERENCE_ALLOWED_ATTR,
  ALLOW_DATA_ATTR: false,
  ALLOWED_URI_REGEXP: SAFE_URI_REGEXP,
  FORBID_TAGS,
  FORBID_ATTR,
  KEEP_CONTENT: true,
  RETURN_TRUSTED_TYPE: false,
};

/**
 * 작품 전문 · 개념 본문을 정화한다 — 저장할 때 · 읽을 때 · 견줄 때 · 그릴 때 모두 이 함수다.
 * @param dirty - 신뢰할 수 없는 HTML (편집기 저장값 · DB 로드값 · 적재 spec)
 * @returns 참고자료 화이트리스트 밖 태그·속성·CSS 가 제거된 HTML
 */
export function sanitizeReferenceHTML(dirty: string): string {
  if (!dirty) return '';
  return withProfile(REFERENCE_PROFILE, () => DOMPurify.sanitize(dirty, REFERENCE_SANITIZE_CONFIG));
}
