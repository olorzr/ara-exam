import { boxKind } from '@/lib/box-labels';
import { createHost } from '@/lib/print/table-dom';
import { soleFigureIndex } from '@/lib/problem-bank/figure-render';
import { isEmptyParagraph } from './html-trim';

/**
 * 지문 HTML → 인쇄 조각 (DOM 파싱, 브라우저 전용 — 없으면 통째로 한 조각).
 *
 * 인쇄 엔진의 블록 하나는 **쪽을 넘겨 쪼갤 수 없는 최소 단위**다. 그래서 지문은 최상위
 * 요소 하나가 한 조각인데, **최상위 상자(`blockquote`)는 자식 단위로
 * 터뜨린다.** 상자 하나에 지문 전체가 담기면(대원국제중 시험지는 지문마다 테두리를 두르고,
 * OCR 이 그 테두리를 `(가)` 상자로 읽었다) 3,000자가 한 블록이 되어 한 쪽을 넘기고,
 * 인쇄 엔진이 `transform: scale()` 로 통째로 줄여 **깨알같이** 찍었다(2026-09-27 춘향전).
 *
 * ⚠️ **길이 문턱 없이 늘 터뜨린다.** 문턱을 두면 그 아래의 긴 (가) 상자는 여전히 줄어든다.
 * ⚠️ **상자 안 상자도 한 겹 더 터뜨린다**(0.9.92). (가) 구역 안의 [A] 구간처럼 겹친 상자가 통째로 한 조각이면
 *    1,145자 [A] 가 쪼갤 수 없는 덩어리가 되어 다음 단으로 밀리거나 줄어 찍혔다(2026-11-22 「춘향전」 20~23번).
 *    안쪽 상자는 자식이 **전부 문단**일 때만 문단마다 한 조각으로 풀고, 조각에 안쪽 틀(`inner`)을 함께 싣는다.
 *    문단 사이 간격이 곧 예전 문단 간격이라 안 잘리면 모양이 예전과 같다. 표·목록·그림·날글자가 끼었거나
 *    세 겹째가 있으면 예전처럼 통째로 둔다.
 * ⚠️ 상자 틀은 여기서 HTML 로 잇지 않는다 — 조각마다 `box` 를 실어 보내고 그리는 쪽
 *    (`PaperPrintBlocks`)이 React 로 `<blockquote data-box>` 를 두른다. 정화는 쪼개기
 *    **전에** 끝나고 다시 하지 않으므로 문자열을 이어 붙이는 길을 만들지 않는다.
 */

/** 터뜨린 구역 상자의 표시 — 그리는 쪽이 이 값으로 상자 틀을 두른다 */
export interface BoxPart {
  /** `data-box` 값(괄호 없음). 말머리 없는 실제 상자는 null */
  label: string | null;
  /** 이 상자의 첫 조각 — 말머리·윗선은 여기에만 */
  first: boolean;
  /** 이 상자의 마지막 조각 — 아랫선은 여기에만 */
  last: boolean;
}

/** 인쇄 블록이 될 지문 조각 하나 */
export interface PassagePiece {
  html: string;
  /** 그림 하나뿐인 조각이면 그 그림의 Storage 경로 — 그림 블록이 된다 */
  figurePath?: string;
  /** 터뜨린 상자의 조각일 때만 */
  box?: BoxPart;
  /**
   * 겹친 상자의 안쪽 틀 — (가) 구역 안의 [A] 구간처럼 상자 안 상자를 문단마다 풀었을 때만 있다.
   * 있으면 `box`(바깥 틀)도 반드시 있다. 그리는 쪽이 바깥 틀 안에 이 틀을 한 겹 더 두른다(`PaperBoxFrame`).
   */
  inner?: BoxPart;
}

/** 쪼개는 선택 */
export interface PassagePieceOptions {
  /**
   * 경로 없는 그림 조각을 남긴다. 지문은 버리지만 **발문은 남긴다** — 발문의 빠진 그림은 눈에 보이는
   * 안내로 찍어 왔고(`renderFiguresInHtml`), 조용히 비우면 문항의 자료가 빠진 것을 아무도 모른다.
   */
  keepMissingFigures?: boolean;
}

/** 줄 안에 흐르는 요소 — 정화기가 통과시키는 태그 가운데 블록이 아닌 것 전부 */
const INLINE_TAGS = new Set(['STRONG', 'EM', 'U', 'S', 'CODE', 'SPAN', 'BR']);

/**
 * 줄 안에 흐르는 노드인가 — 날글자이거나 줄 안 요소.
 * @param node - 살펴볼 노드
 * @returns 블록 요소가 아니면 true
 */
export function isInlineNode(node: Node): boolean {
  return node.nodeType === Node.TEXT_NODE || (node instanceof Element && INLINE_TAGS.has(node.tagName));
}

/**
 * 터뜨려도 되는 상자인가 — 말머리가 허용 목록에 있고 **다른 속성이 없는** 상자만.
 *
 * ⚠️ 정렬 같은 속성이 붙은 상자를 터뜨리면 틀을 다시 두를 때 그 속성이 사라진다.
 *    운영 데이터에는 없는 모양이라(2026-09-27) 예전처럼 통째로 둔다.
 * @param el - 최상위 요소
 * @returns 허용된 말머리, 말머리 없는 상자는 null, 나눌 수 없으면 undefined
 */
function explodableLabel(el: Element): string | null | undefined {
  if (el.tagName !== 'BLOCKQUOTE') return undefined;
  if (el.attributes.length === 0) return null;
  if (el.attributes.length !== 1) return undefined;
  const label = el.getAttribute('data-box');
  return label !== null && boxKind(label) ? label : undefined;
}

/**
 * 상자의 자식을 조각 HTML 로 — 블록 요소는 하나가 한 조각이고, 날글자·줄 안 요소가
 * 이어지면 `<p>` 하나로 묶는다.
 *
 * ⚠️ 요소만 세면 상자 안 날글자가 **조용히 사라진다**(blocks.ts 의 해설 조각과 같은 함정).
 *    `<p>` 로 묶는 것은 규약("문단마다 `<p>`")의 모양으로 되돌리는 일이다. 공백뿐인
 *    이어달리기(요소 사이 줄바꿈)는 조각이 아니다.
 * @param box - 터뜨릴 상자
 * @returns 순서대로의 조각 HTML
 */
function childPieces(box: Element): string[] {
  const out: string[] = [];
  let run: Node[] = [];
  const flush = () => {
    if (run.length === 0) return;
    const p = box.ownerDocument.createElement('p');
    run.forEach((node) => p.appendChild(node.cloneNode(true)));
    run = [];
    if ((p.textContent ?? '').trim() !== '') out.push(p.outerHTML);
  };

  for (const node of Array.from(box.childNodes)) {
    if (isInlineNode(node)) {
      run.push(node);
      continue;
    }
    flush();
    if (node instanceof Element) out.push(node.outerHTML);
  }
  flush();
  return out;
}

/**
 * 그림 하나뿐인 조각이면 경로를 싣는다. 경로가 없는 그림은 버린다 — 못 잘라 낸 그림이라
 * 그대로 두면 인쇄물에 빈 줄만 남는다.
 * @param html - 조각 HTML
 * @param figures - 지문 그림 경로들 (1번이 index 0)
 * @param options - 쪼개는 선택
 * @returns 0개 또는 1개의 조각
 */
function withFigure(html: string, figures: readonly string[], options: PassagePieceOptions): PassagePiece[] {
  const only = soleFigureIndex(html);
  if (only === null) return [{ html }];
  const path = figures[only - 1];
  if (path) return [{ html, figurePath: path }];
  return options.keepMissingFigures ? [{ html }] : [];
}

/**
 * 걷어도 되는 빈 조각인가 — 상자 조각은 걷지 않는다.
 * 겹친 상자 안쪽 가장자리의 빈 문단은 상자 틀 안의 빈 줄이고, 걷으면 거기 실린 말머리·윗선(`first`)도 함께 사라진다.
 */
function isTrimmable(piece: PassagePiece): boolean {
  return !piece.box && isEmptyParagraph(piece.html);
}

/** 앞뒤의 빈 문단을 걷어낸다 — 가운데 빈 줄은 원문이라 남긴다 */
function trimEdges(pieces: PassagePiece[]): PassagePiece[] {
  let start = 0;
  let end = pieces.length;
  while (start < end && isTrimmable(pieces[start])) start += 1;
  while (end > start && isTrimmable(pieces[end - 1])) end -= 1;
  return pieces.slice(start, end);
}

/**
 * 겹친 상자의 안쪽 상자를 문단마다 조각으로 — 못 풀면 null(예전처럼 통째로 한 조각).
 *
 * 푸는 것은 **자식이 전부 `<p>`** 인 상자뿐이다. 그러면 조각 사이 간격이 곧 예전 문단 간격이라(problem-paper.css 의
 * `.pb-box-part--holds`) 안 잘리면 모양이 예전과 같다. 표·목록·그림·날글자·세 겹째 상자가 하나라도 있거나
 * 말머리가 허용 목록 밖이거나 다른 속성이 붙었으면 풀지 않는다.
 * ⚠️ 안쪽 가장자리의 빈 문단은 걷지 않는다 — 예전 그림에서 빈 줄로 보이던 것이다.
 * ⚠️ 그림 자리표시자가 든 상자는 풀지 않는다 — 그림 조각에는 안쪽 틀을 실을 자리가 없다.
 * @param html - 바깥 상자의 조각 하나(`<blockquote …>…</blockquote>` 이어야 한다)
 * @returns 안쪽 틀을 단 조각들 또는 null
 */
function innerPieces(html: string): PassagePiece[] | null {
  if (!html.startsWith('<blockquote') || html.includes('data-figure')) return null;
  const el = createHost(html)?.firstElementChild;
  if (!el || el.nextElementSibling) return null;
  const label = explodableLabel(el);
  if (label === undefined) return null;
  const children: Element[] = [];
  for (const node of Array.from(el.childNodes)) {
    if (node instanceof Element && node.tagName === 'P') children.push(node);
    else if (node.nodeType !== Node.TEXT_NODE || (node.textContent ?? '').trim() !== '') return null;
  }
  const htmls = children.map((p) => p.outerHTML);
  if (htmls.length === 0 || htmls.every(isEmptyParagraph)) return null;
  return htmls.map((piece, i) => ({ html: piece, inner: { label, first: i === 0, last: i === htmls.length - 1 } }));
}

/**
 * 상자 하나를 조각들로. 남는 것이 없으면(빈 문단뿐) 빈 배열 — 부르는 쪽이 통째로 둔다.
 *
 * ⚠️ 경로 없는 그림을 **먼저 버리고** 그다음 빈 문단을 걷는다. 반대면 버린 그림 뒤의
 *    빈 문단이 상자의 첫 조각으로 남아 상자 머리가 한 줄 뜬다.
 * ⚠️ 안쪽 상자는 가장자리를 걷은 **뒤에** 편다 — 먼저 펴면 안쪽 가장자리의 빈 문단이 바깥 가장자리로 보여 걷힌다.
 * @param box - 상자 요소
 * @param label - 말머리
 * @param figures - 지문 그림 경로들
 * @param options - 쪼개는 선택
 * @returns 상자 표시를 단 조각들
 */
function explodeBox(
  box: Element, label: string | null, figures: readonly string[], options: PassagePieceOptions,
): PassagePiece[] {
  const pieces = trimEdges(childPieces(box).flatMap((html) => withFigure(html, figures, options)))
    .flatMap((piece) => (piece.figurePath ? null : innerPieces(piece.html)) ?? [piece]);
  return pieces.map((piece, i) => ({
    ...piece,
    box: { label, first: i === 0, last: i === pieces.length - 1 },
  }));
}

/**
 * 지문 HTML 을 인쇄 조각으로 나눈다.
 *
 * 최상위 요소 하나가 한 조각이되 구역 상자는 자식 단위로 터뜨린다. 상자 안 상자는 문단뿐일 때만 한 겹 더
 * 터뜨리고(`inner`), 그 밖이면 바깥 상자의 조각 하나로 통째로 간다. 빈 문단뿐인 상자는 통째로 둔다 — 지우면
 * 〈보기〉 말머리까지 사라진다.
 * @param html - **정화가 끝난** 지문 HTML
 * @param figures - 지문 그림 경로들 (1번이 index 0)
 * @param options - 쪼개는 선택
 * @returns 순서대로의 조각. 브라우저가 없으면(SSR) 통째로 한 조각 — 클라이언트가 다시 계산한다
 */
export function splitPassagePieces(
  html: string, figures: readonly string[], options: PassagePieceOptions = {},
): PassagePiece[] {
  const host = createHost(html);
  if (!host) return html.trim() ? [{ html }] : [];

  const pieces: PassagePiece[] = [];
  for (const el of Array.from(host.children)) {
    const label = explodableLabel(el);
    const exploded = label !== undefined ? explodeBox(el, label, figures, options) : [];
    if (exploded.length > 0) pieces.push(...exploded);
    else pieces.push(...withFigure(el.outerHTML, figures, options));
  }
  return trimEdges(pieces);
}

/**
 * 조각을 다시 나눌 때 상자 표시를 좁힌다 — 처음 표시는 첫 조각에만, 끝 표시는 끝 조각에만 남는다.
 * 지문 문단을 재서 자를 때(part-split-plan.ts)와 발문 줄 묶음(stem-line-units.ts)이 같이 쓴다.
 * @param part - 원래 조각의 상자 표시
 * @param isFirst - 나눈 조각 가운데 첫 조각인가
 * @param isLast - 나눈 조각 가운데 끝 조각인가
 * @returns 좁힌 표시
 */
export function narrowBoxPart(part: BoxPart, isFirst: boolean, isLast: boolean): BoxPart {
  return { label: part.label, first: part.first && isFirst, last: part.last && isLast };
}

/**
 * 상자 조각 틀의 클래스 — 글 조각과 그림 조각이 **같은 함수**를 써야 한쪽만 말머리가
 * 두 번 찍히거나 선이 끊기지 않는다.
 *
 * 겹친 상자의 바깥 틀이고 안쪽 틀이 아직 끝나지 않았으면 `pb-box-part--holds` 를 단다 — 문단 사이 간격은 안쪽 틀이
 * 지고 바깥 틀은 지지 않는다(problem-paper.css). 안 그러면 간격이 두 번 들어가고, 바깥이 지면 [A] 세로선이 끊긴다.
 * @param box - 상자 표시
 * @param inner - 이 틀 안에 두르는 안쪽 틀(겹친 상자일 때만)
 * @returns 공백으로 이은 클래스 문자열
 */
export function boxPartClassName(box: BoxPart, inner?: BoxPart): string {
  const classes = ['pb-box-part'];
  if (box.first) classes.push('pb-box-part--first');
  if (box.last) classes.push('pb-box-part--last');
  if (inner && !inner.last) classes.push('pb-box-part--holds');
  return classes.join(' ');
}
