/**
 * inline `style` 속성 필터 (순수 함수).
 *
 * DOMPurify 는 CSS **속성값**을 검사하지 않는다. `style` 을 통째로 허용하면
 * `position:fixed;inset:0` 전체화면 overlay 나 `background-image:url(...)` 주입으로
 * 저장형 UI 변조가 가능해진다. 그래서 속성 화이트리스트 + 값 검증을 직접 한다.
 *
 * sanitize-html.ts 에서 갈라져 나왔다(파일당 300줄, 그리고 순수 함수라 테스트가 쉽다).
 */

/** text-align 으로 허용할 키워드 */
const TEXT_ALIGN_VALUES = new Set(['left', 'right', 'center', 'justify', 'start', 'end']);

/**
 * 색상 값 검증: #hex / rgb()·rgba() / hsl()·hsla() / 이름있는 색(transparent 등)만 허용.
 * 함수형 값은 숫자·공백·콤마·점·퍼센트만 담을 수 있어 url()·expression() 주입을 차단한다.
 */
const COLOR_VALUE_REGEXP =
  /^(#[0-9a-fA-F]{3,8}|rgba?\([\d\s.,%]+\)|hsla?\([\d\s.,%]+\)|[a-zA-Z]+)$/;

/** 값 어디에 있어도 즉시 탈락시키는 토큰 */
const DANGEROUS_VALUE = /url\(|expression|javascript:|@import|\/\*/i;

/**
 * 단일 CSS 선언(`prop: value`)이 화이트리스트를 통과하는지 판정한다.
 * @param declaration - `prop: value` 한 줄
 * @param allowedProps - 허용할 CSS 속성 이름 집합
 * @returns 통과하면 정규화된 `prop: value`, 아니면 null
 */
export function sanitizeDeclaration(
  declaration: string,
  allowedProps: ReadonlySet<string>,
): string | null {
  const colonIndex = declaration.indexOf(':');
  if (colonIndex === -1) return null;

  const prop = declaration.slice(0, colonIndex).trim().toLowerCase();
  const value = declaration.slice(colonIndex + 1).trim();
  if (!allowedProps.has(prop) || !value) return null;

  if (DANGEROUS_VALUE.test(value)) return null;

  if (prop === 'text-align') {
    return TEXT_ALIGN_VALUES.has(value.toLowerCase()) ? `${prop}: ${value.toLowerCase()}` : null;
  }
  // 나머지 허용 속성은 전부 색상 계열이다
  return COLOR_VALUE_REGEXP.test(value) ? `${prop}: ${value}` : null;
}

/**
 * style 속성 문자열에서 화이트리스트 CSS 속성만 남긴다.
 * @param style - style 속성 원문
 * @param allowedProps - 허용할 CSS 속성 이름 집합
 * @returns 안전한 선언만 남긴 style 문자열 (없으면 빈 문자열)
 */
export function filterStyleAttribute(
  style: string,
  allowedProps: ReadonlySet<string>,
): string {
  return style
    .split(';')
    .map((d) => sanitizeDeclaration(d, allowedProps))
    .filter((d): d is string => d !== null)
    .join('; ');
}
