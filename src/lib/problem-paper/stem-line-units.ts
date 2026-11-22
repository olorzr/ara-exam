import { narrowBoxPart, type PassagePiece } from './box-parts';
import { cutCandidatesOf, cutParagraph, paragraphOf } from './part-cuts';

/**
 * 발문 속 긴 줄바꿈 문단을 여러 단위로 미리 나눈다 (DOM 파싱, 배치는 재지 않는다).
 *
 * 원장님(2026-11-15): "형태소 복합어 단일어 라는 문제은행 만들고 보니까 17번 꼬라지 왜이러냐?" — 〈보기〉 속
 * 일곱 학생의 말이 `<p>…<br>…</p>` 한 문단(2단 폭 847px)이라, 문항은 단위 사이에서만 자르므로(0.9.67) 그 문단이
 * 통째로 다음 단으로 밀려 앞 단이 크게 비었다. 한 단보다 크면(송탄고 9번 1,239px) 글씨가 줄어 찍혔다.
 *
 * 그래서 단위를 만들 때 그런 문단을 **줄 묶음마다 한 단위**로 나눈다. 자르기 장치(`questionCuts`·
 * `measureQuestion`·`chunkQuestionBlocks`)는 그대로이고, 단위가 잘게 나뉘었으니 문단 안에서도 자른다.
 * 묶음 사이에는 간격이 없다(`joined` → `pb-q__unit--joined`, problem-paper.css) — 쪼개지지 않으면 모양이
 * 예전과 글자 하나까지 같다.
 *
 * ⚠️ 줄은 `<p>` 직계 `<br>` 로만 센다(part-cuts.ts 와 같은 판단). 꾸밈 태그 안에 `<br>` 이 있으면 나누지 않는다.
 * ⚠️ **빈 줄(연 구분) 옆에서는 자르지 않는다** — `cutParagraph` 가 조각 앞뒤의 `<br>` 을 걷어 빈 줄이 사라진다.
 * ⚠️ 줄바꿈 없는 긴 산문 문단은 나누지 않는다 — 문장 끝에서 자르면 줄바꿈 자리가 바뀌어 재야 한다(범위 밖).
 */

/** 이 줄 수 이상인 문단만 나눈다 — 짧은 ㉠㉡ 목록·4행 시는 그대로 한 단위다 */
export const LINE_SPLIT_MIN_LINES = 6;

/** 자른 자리 앞뒤로 남는 줄 수의 하한 — 단 바닥·머리에 한 줄만 남기지 않는다(0.9.66 `MIN_CHUNK_LINES` 와 같다) */
export const LINES_PER_UNIT = 2;

/** 단위로 나뉜 발문 조각 — 같은 문단의 다음 묶음이 바로 뒤에 이어지면 `joined` */
export interface StemLinePiece extends PassagePiece {
  joined?: true;
}

/** 판정 캐시 상한 — 넘으면 비운다(블록을 지을 때마다 같은 문단을 다시 파싱하지 않으려고 둔다) */
const CHUNK_CACHE_LIMIT = 4000;
const chunkCache = new Map<string, readonly string[] | null>();

/** 줄을 걷어 낼 때 사라지는 공백 — `part-cuts.ts` 의 조각 가장자리 걷기와 같은 글자들 */
const BLANK_TEXT = /^[ \t\r\n]*$/;

/** 줄이 비었는가 — 공백 글자 노드뿐이면 빈 줄이다(자르면 걷혀 사라진다) */
function isBlankLine(nodes: readonly Node[]): boolean {
  return nodes.every((node) => node.nodeType === Node.TEXT_NODE && BLANK_TEXT.test(node.textContent ?? ''));
}

/**
 * 문단의 줄마다 빈 줄인가 — `<br>` 사이의 노드들로 가른다.
 * @param p - 문단
 * @returns 줄 차례대로의 빈 줄 여부 (`<br>` 수 + 1 개)
 */
function blankLinesOf(p: Element): boolean[] {
  const lines: Node[][] = [[]];
  for (const node of Array.from(p.childNodes)) {
    if (node.nodeName === 'BR') lines.push([]);
    else lines[lines.length - 1].push(node);
  }
  return lines.map(isBlankLine);
}

/**
 * 자를 `<br>` 번호들 — 앞에서부터, 묶음이 두 줄이 되면 자른다. 뒤에 두 줄 이상 남고 양옆 줄이 비지 않을 때만.
 * @param blank - 줄마다 빈 줄인가
 * @returns `<br>` 후보 번호들 (오름차순). `<br>` k 는 줄 k 와 줄 k+1 사이다
 */
export function lineCutsOf(blank: readonly boolean[]): number[] {
  const lines = blank.length;
  if (lines < LINE_SPLIT_MIN_LINES) return [];
  const cuts: number[] = [];
  let start = 0;
  for (let k = 0; k < lines - 1; k += 1) {
    const before = k + 1 - start;
    const after = lines - (k + 1);
    if (before < LINES_PER_UNIT || after < LINES_PER_UNIT) continue;
    if (blank[k] || blank[k + 1]) continue;
    cuts.push(k);
    start = k + 1;
  }
  return cuts;
}

/** 줄바꿈 양옆의 공백 — 화면에서 줄 끝·줄 머리의 공백은 접혀 보이지 않으므로 견줄 때 없앤다 */
const SPACE_AROUND_BREAK = /[ \t\r\n]*<br>[ \t\r\n]*/g;
const SPACE_AT_EDGES = /^[ \t\r\n]+|[ \t\r\n]+$/g;

/** 문단 안 HTML 을 견줄 모양으로 — 줄바꿈 양옆과 문단 끝의 공백만 없앤다(NBSP 는 들여쓰기라 남긴다) */
function comparableLines(innerHtml: string): string {
  return innerHtml.replace(SPACE_AROUND_BREAK, '<br>').replace(SPACE_AT_EDGES, '');
}

/**
 * 묶음을 줄바꿈으로 다시 이으면 원래 문단과 같은가.
 *
 * `cutParagraph` 는 조각 앞뒤의 `<br>`·공백을 걷는다. 가운데 빈 줄은 `lineCutsOf` 가 지키지만, 문단 **맨 앞·맨 뒤**의
 * 빈 줄(`<p><br>가…`, `…바<br><br></p>`)은 첫 묶음 앞·끝 묶음 뒤에서 걷혀 사라진다(코덱스 1R) — 그런 문단은
 * 나누지 않는다. 공백 차이는 화면에 안 보이므로 견주지 않는다.
 * @param p - 원래 문단
 * @param htmls - 묶음 HTML 들
 * @returns 보이는 내용이 같으면 true
 */
function keepsEveryLine(p: Element, htmls: readonly string[]): boolean {
  const inners = htmls.map((html) => paragraphOf(html)?.innerHTML);
  if (inners.some((inner) => inner === undefined)) return false;
  return comparableLines(inners.join('<br>')) === comparableLines(p.innerHTML);
}

/**
 * 조각 HTML 을 줄 묶음 HTML 들로 — 못 나누면 null.
 * @param html - 조각 HTML (정화가 끝난 것)
 * @returns 묶음 HTML 들(둘 이상) 또는 null
 */
function chunkHtmls(html: string): readonly string[] | null {
  const known = chunkCache.get(html);
  if (known !== undefined) return known;
  const p = paragraphOf(html);
  const candidates = p ? cutCandidatesOf(p) : [];
  let result: readonly string[] | null = null;
  // 후보가 전부 `<br>` 일 때만 줄로 센다 — 직계 `<br>` 이 하나라도 있으면 part-cuts 가 그렇게 돌려준다
  if (p && candidates.length > 0 && candidates.every((c) => c.kind === 'br')) {
    const cuts = lineCutsOf(blankLinesOf(p));
    const htmls = cuts.length > 0 ? cutParagraph(p, candidates, cuts) : [];
    // 비어 버린 묶음이 걸러져 수가 어긋나거나 이은 모양이 원래와 다르면 나누지 않는다 — 그대로 그리면 줄이 사라진다
    result = htmls.length === cuts.length + 1 && keepsEveryLine(p, htmls) ? htmls : null;
  }
  if (chunkCache.size >= CHUNK_CACHE_LIMIT) chunkCache.clear();
  chunkCache.set(html, result);
  return result;
}

/**
 * 발문 조각들에서 긴 줄바꿈 문단을 줄 묶음 조각으로 나눈다.
 *
 * 상자 조각이면 상자의 처음 표시는 첫 묶음에만, 끝 표시는 끝 묶음에만 다시 단다 — 묶음마다 말머리·윗선이
 * 찍히면 안 된다. 그림 조각과 짧은 문단은 그대로다.
 * @param pieces - `splitPassagePieces` 가 낸 발문 조각들
 * @returns 차례대로의 조각들. 나눈 묶음은 마지막 것을 빼고 `joined`
 */
export function splitLongLinePieces(pieces: readonly PassagePiece[]): StemLinePiece[] {
  return pieces.flatMap((piece): StemLinePiece[] => {
    if (piece.figurePath) return [piece];
    const htmls = chunkHtmls(piece.html);
    if (!htmls) return [piece];
    const last = htmls.length - 1;
    return htmls.map((html, i) => ({
      html,
      ...(piece.box ? { box: narrowBoxPart(piece.box, i === 0, i === last) } : {}),
      ...(piece.inner ? { inner: narrowBoxPart(piece.inner, i === 0, i === last) } : {}),
      ...(i < last ? { joined: true as const } : {}),
    }));
  });
}
