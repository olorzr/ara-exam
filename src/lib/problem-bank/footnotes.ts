import { createHost } from '@/lib/print/table-dom';

/**
 * 지문·〈보기〉의 각주(`* 품 진 : 품앗이를 한.`)를 작은 글씨로 그리게 표시한다.
 *
 * 원장님(2026-10-26): "모의고사 지문 같은 데서 `*` 으로 해 놓고 밑에 단어 설명 해 둔 건
 * 글씨를 작게 할 수 없음? 참고사항이니까."
 *
 * ⚠️ **데이터에 표시를 저장하지 않고 그릴 때 붙인다.** 각주는 글자 그 자체(`*낱말 : 풀이`)로
 *    이미 알아볼 수 있어서, 렌더에서 붙이면 옛 문제지·책의 스냅샷까지 곧바로 바뀌고
 *    마이그레이션도, 적재 규약도, 편집기 확장도 필요 없다. 정화기는 class 를 받지 않으므로
 *    **정화한 뒤에** 부르고 결과를 다시 정화하지 않는다(그림 자리표시자와 같은 규약).
 *
 * 무엇을 각주로 보는가(확실한 것만 — 본문을 작게 찍는 것이 각주를 크게 두는 것보다 나쁘다):
 *  - 줄이 `*`·`＊` 로 시작하고 그 뒤 30자 안에 `:`·`：` 가 있다(`*헤오시매: 헤아려 주시므로`).
 *  - 문단 **전체**가 그런 줄이면 그 문단을, `<br>` 로 이은 문단의 **끝쪽 줄들이 전부** 그런
 *    줄이면 그 줄들만 떼어 새 문단으로 만든다. 시구 사이에 `*` 로 시작하는 줄이 있어도 그 뒤에
 *    본문 줄이 이어지면 건드리지 않는다.
 *  - 표 칸 안의 글은 보지 않는다(칸선 없는 나란히 표의 원문 줄이 `*` 로 시작할 수 있다).
 */

/** 작게 그리는 각주 문단의 클래스 — problem-paper.css 의 `.pb-note` 와 짝이다 */
export const FOOTNOTE_CLASS = 'pb-note';

/** `* 낱말 : 풀이` — 별표 뒤 30자 안에 쌍점이 있어야 각주다 */
const NOTE_LINE = /^[*＊][^:：]{1,30}[:：]/;

/**
 * 한 줄의 글이 각주인가.
 * @param text - 태그를 걷은 줄 글
 * @returns 각주 줄이면 true
 */
export function isFootnoteLine(text: string): boolean {
  return NOTE_LINE.test(text.trim());
}

/** 문단의 자식 노드를 최상위 `<br>` 로 갈라 줄마다 [노드들] 로 */
function splitLines(p: Element): Node[][] {
  const lines: Node[][] = [[]];
  for (const node of Array.from(p.childNodes)) {
    if (node.nodeName === 'BR') lines.push([]);
    else lines[lines.length - 1].push(node);
  }
  return lines;
}

/** 줄의 글(태그를 걷고 앞뒤 공백을 지운 것) */
function lineText(nodes: Node[]): string {
  return nodes.map((n) => n.textContent ?? '').join('').trim();
}

/**
 * 끝쪽 각주 줄이 시작하는 자리 — 그 뒤 줄이 전부 각주(빈 줄은 사이에만 허용)이고
 * 그 앞에 본문 줄이 하나라도 있을 때만.
 * @param texts - 줄 글들
 * @returns 각주가 시작하는 줄 번호. 없으면 -1
 */
function trailingNoteStart(texts: readonly string[]): number {
  let start = -1;
  for (let i = texts.length - 1; i >= 0; i -= 1) {
    if (texts[i] === '') continue;
    if (!isFootnoteLine(texts[i])) break;
    start = i;
  }
  if (start <= 0) return -1;
  return texts.slice(0, start).some((t) => t !== '') ? start : -1;
}

/** 표 칸 안의 문단인가 */
function insideCell(p: Element): boolean {
  return p.closest('td, th') !== null;
}

/**
 * 문단 하나를 손본다 — 통째로 각주면 표시하고, 끝쪽 줄만 각주면 떼어 뒤에 새 문단으로 둔다.
 * @param p - 문단 요소
 * @returns 손댔으면 true
 */
function markParagraph(p: Element): boolean {
  // 꾸밈 태그 안의 줄바꿈(`<u>* 낱말: 풀이<br>다음 시구</u>`)은 줄을 셀 수 없다 — 본문을 작게 찍느니
  // 건드리지 않는다(코덱스 1R)
  if (Array.from(p.querySelectorAll('br')).some((br) => br.parentElement !== p)) return false;
  const lines = splitLines(p);
  const texts = lines.map(lineText);
  const first = texts.findIndex((t) => t !== '');
  if (first < 0) return false;
  if (texts.slice(first).every((t) => t === '' || isFootnoteLine(t))) {
    p.classList.add(FOOTNOTE_CLASS);
    return true;
  }
  const start = trailingNoteStart(texts);
  if (start < 0) return false;

  const note = p.ownerDocument.createElement('p');
  note.className = FOOTNOTE_CLASS;
  lines.slice(start).forEach((nodes, i) => {
    if (i > 0) note.appendChild(p.ownerDocument.createElement('br'));
    nodes.forEach((n) => note.appendChild(n));
  });
  // 남은 문단 끝의 `<br>`(각주 줄 앞의 줄바꿈)를 걷는다 — 두면 빈 줄이 하나 생긴다
  while (p.lastChild && (p.lastChild.nodeName === 'BR'
    || (p.lastChild.nodeType === 3 && (p.lastChild.textContent ?? '').trim() === ''))) {
    p.removeChild(p.lastChild);
  }
  p.after(note);
  return true;
}

/**
 * 정화한 지문·발문 HTML 에서 각주 문단에 작은 글씨 표시를 붙인다.
 * @param html - **정화가 끝난** HTML
 * @returns 각주 문단에 `class="pb-note"` 가 붙은 HTML. 각주가 없거나 브라우저가 아니면 그대로
 */
export function markFootnotes(html: string): string {
  if (!html || !/[*＊]/.test(html)) return html;
  const host = createHost(html);
  if (!host) return html;
  const paragraphs = Array.from(host.querySelectorAll('p')).filter((p) => !insideCell(p));
  // 각주가 없으면 들어온 글자 그대로 돌려준다 — 다시 직렬화한 글이 미세하게 달라질 여지를 없앤다
  const changed = paragraphs.map(markParagraph).some(Boolean);
  return changed ? host.innerHTML : html;
}
