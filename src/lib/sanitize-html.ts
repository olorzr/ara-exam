import DOMPurify from 'isomorphic-dompurify';
import { withProfile, type SanitizeProfile } from './sanitize-profile';

/**
 * concept_sheets.editor_html 전용 DOMPurify 화이트리스트.
 * TipTap StarterKit + Underline + TextAlign + Table + ConceptMark 이
 * 실제로 생성하는 태그/속성만 허용한다.
 * 새 TipTap 확장을 추가하면 이 목록도 같이 갱신해야 한다.
 *
 * ⚠️ style 필터·data-* 검증은 `sanitize-profile.ts` 의 **훅 하나**가 담당한다.
 *    여기서 addHook 을 다시 부르면 문제 은행 정화(sanitize-problem.ts)와 규칙이 섞인다.
 */
const ALLOWED_TAGS = [
  'h3', 'h4',
  'p', 'br', 'hr',
  'strong', 'em', 'u', 'code', 'pre',
  'ul', 'ol', 'li', 'blockquote',
  'table', 'thead', 'tbody', 'tr', 'th', 'td',
  'mark',
  'span',
];

// class 는 허용하지 않는다. TipTap 의 getHTML() 은 이 확장 셋에서 class 를
// 직렬화하지 않으므로 정당한 마크업에는 영향이 없고, 허용하면 Tailwind/앱 CSS
// 유틸리티(예: fixed inset-0 z-50)를 악용한 전체화면 overlay·숨김·클릭 유도
// 같은 저장형 UI 주입이 가능해진다. 필요한 data-* 는 아래에 명시 화이트리스트한다.
const ALLOWED_ATTR = [
  'colspan', 'rowspan', 'colwidth',
  'data-concept',
  'data-colwidth',
  'data-bg-color',
  'data-bordertop', 'data-borderbottom', 'data-borderleft', 'data-borderright',
  'style',
];

export const FORBID_TAGS = [
  'script', 'iframe', 'object', 'embed', 'form',
  'input', 'button', 'link', 'meta', 'base', 'style', 'svg', 'math',
];

export const FORBID_ATTR = [
  'srcdoc', 'formaction', 'xlink:href', 'action',
  'onload', 'onerror', 'onclick', 'onmouseover',
  'onfocus', 'onblur', 'onchange', 'onsubmit',
];

/** javascript: · data: 등 위험 스킴 차단, http/https/mailto/tel 만 허용 */
export const SAFE_URI_REGEXP = /^(?:(?:https?|mailto|tel):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i;

/**
 * inline style 로 허용할 CSS 속성 화이트리스트.
 * - text-align: TextAlign 확장(h3/h4/p)
 * - background-color / border-*-color: CustomTableCell 의 셀 배경·테두리 색
 * 이 외의 속성(position, inset, display, width, transform 등)은 전부 제거한다.
 */
const ALLOWED_CSS_PROPS = new Set([
  'text-align',
  'background-color',
  'border-top-color',
  'border-bottom-color',
  'border-left-color',
  'border-right-color',
]);

/** 개념지가 허용하는 data-* 와 값 규칙 */
const CONCEPT_DATA_ATTRS = new Map<string, (value: string) => boolean>([
  // ConceptMark 는 값 없이 존재 자체가 표식이다
  ['data-concept', () => true],
  ['data-colwidth', (v) => /^[\d,\s]*$/.test(v)],
  ['data-bg-color', (v) => v.length <= 32],
  ['data-bordertop', (v) => v.length <= 32],
  ['data-borderbottom', (v) => v.length <= 32],
  ['data-borderleft', (v) => v.length <= 32],
  ['data-borderright', (v) => v.length <= 32],
]);

const CONCEPT_PROFILE: SanitizeProfile = {
  allowedCss: ALLOWED_CSS_PROPS,
  allowedDataAttrs: CONCEPT_DATA_ATTRS,
};

const CONCEPT_SHEET_SANITIZE_CONFIG = {
  ALLOWED_TAGS,
  ALLOWED_ATTR,
  // 모든 data-* 를 허용하지 않는다. 정당한 data 속성(data-concept, data-bg-color,
  // data-border*, data-colwidth)은 ALLOWED_ATTR 에 명시돼 있어 그대로 통과하고,
  // 그 밖의 임의 data-* 주입은 차단한다.
  ALLOW_DATA_ATTR: false,
  ALLOWED_URI_REGEXP: SAFE_URI_REGEXP,
  FORBID_TAGS,
  FORBID_ATTR,
  KEEP_CONTENT: true,
  RETURN_TRUSTED_TYPE: false,
};

/**
 * 개념지 HTML 을 안전하게 정화한다.
 * 저장 경로(handleSave), 로드 경로(useConceptSheetEditor), 렌더 변환 경로(exam-transform)
 * 전부에서 호출하여 다층 방어를 구성한다.
 * @param dirty - 신뢰할 수 없는 HTML 문자열
 * @returns `<script>`, `on*` 핸들러, `javascript:` URL, 화이트리스트 밖 CSS 가
 *          제거된 HTML
 */
export function sanitizeConceptHTML(dirty: string): string {
  if (!dirty) return '';
  return withProfile(CONCEPT_PROFILE, () =>
    DOMPurify.sanitize(dirty, CONCEPT_SHEET_SANITIZE_CONFIG),
  );
}
