/**
 * 카테고리 이름(출판사·대단원·소단원·학교·프린트명) 표기 정규화.
 *
 * ⚠️ `sql/16_migration_normalize_category_names.sql` 의 `normalize_category_name()`
 * 과 **완전히 같은 규칙**이어야 한다. 한쪽만 바꾸면 앱이 저장한 값과 DB 가 병합한
 * 값이 갈라져 카테고리 트리에 같은 이름 노드가 다시 두 개로 보인다.
 *
 * 배경: 트리 그룹화는 문자열 완전 일치(`groupBy(c => c.publisher)`)라, 눈에는
 * 똑같은 `천재(정호웅)` 과 `천재 (정호웅)` 이 서로 다른 폴더로 갈라졌다.
 * DB 의 UNIQUE 제약도 바이트 비교라 이런 변형을 막지 못한다.
 */

/** 전각 괄호 → ASCII 괄호 (한글 IME 에서 흔히 입력된다) */
const FULLWIDTH_PARENS_RE = /[\uFF08\uFF09]/g;
const FULLWIDTH_PAREN_MAP: Record<string, string> = { '\uFF08': '(', '\uFF09': ')' };
/** 폭 없는 문자 — 붙여넣기로 섞여 들어와도 눈에 보이지 않아 원인 파악이 어렵다 */
const ZERO_WIDTH_RE = /[\u200B\uFEFF]/g;
/**
 * 공백류 — JS 의 `\s` 와 같은 집합에서 U+FEFF 만 뺀 것(위에서 이미 제거).
 * `\s` 대신 명시적으로 나열하는 이유: Postgres 의 `\s` 는 ASCII 공백만 잡아서
 * sql/16 이 이 집합을 직접 나열해야 하고, 두 구현을 나란히 두고 대조할 수 있어야 한다.
 */
const SPACE_RE = /[\u0009-\u000D\u0020\u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000]+/g;
/** 괄호 주변 공백 제거 — `천재 (정호웅)`·`천재( 정호웅 )` → `천재(정호웅)` 이 표준 표기다 */
const SPACE_BEFORE_OPEN_RE = / +\(/g;
const SPACE_AFTER_OPEN_RE = /\( +/g;
const SPACE_BEFORE_CLOSE_RE = / +\)/g;

/**
 * 카테고리 이름을 표준 표기로 정규화한다.
 *
 * 폭 없는 문자 제거 → NFC 정규화 → 전각 괄호 치환 → 공백류 축약 → 양끝 trim →
 * 괄호 주변 공백 제거.
 *
 * 폭 없는 문자를 **가장 먼저** 제거하는 순서가 중요하다.
 * - NFC 보다 먼저여야 한다: 분리된 자모 사이에 ZWSP 가 끼면(`ᄀ<ZWSP>ᅡ`) NFC 가
 *   합치지 못하는데, NFC 를 먼저 돌리면 ZWSP 를 뗀 뒤에도 자모가 분리된 채 남아
 *   결과가 NFC 가 아니게 된다 — 다시 정규화하면 값이 또 바뀌어 멱등이 깨진다.
 * - 공백 축약보다 먼저여야 한다: `천재 <ZWSP> (정호웅)` 의 두 공백이 한 칸으로 합쳐진다.
 *
 * 멱등이다(`f(f(x)) === f(x)`). 낱말 사이의 정상적인 공백은 보존한다
 * (`천재 교과서` 는 그대로).
 *
 * @param name - 사용자가 입력했거나 DB 에서 읽은 이름
 * @returns 표준 표기로 정규화된 이름
 */
export function normalizeCategoryName(name: string): string {
  return name
    .replace(ZERO_WIDTH_RE, '')
    .normalize('NFC')
    .replace(FULLWIDTH_PARENS_RE, (ch) => FULLWIDTH_PAREN_MAP[ch])
    .replace(SPACE_RE, ' ')
    .trim()
    .replace(SPACE_BEFORE_OPEN_RE, '(')
    .replace(SPACE_AFTER_OPEN_RE, '(')
    .replace(SPACE_BEFORE_CLOSE_RE, ')');
}
