import type { CSSProperties } from 'react';

/**
 * 디자인 표지가 함께 쓰는 조각.
 */

/**
 * 배율 같은 값을 CSS 변수로 넘긴다(예: `--pbc-title-scale`). 크기 계산은 CSS 의 `calc()` 가 한다.
 * @param vars - 이름이 `--` 로 시작하는 변수와 값
 * @returns 인라인 style
 */
export function cssVars(vars: Record<`--${string}`, number>): CSSProperties {
  return vars as CSSProperties;
}

/** 손으로 적는 빈칸의 길이 — 시안의 90 · 120 · 150px */
export type BlankFieldSize = 'sm' | 'md' | 'lg';

/**
 * '이름 ____' 처럼 이름표 하나와 밑줄 빈칸.
 * @param props.label - 이름표
 * @param props.size - 빈칸 길이
 */
export function BlankField({ label, size }: { label: string; size: BlankFieldSize }) {
  return (
    <span className="pbc-field">
      {label}
      <span className={`pbc-field__line pbc-field__line--${size}`} aria-hidden="true" />
    </span>
  );
}
