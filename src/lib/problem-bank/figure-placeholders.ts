/**
 * 본문 안 **그림 자리표시자** 규약 (순수 함수).
 *
 * 그림은 발문·지문의 **원래 있던 자리**에 들어가야 한다. 표 위에 있던 그래프가 선지
 * 아래로 밀려 나오면 문항이 안 읽힌다. 그런데 저장하는 HTML 에는 `<img>` 를 넣을 수 없다 —
 * 그림 파일은 비공개 버킷에 있어 **만료되는 서명 URL** 로만 열 수 있고, 만료된 URL 을
 * 본문에 굳혀 두면 인쇄물에서 그림이 빈칸이 된다(sanitize-problem.ts 의 결정).
 *
 * 그래서 본문에는 **URL 없는 빈 자리**만 둔다:
 *
 * ```html
 * <p>다음 그래프를 보고 물음에 답하시오.</p>
 * <figure data-figure="1"></figure>
 * <p>…</p>
 * ```
 *
 * 숫자는 `figure_paths` 배열의 **1-based 순번**이다. 그리는 쪽(화면·인쇄)이 이 자리에서
 * HTML 을 갈라 그 사이에 서명 URL 로 이미지를 끼운다.
 */

/** 한 항목에 달 수 있는 그림 수. 한 자리 수라야 정화 규칙이 단순하다 */
export const MAX_FIGURES = 9;

/**
 * 자리표시자 한 개.
 *
 * ⚠️ **다른 속성이 섞여도 알아봐야 한다.** 편집기(TipTap)는 `class` 를 함께 내고, 그 HTML 이
 *    정화를 거치기 **전에** 지역 state 로 들어온다. 속성 순서까지 따지는 규칙을 쓰면
 *    그때 자리표시자를 못 알아봐, 그림을 뺄 때 경로만 빠지고 본문 표시는 그대로 남는다 —
 *    그러면 남은 그림이 엉뚱한 자리에 그려진다(코덱스 리뷰).
 */
const FIGURE_RE = /<figure\b[^>]*\bdata-figure\s*=\s*["']?([1-9])["']?[^>]*>(?:\s*<\/figure>)?/gi;

/** 본문을 갈랐을 때의 조각 */
export type FigureChunk =
  | { kind: 'html'; html: string }
  | { kind: 'figure'; index: number };

/**
 * 자리표시자마다 본문을 가른다 — 그리는 쪽이 그 사이에 이미지를 끼운다.
 * @param html - 본문 HTML
 * @returns 순서대로의 조각 (빈 HTML 조각은 빠진다)
 */
export function splitByFigurePlaceholders(html: string): FigureChunk[] {
  const out: FigureChunk[] = [];
  let last = 0;
  FIGURE_RE.lastIndex = 0;

  for (let m = FIGURE_RE.exec(html); m !== null; m = FIGURE_RE.exec(html)) {
    const before = html.slice(last, m.index);
    if (before.trim()) out.push({ kind: 'html', html: before });
    out.push({ kind: 'figure', index: Number(m[1]) });
    last = m.index + m[0].length;
  }

  const rest = html.slice(last);
  if (rest.trim()) out.push({ kind: 'html', html: rest });
  return out;
}

/**
 * 본문에 적힌 그림 순번들 (나온 순서대로).
 * @param html - 본문 HTML
 * @returns 순번 배열 (중복이 있으면 그대로 담는다)
 */
export function figureNumbersIn(html: string): number[] {
  return splitByFigurePlaceholders(html)
    .filter((c): c is { kind: 'figure'; index: number } => c.kind === 'figure')
    .map((c) => c.index);
}

/** 자리표시자 한 개를 만든다 */
export function figurePlaceholder(index: number): string {
  return `<figure data-figure="${index}"></figure>`;
}

/**
 * 자리표시자를 **실제 그림 수에 맞춘다.**
 *
 * 모델이 그림 위치는 적어 놓고 좌표를 빠뜨리거나(또는 그 반대) 하는 일이 흔하다.
 * 어긋난 채 저장하면 그리는 쪽이 없는 그림을 찾다가 "불러오지 못했어요" 를 띄우거나,
 * 잘라 둔 그림이 아무 데도 안 나온다.
 *  - 없는 순번·중복은 **지운다**.
 *  - 자리표시자가 없는 그림은 **끝에 붙인다**(자리를 모르는 것보다 있는 편이 낫다).
 * @param html - 본문 HTML
 * @param count - 실제 그림 수
 * @returns 맞춰진 HTML
 */
export function reconcileFigurePlaceholders(html: string, count: number): string {
  const seen = new Set<number>();
  const kept = splitByFigurePlaceholders(html).map((chunk) => {
    if (chunk.kind === 'html') return chunk.html;
    if (chunk.index > count || seen.has(chunk.index)) return '';
    seen.add(chunk.index);
    return figurePlaceholder(chunk.index);
  }).join('');

  const missing: string[] = [];
  for (let n = 1; n <= Math.min(count, MAX_FIGURES); n += 1) {
    if (!seen.has(n)) missing.push(figurePlaceholder(n));
  }
  return kept + missing.join('');
}

/**
 * 자리표시자 번호를 **옮겨 붙인 표대로** 바꾼다.
 *
 * ⚠️ 그림 목록에서 몇 개를 버리면 뒤엣것들이 앞으로 당겨진다. 본문을 그대로 두면
 *    1번 자리에 원래 2번 그림이 그려진다 — **버린 자리를 그냥 지우는 것보다 나쁘다**
 *    (없는 것은 보이지만 딴 그림은 안 보인다).
 * @param html - 본문 HTML
 * @param mapping - 옛 번호(1-based) → 새 번호. `null` 이면 그 자리표시자를 지운다
 * @returns 번호가 옮겨진 HTML
 */
export function remapFigurePlaceholders(
  html: string,
  mapping: readonly (number | null)[],
): string {
  return splitByFigurePlaceholders(html).map((chunk) => {
    if (chunk.kind === 'html') return chunk.html;
    const next = mapping[chunk.index - 1];
    return next ? figurePlaceholder(next) : '';
  }).join('');
}

/**
 * 자리표시자 번호를 한꺼번에 민다 (지문 조각을 이어 붙일 때).
 *
 * 쪽을 넘어가는 지문은 조각마다 그림이 따로 있다. 조각을 뒤에 붙이면서 번호를 안 밀면
 * 뒤 조각의 '1번 그림' 이 앞 조각의 그림을 가리킨다.
 * @param html - 본문 HTML
 * @param offset - 더할 값 (앞서 담은 그림 수)
 * @returns 번호가 밀린 HTML. 상한을 넘는 것은 지운다
 */
export function shiftFigurePlaceholders(html: string, offset: number): string {
  if (offset <= 0) return html;
  return splitByFigurePlaceholders(html).map((chunk) => {
    if (chunk.kind === 'html') return chunk.html;
    const next = chunk.index + offset;
    return next <= MAX_FIGURES ? figurePlaceholder(next) : '';
  }).join('');
}

/**
 * 그림 하나를 뺀다 — 자리표시자와 경로를 **함께** 고치고 뒷번호를 당긴다.
 *
 * ⚠️ 둘을 따로 고치면 번호가 어긋나 남은 그림이 엉뚱한 자리에 그려진다.
 * @param html - 본문 HTML
 * @param paths - 그림 경로들 (1번이 index 0)
 * @param index - 뺄 그림의 1-based 순번
 * @returns 고친 본문과 경로
 */
export function removeFigureAt(
  html: string,
  paths: readonly string[],
  index: number,
): { html: string; paths: string[] } {
  const nextPaths = paths.filter((_, i) => i !== index - 1);
  const nextHtml = splitByFigurePlaceholders(html).map((chunk) => {
    if (chunk.kind === 'html') return chunk.html;
    if (chunk.index === index) return '';
    return figurePlaceholder(chunk.index > index ? chunk.index - 1 : chunk.index);
  }).join('');
  return { html: nextHtml, paths: nextPaths };
}
