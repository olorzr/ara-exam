import { splitByFigurePlaceholders } from './figure-placeholders';

/**
 * 본문의 **그림 자리표시자를 실제 이미지로 바꾼다** (순수 함수, 문자열 치환).
 *
 * ⚠️ HTML 을 자리표시자에서 **잘라 나누면 안 된다.** 그림은 〈보기〉 상자나 표 칸 **안**에
 *    있을 때가 많은데(국어 시험지에서 아주 흔하다), 거기서 문자열을 자르면 여는 태그와
 *    닫는 태그가 갈려 브라우저가 상자를 먼저 닫아 버린다 — 그림과 뒷글이 **상자 밖으로
 *    튀어나온다**(코덱스 리뷰). 구조를 건드리지 않고 그 자리의 태그만 바꾼다.
 *
 * ⚠️ **정화 뒤에 부른다.** 넣는 `<img>` 는 우리가 만든 것이고(서명 URL 은 Storage 가 준
 *    값이다) 저장되지 않는다 — 저장 HTML 에 `<img>` 를 금지한 결정은 그대로다.
 *    이 결과를 다시 정화하면 그림이 통째로 사라지므로 **순서를 바꾸지 말 것.**
 */

/** 속성 자리에 넣기 전 최소 escape */
function escapeAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * 자리표시자를 서명 URL 이미지로 바꾼 HTML.
 * @param html - **정화까지 끝난** 본문
 * @param paths - 그림 경로들 (1번이 index 0)
 * @param urls - 경로 → 서명 URL
 * @returns 이미지가 제자리에 들어간 HTML
 */
export function renderFiguresInHtml(
  html: string,
  paths: readonly string[],
  urls: ReadonlyMap<string, string>,
): string {
  return splitByFigurePlaceholders(html).map((chunk) => {
    if (chunk.kind === 'html') return chunk.html;
    const path = paths[chunk.index - 1];
    const src = path ? urls.get(path) : undefined;
    const alt = `자료 ${chunk.index}`;
    if (!src) {
      // ⚠️ 조용히 비우면 안 된다 — 그림이 원래 없었는지 못 불러왔는지 알 수 없게 된다
      return `<span class="pb-figure-missing">${alt} 이미지를 불러오지 못했어요</span>`;
    }
    return `<img class="pb-figure-img" src="${escapeAttr(src)}" alt="${escapeAttr(alt)}">`;
  }).join('');
}

/**
 * 이 조각이 **그림 하나뿐**인가 (인쇄에서 따로 떼어 낼 블록인지 판단한다).
 * @param html - 최상위 조각 하나
 * @returns 그림 번호. 글이 섞여 있으면 null
 */
export function soleFigureIndex(html: string): number | null {
  const chunks = splitByFigurePlaceholders(html);
  if (chunks.length !== 1) return null;
  return chunks[0].kind === 'figure' ? chunks[0].index : null;
}

/**
 * 본문에 **자리를 못 잡은** 그림들 (1-based 번호와 경로).
 *
 * 검수에서 편집기의 칩만 지우거나, 옛 행처럼 자리표시자가 없을 때 생긴다.
 * 화면·인쇄 **양쪽 다** 본문 끝에 붙여 그린다 — 한쪽만 하면 화면에서 본 그림이
 * 인쇄물에서만 사라진다.
 * @param html - 본문
 * @param paths - 그림 경로들
 * @returns 붙일 그림들
 */
export function unplacedFigures(
  html: string,
  paths: readonly string[],
): { index: number; path: string }[] {
  const placed = new Set(
    splitByFigurePlaceholders(html)
      .filter((c) => c.kind === 'figure')
      .map((c) => (c as { index: number }).index),
  );
  return paths
    .map((path, i) => ({ index: i + 1, path }))
    .filter(({ index, path }) => Boolean(path) && !placed.has(index));
}
