import DOMPurify from 'isomorphic-dompurify';

/**
 * concept_sheets.editor_html 전용 DOMPurify 화이트리스트.
 * TipTap StarterKit + Underline + TextAlign + Table + ConceptMark 이
 * 실제로 생성하는 태그/속성만 허용한다.
 * 새 TipTap 확장을 추가하면 이 목록도 같이 갱신해야 한다.
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

const FORBID_TAGS = [
  'script', 'iframe', 'object', 'embed', 'form',
  'input', 'button', 'link', 'meta', 'base', 'style', 'svg', 'math',
];

const FORBID_ATTR = [
  'srcdoc', 'formaction', 'xlink:href', 'action',
  'onload', 'onerror', 'onclick', 'onmouseover',
  'onfocus', 'onblur', 'onchange', 'onsubmit',
];

/** javascript: · data: 등 위험 스킴 차단, http/https/mailto/tel 만 허용 */
const SAFE_URI_REGEXP = /^(?:(?:https?|mailto|tel):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i;

/**
 * inline style 로 허용할 CSS 속성 화이트리스트.
 * - text-align: TextAlign 확장(h3/h4/p)
 * - background-color / border-*-color: CustomTableCell 의 셀 배경·테두리 색
 * 이 외의 속성(position, inset, display, width, transform 등)은 전부 제거한다.
 * 화이트리스트 밖 속성을 허용하면 position:fixed;inset:0 같은 전체화면 overlay 나
 * background-image:url(...) 주입으로 저장형 UI 변조가 가능해진다.
 */
const ALLOWED_CSS_PROPS = new Set([
  'text-align',
  'background-color',
  'border-top-color',
  'border-bottom-color',
  'border-left-color',
  'border-right-color',
]);

/** text-align 으로 허용할 키워드 */
const TEXT_ALIGN_VALUES = new Set(['left', 'right', 'center', 'justify', 'start', 'end']);

/**
 * 색상 값 검증: #hex / rgb()·rgba() / hsl()·hsla() / 이름있는 색(transparent 등)만 허용.
 * 함수형 값은 숫자·공백·콤마·점·퍼센트만 담을 수 있어 url()·expression() 주입을 차단한다.
 */
const COLOR_VALUE_REGEXP =
  /^(#[0-9a-fA-F]{3,8}|rgba?\([\d\s.,%]+\)|hsla?\([\d\s.,%]+\)|[a-zA-Z]+)$/;

/**
 * 단일 CSS 선언(`prop: value`)이 화이트리스트를 통과하는지 판정한다.
 * @returns 통과하면 정규화된 `prop: value`, 아니면 null
 */
function sanitizeDeclaration(declaration: string): string | null {
  const colonIndex = declaration.indexOf(':');
  if (colonIndex === -1) return null;

  const prop = declaration.slice(0, colonIndex).trim().toLowerCase();
  const value = declaration.slice(colonIndex + 1).trim();
  if (!ALLOWED_CSS_PROPS.has(prop) || !value) return null;

  // url() · expression() · javascript: · CSS 주석 등 알려진 위험 토큰을 선차단
  if (/url\(|expression|javascript:|@import|\/\*/i.test(value)) return null;

  if (prop === 'text-align') {
    return TEXT_ALIGN_VALUES.has(value.toLowerCase()) ? `${prop}: ${value.toLowerCase()}` : null;
  }
  // 나머지는 모두 색상 속성
  return COLOR_VALUE_REGEXP.test(value) ? `${prop}: ${value}` : null;
}

/**
 * style 속성 문자열에서 화이트리스트 CSS 속성만 남긴다.
 * @returns 안전한 선언만 남긴 style 문자열(없으면 빈 문자열)
 */
function filterStyleAttribute(style: string): string {
  return style
    .split(';')
    .map((d) => sanitizeDeclaration(d))
    .filter((d): d is string => d !== null)
    .join('; ');
}

// DOMPurify 가 style 속성을 처리할 때 화이트리스트 밖 CSS 를 제거하는 훅.
// isomorphic-dompurify 는 단일 인스턴스를 export 하며, 앱 내 DOMPurify 사용처는
// 이 모듈뿐이라 모듈 로드 시 1회 등록해도 다른 sanitize 호출에 영향을 주지 않는다.
DOMPurify.addHook('uponSanitizeAttribute', (_node, data) => {
  if (data.attrName !== 'style') return;
  const filtered = filterStyleAttribute(data.attrValue ?? '');
  if (filtered) {
    data.attrValue = filtered;
  } else {
    data.keepAttr = false;
  }
});

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
 * 저장 경로(handleSave) 와 렌더 변환 경로(exam-transform) 양쪽에서 호출하여
 * 다층 방어를 구성한다.
 * @param dirty - 신뢰할 수 없는 HTML 문자열
 * @returns `<script>`, `on*` 핸들러, `javascript:` URL, 화이트리스트 밖 CSS 가
 *          제거된 HTML
 */
export function sanitizeConceptHTML(dirty: string): string {
  if (!dirty) return '';
  return DOMPurify.sanitize(dirty, CONCEPT_SHEET_SANITIZE_CONFIG);
}
