import { createHost } from '@/lib/print/table-dom';

/**
 * 글 끝 어휘 목록 — 낱말 뜻풀이(`span[data-note][data-note-kind="vocab"]`)를 글 차례대로 모은다.
 *
 * 원장님(2026-11-07): "어휘는 단어 오른쪽 위에 작은 별 표시 해 놓고 단어 모음으로 해 주고 설명만 남겨 주라."
 *
 * ⚠️ **저장하지 않고 그릴 때 만든다**(각주 `markFootnotes` 와 같은 규약). 뜻은 `data-note` 한 곳에만 있어 고치면 목록도 같이 바뀌고,
 *    평문 변환·적재 왕복은 이 목록을 모른다. 정화기는 class 를 받지 않으므로 **정화한 뒤에** 붙이고 다시 정화하지 않는다.
 * ⚠️ 낱말과 뜻은 `textContent` 로만 넣는다 — 글자를 HTML 로 잇지 않아야 꺾쇠·따옴표가 태그가 되지 않는다.
 * ⚠️ 목록은 **글 하나에 하나**다. 참고자료 인쇄는 브라우저가 쪽을 나눠 쪽 경계를 아는 코드가 없다.
 */

/** 낱말 뜻풀이 — 두 속성을 함께 본다. 정화기는 `data-note` 없이 홀로 남은 갈래 값을 못 걷는다 */
export const VOCAB_NOTE_SELECTOR = 'span[data-note][data-note-kind="vocab"]';

/** 목록 뿌리의 클래스 — reference-phrase-marks.css 와 짝이다 */
export const VOCAB_LIST_CLASS = 'ref-vocab';

/** 긴 밑줄 줄 안의 낱말 — 이 낱말만 밑줄을 지우면 줄이 끊겨서 그대로 둔다 */
export const VOCAB_IN_LINE_CLASS = 'ref-vocab-in-line';

interface VocabEntry {
  word: string;
  meaning: string;
}

/** 낱말 뜻풀이인가 — 이 밑줄은 화면이 지운다 */
function isVocab(node: Node | null): boolean {
  return node?.nodeType === 1 && (node as Element).matches(VOCAB_NOTE_SELECTOR);
}

/** 이쪽 끝 글자가 밑줄 안인가 — `<strong><u>앞</u></strong>` 처럼 서식에 싸여 있어도 맞닿은 끝을 따라 내려간다 */
function edgeIsLine(node: Node | null, edge: 'firstChild' | 'lastChild'): boolean {
  for (let current = node; current; current = current[edge]) {
    if (current.nodeType === 1 && (current as Element).tagName === 'U') return true;
  }
  return false;
}

/**
 * 공백만 든 밑줄인가 — 낱말 두 개 사이에 전사된 `<u> </u>` 다.
 * ⚠️ `<u><br></u>` 는 아니다. 글자가 없어 비어 보이지만 풀면 원문의 두 행이 붙는다.
 */
function isBlankLine(node: Node | null): boolean {
  if (!edgeIsLine(node, 'firstChild') || (node?.textContent ?? '').trim() !== '') return false;
  return (node as Element).querySelector('br') === null;
}

/** 낱말과 빈 밑줄을 건너 밑줄에 닿는가 — 맨 글자를 만나면 줄이 끝난 것이다 */
function reachesLine(start: Node | null, step: 'previousSibling' | 'nextSibling'): boolean {
  let node = start;
  while (isVocab(node) || isBlankLine(node)) node = node![step];
  return edgeIsLine(node, step === 'previousSibling' ? 'lastChild' : 'firstChild');
}

function inLongLine(node: Node): boolean {
  return reachesLine(node.previousSibling, 'previousSibling') || reachesLine(node.nextSibling, 'nextSibling');
}

/**
 * 밑줄을 낱말마다 가른다 — 긴 밑줄 줄 안의 낱말은 표시해 밑줄을 남기고, 낱말 옆 빈 밑줄은 줄이 아니면 글자로 푼다.
 * ⚠️ CSS `u + span` 으로는 못 가린다 — 형제 결합자는 글자 노드를 건너뛰어 사이에 맨 글자가 있어도 맞는다.
 * @param host - 본문
 */
function settleLines(host: HTMLElement): void {
  const words = Array.from(host.querySelectorAll(VOCAB_NOTE_SELECTOR));
  const inLine = words.filter(inLongLine);
  const blanks = new Set(words.flatMap((word) => [word.previousSibling, word.nextSibling])
    .filter((node): node is ChildNode => node !== null && isBlankLine(node) && !inLongLine(node)));
  inLine.forEach((word) => word.classList.add(VOCAB_IN_LINE_CLASS));
  blanks.forEach((node) => node.replaceWith(node.textContent ?? ''));
}

/** 낱말 글자 — 줄바꿈은 글자가 없어 그대로 읽으면 앞뒤 낱말이 붙는다 */
function wordOf(span: Element): string {
  const copy = span.cloneNode(true) as Element;
  copy.querySelectorAll('br').forEach((br) => br.replaceWith(' '));
  return (copy.textContent ?? '').replace(/\s+/g, ' ').trim();
}

/** 글 차례대로, 낱말과 뜻이 모두 같은 것은 한 번만 */
function collectEntries(host: HTMLElement): VocabEntry[] {
  const seen = new Set<string>();
  const entries: VocabEntry[] = [];
  for (const span of Array.from(host.querySelectorAll(VOCAB_NOTE_SELECTOR))) {
    const word = wordOf(span);
    const meaning = span.getAttribute('data-note') ?? '';
    const key = `${word}\u0000${meaning}`;
    if (!word || seen.has(key)) continue;
    seen.add(key);
    entries.push({ word, meaning });
  }
  return entries;
}

/** 목록 요소 — 글자는 전부 `textContent` 로 넣는다 */
function buildList(doc: Document, entries: readonly VocabEntry[]): HTMLElement {
  const section = doc.createElement('section');
  section.className = VOCAB_LIST_CLASS;
  section.setAttribute('aria-label', '어휘');
  const heading = doc.createElement('h4');
  heading.textContent = '어휘';
  const list = doc.createElement('ol');
  list.className = `${VOCAB_LIST_CLASS}__list`;
  for (const { word, meaning } of entries) {
    const item = doc.createElement('li');
    const term = doc.createElement('b');
    term.className = `${VOCAB_LIST_CLASS}__word`;
    term.textContent = word;
    const text = doc.createElement('span');
    text.className = `${VOCAB_LIST_CLASS}__meaning`;
    text.textContent = meaning;
    item.append(term, text);
    list.append(item);
  }
  section.append(heading, list);
  return section;
}

/**
 * 정화한 본문 끝에 어휘 목록을 붙인다.
 * @param html - **정화가 끝난** HTML
 * @returns 목록을 붙인 HTML. 낱말 뜻풀이가 없거나 브라우저가 아니면 들어온 글자 그대로
 */
export function appendVocabList(html: string): string {
  if (!html || !html.includes('data-note-kind')) return html;
  const host = createHost(html);
  if (!host) return html;
  const entries = collectEntries(host);
  if (entries.length === 0) return html;
  settleLines(host);
  host.append(buildList(host.ownerDocument, entries));
  return host.innerHTML;
}
