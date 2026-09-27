/**
 * PostgREST 배열 연산자(`cs`·`cd`·`ov`)에 넘길 Postgres 배열 리터럴을 만든다.
 *
 * ⚠️ postgrest-js(2.98) 의 `.contains()`·`.overlaps()`·`.containedBy()` 에 **배열을 그대로**
 *    넘기면 원소를 따옴표 없이 쉼표로 이어 붙인다(`cs.{a,b}`). 그래서 `'소녀, 두드리다'` 는
 *    두 원소(`소녀`·`두드리다`)로 읽혀 "둘 다 가진 행" 을 찾게 되고 **0건**이 된다
 *    (2026-09-27 — 작품 트리에는 29건이 뜨는데 눌러도 하나도 안 보였다). 문자열을 넘기면
 *    `cs.${value}` 로 그대로 실리므로, 여기서 원소마다 큰따옴표를 감싸 만든 리터럴을 넘긴다.
 *
 * Postgres 배열 입력 규칙대로 원소 안의 `\` 와 `"` 는 `\` 로 이스케이프한다. 따옴표 안에서는
 * 쉼표·중괄호·앞뒤 공백이 전부 글자 그대로 보존된다.
 *
 * @param values - 원소 문자열들
 * @returns `{"a","b"}` 꼴의 리터럴 (빈 배열은 `{}`)
 */
export function pgArrayLiteral(values: readonly string[]): string {
  return `{${values.map(quotePgArrayElement).join(',')}}`;
}

/** 원소 하나를 큰따옴표로 감싼다 — `\` 먼저, 그다음 `"` (순서를 바꾸면 이스케이프가 두 번 된다) */
function quotePgArrayElement(value: string): string {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}
