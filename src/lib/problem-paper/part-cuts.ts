import { createHost } from '@/lib/print/table-dom';

/**
 * 지문 문단(`<p>` 하나)을 어디서 자를 수 있는가, 그리고 자르기 (DOM 파싱, 배치는 재지 않는다).
 *
 * 긴 시 한 편이 `<p>줄<br>줄…</p>` 한 덩어리로 들어오면(백석 「남신의주 유동 박시봉방」 33행) 그 문단이
 * 쪼갤 수 없는 블록이 되어, 남은 자리에 안 들어가는 순간 쪽을 비워 두고 통째로 넘어갔다(2026-11-06 제보).
 *
 * 자르는 자리는 둘뿐이다:
 *  - **시** — `<p>` 직계 `<br>` 뒤. 행 경계라 어디서 잘려도 그대로 읽힌다.
 *  - **산문** — 직계 글자 노드 안의 문장 끝. 문장 가운데는 끊지 않는다.
 *
 * ⚠️ 꾸밈 태그(`<u>`·`<strong>`) 안은 자르지 않는다 — 밑줄 친 구절과 ㉠ 표시는 문항이 가리키는 자리다.
 * ⚠️ 꾸밈 태그 안에 `<br>` 이 있으면 줄을 셀 수 없어 **아예 자르지 않는다**(footnotes.ts 와 같은 판단).
 * ⚠️ **다시 정화하지 않는다.** 정화는 쪼개기 전에 끝났고 여기서는 있던 노드를 나눠 담을 뿐이다(box-parts.ts).
 */

/** 자를 수 있는 자리 하나 — `index` 는 문단의 `childNodes` 자리 */
export type CutCandidate =
  | { kind: 'br'; index: number }
  /** 글자 노드 `index` 의 `offset` 뒤에서 자른다 */
  | { kind: 'text'; index: number; offset: number };

/**
 * 문장 끝 — 마침표·물음표·느낌표(닫는 따옴표·괄호까지) 뒤에 공백이 온다.
 * 숫자 뒤의 점(`3.5`)은 문장 끝이 아니다. 말줄임표는 문장 가운데에 흔해서 넣지 않았다 —
 * ⚠️ 점을 늘어놓은 말줄임표(`기다렸지만...... 아무`)도 마지막 점이 걸리지 않게 앞 글자를 본다.
 */
export const SENTENCE_END_RE = /(?<![\d.…‥])[.!?]["”’」』)]*(?=\s)/g;

/** 글자 노드가 문장 끝으로 끝나는가 — 뒤에 꾸밈 태그가 이어질 때 그 앞이 자리가 된다 */
const ENDS_SENTENCE_RE = /(?<![\d.…‥])[.!?]["”’」』)]*$/;

/** 조각 가장자리에서 걷는 공백 — NBSP 는 들여쓰기일 수 있어 남긴다(`trim()` 은 NBSP 까지 지운다) */
const EDGE_SPACE_START = /^[ \t\r\n]+/;
const EDGE_SPACE_END = /[ \t\r\n]+$/;
const ONLY_EDGE_SPACE = /^[ \t\r\n]*$/;

/** 판정 캐시 상한 — 넘으면 비운다(블록마다 렌더할 때마다 파싱하지 않으려고 둔다) */
const SPLITTABLE_CACHE_LIMIT = 4000;
const splittableCache = new Map<string, boolean>();

/** 글자 노드 하나의 문장 끝들 */
function textCandidates(node: Node, index: number, isLastChild: boolean): CutCandidate[] {
  const text = node.textContent ?? '';
  const out: CutCandidate[] = Array.from(text.matchAll(SENTENCE_END_RE), (match) => ({
    kind: 'text' as const, index, offset: match.index + match[0].length,
  }));
  if (!isLastChild && ENDS_SENTENCE_RE.test(text)) out.push({ kind: 'text', index, offset: text.length });
  return out;
}

/**
 * 문단에서 자를 수 있는 자리들 — 문서 차례대로.
 * @param p - 문단 요소
 * @returns 자리들. `<br>` 이 하나라도 직계면 시로 보고 `<br>` 뒤만, 없으면 문장 끝만. 못 자르면 빈 배열
 */
export function cutCandidatesOf(p: Element): CutCandidate[] {
  const breaks = Array.from(p.querySelectorAll('br'));
  if (breaks.some((br) => br.parentElement !== p)) return [];
  const nodes = Array.from(p.childNodes);
  if (breaks.length > 0) {
    return nodes.flatMap((node, index): CutCandidate[] => (node.nodeName === 'BR' ? [{ kind: 'br', index }] : []));
  }
  return nodes.flatMap((node, index) => (
    node.nodeType === Node.TEXT_NODE ? textCandidates(node, index, index === nodes.length - 1) : []
  ));
}

/**
 * 블록 HTML 이 문단 하나뿐이면 그 문단.
 * @param html - 조각 HTML
 * @returns 파싱한 `<p>`. 문단 하나가 아니거나 브라우저가 없으면 null
 */
export function paragraphOf(html: string): HTMLElement | null {
  if (!/^\s*<p[\s>]/i.test(html)) return null;
  const host = createHost(html);
  const first = host?.firstElementChild;
  if (!host || host.children.length !== 1 || first?.tagName !== 'P') return null;
  const stray = Array.from(host.childNodes).some((node) => node !== first && (node.textContent ?? '').trim() !== '');
  return stray ? null : first as HTMLElement;
}

/**
 * 이 조각을 더 쪼갤 수 있는가.
 * @param html - 조각 HTML
 * @returns 문단 하나이고 자를 자리가 있으면 true
 */
export function isSplittablePartHtml(html: string): boolean {
  const known = splittableCache.get(html);
  if (known !== undefined) return known;
  const p = paragraphOf(html);
  const result = p !== null && cutCandidatesOf(p).length > 0;
  if (splittableCache.size >= SPLITTABLE_CACHE_LIMIT) splittableCache.clear();
  splittableCache.set(html, result);
  return result;
}

/**
 * 잰 DOM 과 상태의 HTML 이 같은 문단인가를 견주는 표시.
 * @param p - 문단 요소
 * @returns 자리 수와 글자 수
 */
export function partSignature(p: Element): string {
  return `${cutCandidatesOf(p).length}:${(p.textContent ?? '').length}`;
}

/** 문단 안의 자리 — 노드 `index` 의 글자 `offset` */
interface NodePosition {
  index: number;
  offset: number;
}

/** 조각의 앞뒤에 남은 줄바꿈·공백을 걷는다 — 두면 단 머리·바닥에 빈 줄이 생긴다 */
function trimEdges(chunk: Element): void {
  const blank = (node: Node | null) => node !== null
    && (node.nodeName === 'BR' || (node.nodeType === Node.TEXT_NODE && ONLY_EDGE_SPACE.test(node.textContent ?? '')));
  while (blank(chunk.firstChild)) chunk.firstChild?.remove();
  while (blank(chunk.lastChild)) chunk.lastChild?.remove();
  const { firstChild: head, lastChild: tail } = chunk;
  if (head?.nodeType === Node.TEXT_NODE) head.textContent = (head.textContent ?? '').replace(EDGE_SPACE_START, '');
  if (tail?.nodeType === Node.TEXT_NODE) tail.textContent = (tail.textContent ?? '').replace(EDGE_SPACE_END, '');
}

/** `from` 부터 `to` 앞까지를 문단의 속성을 그대로 둔 새 문단에 담는다 */
function sliceParagraph(p: Element, nodes: readonly Node[], from: NodePosition, to: NodePosition): Element {
  const chunk = p.cloneNode(false) as Element;
  for (let i = from.index; i <= to.index && i < nodes.length; i += 1) {
    if (i === to.index && to.offset === 0) break;
    const start = i === from.index ? from.offset : 0;
    const end = i === to.index ? to.offset : undefined;
    chunk.appendChild(start === 0 && end === undefined
      ? nodes[i].cloneNode(true)
      : p.ownerDocument.createTextNode((nodes[i].textContent ?? '').slice(start, end)));
  }
  trimEdges(chunk);
  return chunk;
}

/**
 * 문단을 자른다.
 *
 * `<br>` 자리는 그 `<br>` 을 버린다(조각 경계가 곧 줄바꿈이다). 비어 버린 조각은 내지 않는다.
 * @param p - 문단 요소 (바꾸지 않는다)
 * @param candidates - `cutCandidatesOf(p)`
 * @param cuts - 자를 후보 번호들 (오름차순)
 * @returns 조각 HTML 들. 문단의 class·style 은 조각마다 그대로다
 */
export function cutParagraph(p: Element, candidates: readonly CutCandidate[], cuts: readonly number[]): string[] {
  const nodes = Array.from(p.childNodes);
  const chunks: Element[] = [];
  let from: NodePosition = { index: 0, offset: 0 };
  for (const cut of cuts) {
    const stop = candidates[cut];
    const offset = stop.kind === 'text' ? stop.offset : 0;
    chunks.push(sliceParagraph(p, nodes, from, { index: stop.index, offset }));
    from = stop.kind === 'br' ? { index: stop.index + 1, offset: 0 } : { index: stop.index, offset };
  }
  chunks.push(sliceParagraph(p, nodes, from, { index: nodes.length, offset: 0 }));
  return chunks.filter((chunk) => (chunk.textContent ?? '').trim() !== '').map((chunk) => chunk.outerHTML);
}
