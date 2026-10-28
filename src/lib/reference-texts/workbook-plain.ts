import type { ReferenceTextFormat } from '@/types/reference-text';
import { htmlToText } from './body-format';

/**
 * 문제집 서식(workbook-markup.ts)에서 **원문만** 남기기 — 순수 문자열 함수(DOM 없음).
 *
 * 작품 전문은 평가문제집 쪽처럼 본문 옆 여백 해설 · 어휘 풀이 · 핵심 포인트 상자를 함께 담는다(2026-10-28 원장 결정).
 * 그런데 문제 만들기(O,X·단답형)는 작품 본문을 **원문**으로 읽어 근거를 찾는다 — 해설이 섞이면 AI 가 출판사의 풀이를
 * 작품의 글로 알고 문항을 낸다. 그래서 참고자료로 보낼 때는 이 함수를 거친다(`quiz-references/bodies.ts`).
 * 브라우저·vitest·헤드리스 적재 도구(appfns.cjs 묶음)가 같은 코드를 돌리도록 DOM 을 쓰지 않는다.
 *
 * 걷는 것: 말머리 상자(`blockquote[data-callout|data-tone]`) 통째, 어휘 풀이 표(`table[data-layout="vocab"]`) 통째,
 * 화살표 도식(`ul[data-flow]`) 통째. 여백 해설 표(`table[data-layout="gloss"]`)는 줄마다 **첫째 칸(원문)만** 꺼낸다.
 * `mark`·`small` 은 표시만 벗긴다(글자는 원문이다).
 */

/** 원문 블록으로 이미 감싸인 칸 속 — 아니면 `<p>` 로 감싼다 */
const BLOCK_START = /^\s*<(p|h3|h4|ul|ol|blockquote|table|figure)\b/i;

/**
 * 여는 태그 자리에서 짝이 맞는 닫는 태그의 **끝** 자리를 찾는다 — 같은 태그가 안에 겹쳐도(상자 안 〈보기〉 상자) 깊이를 센다.
 * @param html - HTML
 * @param tag - 태그 이름(소문자)
 * @param from - 여는 태그가 시작하는 자리
 * @returns 닫는 태그 바로 뒤 자리. 짝이 없으면 글 끝
 */
function matchingEnd(html: string, tag: string, from: number): number {
  const re = new RegExp(`<(/?)${tag}\\b[^>]*>`, 'gi');
  re.lastIndex = from;
  let depth = 0;
  for (let m = re.exec(html); m; m = re.exec(html)) {
    depth += m[1] ? -1 : 1;
    if (depth === 0) return m.index + m[0].length;
  }
  return html.length;
}

/**
 * 조건에 맞는 여는 태그로 시작하는 요소를 통째로 바꾼다(겹친 요소는 바깥 것 하나로 본다).
 * @param html - HTML
 * @param tag - 태그 이름
 * @param opening - 여는 태그를 알아보는 식(태그 하나 전체에 맞춘다)
 * @param replace - 요소 HTML 을 받아 대신할 글
 * @returns 바꾼 HTML
 */
function replaceElements(
  html: string, tag: string, opening: RegExp, replace: (element: string) => string,
): string {
  const open = new RegExp(`<${tag}\\b[^>]*>`, 'gi');
  let out = '';
  let cursor = 0;
  for (let m = open.exec(html); m; m = open.exec(html)) {
    if (!opening.test(m[0])) continue;
    const end = matchingEnd(html, tag, m.index);
    out += html.slice(cursor, m.index) + replace(html.slice(m.index, end));
    cursor = end;
    open.lastIndex = end;
  }
  return out + html.slice(cursor);
}

/** 한 줄의 최상위 칸 하나 — 안에 표가 겹쳐도 바깥 칸만 센다 */
interface RowCell {
  inner: string;
  rowspan: number;
  colspan: number;
}

/**
 * 한 줄(`<tr>…</tr>`)의 최상위 칸들 — 칸 안의 표(겹친 여백 해설 표)는 그 칸의 속이지 이 줄의 칸이 아니다.
 * @param row - 줄 HTML
 * @returns 칸들(속 · 합친 줄 수 · 합친 칸 수)
 */
function rowCells(row: string): RowCell[] {
  const cells: RowCell[] = [];
  const open = /<(td|th)\b([^>]*)>/gi;
  for (let m = open.exec(row); m; m = open.exec(row)) {
    const tagName = m[1].toLowerCase();
    const attrs = m[2];
    const end = matchingEnd(row, tagName, m.index);
    const inner = row.slice(m.index + m[0].length, end).replace(new RegExp(`</${tagName}>$`, 'i'), '');
    const span = (name: string) => Math.max(1, Number(new RegExp(`\\b${name}="(\\d+)"`, 'i').exec(attrs)?.[1] ?? 1) || 1);
    cells.push({ inner, rowspan: span('rowspan'), colspan: span('colspan') });
    open.lastIndex = end;
  }
  return cells;
}

/**
 * 여백 해설 표 하나를 원문 블록들로 — 줄마다 **논리 첫째 칸(원문 칸)** 의 속만 꺼낸다.
 *
 * ⚠️ 칸 차례를 그대로 믿지 않는다(코덱스 1R): 원문 칸이 `rowspan="2"` 로 두 줄을 덮으면 다음 줄의 첫 칸은 **해설 칸**이다.
 *    앞 줄들이 덮은 열을 세어 논리 열 0 에 떨어지는 칸만 원문으로 본다.
 * ⚠️ 꺼낸 원문 칸 속도 다시 걷는다 — 원문 칸 안에 여백 해설 표·말머리 상자가 또 들어 있으면(편집기가 막지 않는다)
 *    그 해설이 원문으로 샌다.
 * @param table - `<table data-layout="gloss">…</table>`
 * @returns 원문 블록 HTML
 */
function glossToBlocks(table: string): string {
  const blocks: string[] = [];
  /** 열마다 아직 덮여 있는 줄 수(앞 줄의 rowspan) */
  const covered: number[] = [];
  const row = /<tr\b[^>]*>/gi;
  for (let m = row.exec(table); m; m = row.exec(table)) {
    const rowEnd = matchingEnd(table, 'tr', m.index);
    row.lastIndex = rowEnd;
    let col = 0;
    for (const cell of rowCells(table.slice(m.index + m[0].length, rowEnd))) {
      while ((covered[col] ?? 0) > 0) col += 1;
      const source = col === 0;
      for (let c = col; c < col + cell.colspan; c += 1) covered[c] = cell.rowspan;
      col += cell.colspan;
      if (!source) continue;
      const inner = stripWorkbookNotes(cell.inner).trim();
      if (inner) blocks.push(BLOCK_START.test(inner) ? inner : `<p>${inner}</p>`);
    }
    // 이 줄을 지났으니 덮인 줄 수를 하나씩 줄인다(이번 줄에서 새로 덮은 칸은 rowspan 에서 이 줄 몫을 뺀다)
    for (let c = 0; c < covered.length; c += 1) covered[c] = Math.max(0, (covered[c] ?? 0) - 1);
  }
  return blocks.join('');
}

/**
 * 말머리 상자·어휘 풀이·화살표 도식·여백 해설을 걷어 **원문 HTML** 만 남긴다.
 * @param html - 참고자료 프로필 HTML(정화한 값)
 * @returns 원문 HTML
 */
export function stripWorkbookNotes(html: string): string {
  let out = replaceElements(html, 'blockquote', /\bdata-(callout|tone)=/i, () => '');
  out = replaceElements(out, 'table', /\bdata-layout=["']vocab["']/i, () => '');
  out = replaceElements(out, 'ul', /\bdata-flow=/i, () => '');
  out = replaceElements(out, 'table', /\bdata-layout=["']gloss["']/i, glossToBlocks);
  return out.replace(/<\/?(mark|small)\b[^>]*>/gi, '');
}

/**
 * 작품 전문의 **원문 평문** — 문제 만들기 참고자료와 적재 도구의 '같은 글인가' 판정이 이것 하나를 쓴다.
 *
 * 평문(text)이면 그대로, 서식(html)이면 해설을 걷고 `htmlToText` 로(문단 = 빈 줄, 행 = 줄바꿈) — 옛 평문 작품과 같은 모양이다.
 * @param body - 본문
 * @param format - 형식
 * @returns 원문 평문
 */
export function referenceBodyPlainText(body: string, format: ReferenceTextFormat): string {
  return format === 'html' ? htmlToText(stripWorkbookNotes(body)) : body;
}
