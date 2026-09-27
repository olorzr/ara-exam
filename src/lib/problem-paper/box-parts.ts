import { boxKind } from '@/lib/box-labels';
import { createHost } from '@/lib/print/table-dom';
import { soleFigureIndex } from '@/lib/problem-bank/figure-render';
import { isEmptyParagraph } from './html-trim';

/**
 * 지문 HTML → 인쇄 조각 (DOM 파싱, 브라우저 전용 — 없으면 통째로 한 조각).
 *
 * 인쇄 엔진의 블록 하나는 **쪽을 넘겨 쪼갤 수 없는 최소 단위**다. 그래서 지문은 최상위
 * 요소 하나가 한 조각인데, **최상위 구역 상자(`blockquote[data-box]`)만은 자식 단위로
 * 터뜨린다.** 상자 하나에 지문 전체가 담기면(대원국제중 시험지는 지문마다 테두리를 두르고,
 * OCR 이 그 테두리를 `(가)` 상자로 읽었다) 3,000자가 한 블록이 되어 한 쪽을 넘기고,
 * 인쇄 엔진이 `transform: scale()` 로 통째로 줄여 **깨알같이** 찍었다(2026-09-27 춘향전).
 *
 * ⚠️ **길이 문턱 없이 늘 터뜨린다.** 문턱을 두면 그 아래의 긴 (가) 상자는 여전히 줄어든다.
 * ⚠️ 상자 틀은 여기서 HTML 로 잇지 않는다 — 조각마다 `box` 를 실어 보내고 그리는 쪽
 *    (`PaperPrintBlocks`)이 React 로 `<blockquote data-box>` 를 두른다. 정화는 쪼개기
 *    **전에** 끝나고 다시 하지 않으므로 문자열을 이어 붙이는 길을 만들지 않는다.
 */

/** 터뜨린 구역 상자의 표시 — 그리는 쪽이 이 값으로 상자 틀을 두른다 */
export interface BoxPart {
  /** `data-box` 값(괄호 없음). `boxKind` 를 지난 값만 온다 */
  label: string;
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
}

/** 줄 안에 흐르는 요소 — 정화기가 통과시키는 태그 가운데 블록이 아닌 것 전부 */
const INLINE_TAGS = new Set(['STRONG', 'EM', 'U', 'S', 'CODE', 'SPAN', 'BR']);

/**
 * 터뜨려도 되는 상자인가 — 말머리가 허용 목록에 있고 **다른 속성이 없는** 상자만.
 *
 * ⚠️ 정렬 같은 속성이 붙은 상자를 터뜨리면 틀을 다시 두를 때 그 속성이 사라진다.
 *    운영 데이터에는 없는 모양이라(2026-09-27) 예전처럼 통째로 둔다.
 * @param el - 최상위 요소
 * @returns 말머리 또는 null
 */
function explodableLabel(el: Element): string | null {
  if (el.tagName !== 'BLOCKQUOTE' || el.attributes.length !== 1) return null;
  const label = el.getAttribute('data-box');
  return label !== null && boxKind(label) ? label : null;
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
    const inline = node.nodeType === Node.TEXT_NODE
      || (node instanceof Element && INLINE_TAGS.has(node.tagName));
    if (inline) {
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
 * @returns 0개 또는 1개의 조각
 */
function withFigure(html: string, figures: readonly string[]): PassagePiece[] {
  const only = soleFigureIndex(html);
  if (only === null) return [{ html }];
  const path = figures[only - 1];
  return path ? [{ html, figurePath: path }] : [];
}

/** 앞뒤의 빈 문단을 걷어낸다 — 가운데 빈 줄은 원문이라 남긴다 */
function trimEdges(pieces: PassagePiece[]): PassagePiece[] {
  let start = 0;
  let end = pieces.length;
  while (start < end && isEmptyParagraph(pieces[start].html)) start += 1;
  while (end > start && isEmptyParagraph(pieces[end - 1].html)) end -= 1;
  return pieces.slice(start, end);
}

/**
 * 상자 하나를 조각들로. 남는 것이 없으면(빈 문단뿐) 빈 배열 — 부르는 쪽이 통째로 둔다.
 *
 * ⚠️ 경로 없는 그림을 **먼저 버리고** 그다음 빈 문단을 걷는다. 반대면 버린 그림 뒤의
 *    빈 문단이 상자의 첫 조각으로 남아 상자 머리가 한 줄 뜬다.
 * @param box - 상자 요소
 * @param label - 말머리
 * @param figures - 지문 그림 경로들
 * @returns 상자 표시를 단 조각들
 */
function explodeBox(box: Element, label: string, figures: readonly string[]): PassagePiece[] {
  const inner = trimEdges(childPieces(box).flatMap((html) => withFigure(html, figures)));
  return inner.map((piece, i) => ({
    ...piece,
    box: { label, first: i === 0, last: i === inner.length - 1 },
  }));
}

/**
 * 지문 HTML 을 인쇄 조각으로 나눈다.
 *
 * 최상위 요소 하나가 한 조각이되 구역 상자는 자식 단위로 터뜨린다. 상자 안 상자는 더 터뜨리지
 * 않는다(바깥 상자의 조각 하나로 통째로 간다). 빈 문단뿐인 상자는 통째로 둔다 — 지우면
 * 〈보기〉 말머리까지 사라진다.
 * @param html - **정화가 끝난** 지문 HTML
 * @param figures - 지문 그림 경로들 (1번이 index 0)
 * @returns 순서대로의 조각. 브라우저가 없으면(SSR) 통째로 한 조각 — 클라이언트가 다시 계산한다
 */
export function splitPassagePieces(html: string, figures: readonly string[]): PassagePiece[] {
  const host = createHost(html);
  if (!host) return html.trim() ? [{ html }] : [];

  const pieces: PassagePiece[] = [];
  for (const el of Array.from(host.children)) {
    const label = explodableLabel(el);
    const exploded = label ? explodeBox(el, label, figures) : [];
    if (exploded.length > 0) pieces.push(...exploded);
    else pieces.push(...withFigure(el.outerHTML, figures));
  }
  return trimEdges(pieces);
}

/**
 * 상자 조각 틀의 클래스 — 글 조각과 그림 조각이 **같은 함수**를 써야 한쪽만 말머리가
 * 두 번 찍히거나 선이 끊기지 않는다.
 * @param box - 상자 표시
 * @returns 공백으로 이은 클래스 문자열
 */
export function boxPartClassName(box: BoxPart): string {
  const classes = ['pb-box-part'];
  if (box.first) classes.push('pb-box-part--first');
  if (box.last) classes.push('pb-box-part--last');
  return classes.join(' ');
}
