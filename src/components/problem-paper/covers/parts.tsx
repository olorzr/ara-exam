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

/**
 * '학생 ____' 처럼 이름표 하나와 밑줄 빈칸. 빈칸 길이는 시안마다 다르다(120 · 150 · 200 · 230px).
 * @param props.label - 이름표
 * @param props.width - 빈칸 길이(px)
 * @param props.className - 디자인별 모양
 */
export function BlankField({ label, width, className = '' }: { label: string; width: number; className?: string }) {
  return (
    <span className={`pbc-field ${className}`.trim()}>
      {label}
      <span className="pbc-field__line" style={{ width }} aria-hidden="true" />
    </span>
  );
}
