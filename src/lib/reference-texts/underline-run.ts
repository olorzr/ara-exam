/**
 * 이어진 밑줄 줄 찾기 — 풀이 자리(`phrase-note-dom.ts`)와 어휘 목록(`vocab-list.ts`)이 같은 눈으로 본다.
 *
 * 풀이는 책에서 문장 밑줄의 한 낱말 밑에 찍힌 채 옮겨졌지만 뜻은 문장 전체를 푼다(설명 111개 가운데 56개가 긴 밑줄의 일부다).
 * 그래서 화면에서 한 줄로 보이는 밑줄을 함께 찾는다.
 *
 * ⚠️ 형제 노드의 양 끝만 보고 짐작하지 말 것(코덱스 5·6R) — 서식 안의 맨 글자 틈, 화면이 지운 낱말 밑줄, 재는 동안 넣은 받침을 못 가린다.
 *    **글자 노드마다** 화면이 밑줄을 긋는지를 CSS 규칙과 같은 기준으로 본다(`isLinedText`). 규칙을 바꾸면 이 함수도 함께 고칠 것.
 */

/** 낱말 뜻풀이 — 두 속성을 함께 본다. 정화기는 `data-note` 없이 홀로 남은 갈래 값을 못 걷는다 */
export const VOCAB_NOTE_SELECTOR = 'span[data-note][data-note-kind="vocab"]';

/** 긴 밑줄 줄 안의 낱말 — `vocab-list.ts` 가 붙이고 화면이 이 span 에 밑줄을 긋는다(`<u>` 가 없어도) */
export const VOCAB_IN_LINE_CLASS = 'ref-vocab-in-line';

/** 재는 동안 넣는 빈 받침(phrase-note-dom.ts) — 글자가 없어 줄을 끊지 않는다 */
export const NOTE_STRUT_CLASS = 'ref-note-strut';

/** 밑줄 줄이 넘지 못하는 블록 */
const BLOCK_TAGS = new Set(['P', 'LI', 'TD', 'TH', 'H3', 'H4', 'BLOCKQUOTE', 'DIV', 'UL', 'OL', 'TABLE', 'SECTION', 'FIGURE', 'HR']);

/**
 * 낱말 뜻풀이인가.
 * @param node - 노드
 * @returns 낱말 뜻풀이면 true
 */
export function isVocabNote(node: Node | null): boolean {
  return node?.nodeType === 1 && (node as Element).matches(VOCAB_NOTE_SELECTOR);
}

/**
 * 이쪽 끝 글자가 밑줄 안인가 — `<strong><u>앞</u></strong>` 처럼 서식에 싸여 있어도 맞닿은 끝을 따라 내려간다.
 * @param node - 노드
 * @param edge - 볼 끝
 * @returns 밑줄 안이면 true
 */
export function edgeIsLine(node: Node | null, edge: 'firstChild' | 'lastChild'): boolean {
  for (let current = node; current; current = current[edge]) {
    if (current.nodeType === 1 && (current as Element).tagName === 'U') return true;
  }
  return false;
}

/** 다른 구절 해설인가 — 밑줄 줄을 나눠 갖는 경계다 */
function isExplanation(element: Element): boolean {
  return element.matches('span[data-note]') && !element.matches(VOCAB_NOTE_SELECTOR);
}

/** 이 노드를 품은 블록 */
function blockOf(node: Node): Element | null {
  for (let element = node.parentElement; element; element = element.parentElement) {
    if (BLOCK_TAGS.has(element.tagName)) return element;
  }
  return null;
}

/**
 * 화면이 이 글자에 밑줄을 긋는가 — reference-phrase-marks.css 의 규칙과 같다.
 * `<u>` 는 긋되 줄 밖 낱말 뜻풀이 안의 `<u>` 는 화면이 지운다. 긴 줄 안 낱말과 `<u>` 없는 구절 해설은 span 에 긋는다.
 * @param text - 글자 노드
 * @param block - 그 블록
 * @returns 밑줄이 보이면 true
 */
export function isLinedText(text: Text, block: Element): boolean {
  let lined = false;
  for (let element = text.parentElement; element && element !== block; element = element.parentElement) {
    if (element.tagName === 'U') lined = true;
    else if (element.matches(VOCAB_NOTE_SELECTOR)) {
      if (element.classList.contains(VOCAB_IN_LINE_CLASS)) return true;
      lined = false;
    } else if (isExplanation(element) && element.querySelector('u') === null) return true;
  }
  return lined;
}

/** 이 글자가 든 구절 해설 — 없으면 null */
function explanationOf(text: Text, block: Element): Element | null {
  for (let element = text.parentElement; element && element !== block; element = element.parentElement) {
    if (isExplanation(element)) return element;
  }
  return null;
}

/** 구절 안의 글자 노드들 */
function ownTexts(span: Element): Text[] {
  const walker = span.ownerDocument.createTreeWalker(span, 4);
  const texts: Text[] = [];
  for (let node = walker.nextNode(); node; node = walker.nextNode()) if ((node as Text).data !== '') texts.push(node as Text);
  return texts;
}

/** 한쪽으로 이어진 밑줄 끝 글자 — 줄바꿈 · 블록 · 다른 구절 해설 · 밑줄 없는 글자를 만나면 멈춘다. 받침은 지나간다 */
function runEnd(span: Element, block: Element, from: Text, forward: boolean): Text {
  const walker = span.ownerDocument.createTreeWalker(block, 1 | 4);
  walker.currentNode = from;
  let end = from;
  for (let node = forward ? walker.nextNode() : walker.previousNode(); node; node = forward ? walker.nextNode() : walker.previousNode()) {
    if (node.nodeType === 1) {
      const element = node as Element;
      if (element.tagName === 'BR' || BLOCK_TAGS.has(element.tagName)) break;
      continue;
    }
    const text = node as Text;
    if (text.data === '' || text.parentElement?.classList.contains(NOTE_STRUT_CLASS)) continue;
    if (span.contains(text)) { end = text; continue; }
    // ⚠️ 거꾸로 걸으면 앞 블록의 글자를 그 블록 요소보다 먼저 만난다 — 글자마다 제 블록을 본다(코덱스 7R)
    if (blockOf(text) !== block) break;
    const owner = explanationOf(text, block);
    if (owner || !isLinedText(text, block)) break;
    end = text;
  }
  return end;
}

/**
 * 구절이 든 밑줄 줄의 처음과 끝 글자. 다른 구절 해설을 만나면 멈춘다 — 한 문장에 풀이가 둘이면 제 몫만 본다.
 * @param span - 구절
 * @returns 처음과 끝 글자 노드 — 구절에 글자가 없으면 null
 */
export function underlineRun(span: Element): { first: Text; last: Text } | null {
  const texts = ownTexts(span);
  const block = blockOf(span);
  if (texts.length === 0 || !block) return null;
  const head = texts[0];
  const tail = texts[texts.length - 1];
  // 구절 끝 글자에 밑줄이 없으면 그쪽으로는 줄이 이어지지 않는다(코덱스 8R — `<span> <u>뒤</u></span>` 의 앞 공백)
  return {
    first: isLinedText(head, block) ? runEnd(span, block, head, false) : head,
    last: isLinedText(tail, block) ? runEnd(span, block, tail, true) : tail,
  };
}

const hasLetter = (node: Node) => /\S/.test((node as Text).data);

/** 낱말 뜻풀이 안의 글자인가 */
function inVocab(text: Text, block: Element): boolean {
  for (let element = text.parentElement; element && element !== block; element = element.parentElement) {
    if (element.matches(VOCAB_NOTE_SELECTOR)) return true;
  }
  return false;
}

/** 한쪽으로 낱말 뜻풀이와 빈 밑줄을 건너 보이는 밑줄에 닿는가 */
function reachesLine(node: Element, block: Element, from: Text, forward: boolean): boolean {
  const walker = node.ownerDocument.createTreeWalker(block, 1 | 4);
  walker.currentNode = from;
  for (let next = forward ? walker.nextNode() : walker.previousNode(); next; next = forward ? walker.nextNode() : walker.previousNode()) {
    if (next.nodeType === 1) {
      const element = next as Element;
      if (element.tagName === 'BR' || BLOCK_TAGS.has(element.tagName)) return false;
      continue;
    }
    const text = next as Text;
    if (text.data === '' || node.contains(text) || text.parentElement?.classList.contains(NOTE_STRUT_CLASS)) continue;
    if (blockOf(text) !== block) return false;
    // 낱말 뜻풀이는 지금 가르는 중이라 건너뛴다. 공백만 든 밑줄도 혼자서는 줄이 아니다(낱말 두 개 사이 `<u> </u>`)
    if (inVocab(text, block) || (!hasLetter(text) && isLinedText(text, block))) continue;
    return isLinedText(text, block);
  }
  return false;
}

/**
 * 이 낱말(또는 빈 밑줄)이 긴 밑줄 줄 안인가 — 양옆으로 낱말 뜻풀이와 빈 밑줄을 건너 화면에 보이는 밑줄에 닿으면 그렇다.
 * ⚠️ 형제의 양 끝으로 짐작하지 말 것(코덱스 9R) — 서식에 싸인 옆 낱말의 `<u>` 는 화면이 지운 밑줄이다.
 * @param node - 낱말 뜻풀이 span 이나 빈 밑줄
 * @returns 긴 줄 안이면 true
 */
export function touchesLongLine(node: Element): boolean {
  const texts = ownTexts(node);
  const block = blockOf(node);
  if (texts.length === 0 || !block) return false;
  return reachesLine(node, block, texts[0], false) || reachesLine(node, block, texts[texts.length - 1], true);
}

/**
 * 공백이 아닌 글자가 든 첫 글자 노드 — 받침을 그 글자 옆에 붙인다. 공백만 든 노드는 줄바꿈 자리라 윗줄에 붙을 수 있다(코덱스 7R).
 * @param span - 구절
 * @param from - 이 글자 노드부터 찾는다(밑줄 줄의 첫 글자). 없으면 구절 안에서 찾는다
 * @param to - 여기까지 본다
 * @returns 글자 노드 — 없으면 null
 */
export function firstLetterText(span: Element, from?: Text, to?: Text): Text | null {
  if (!from) return ownTexts(span).find(hasLetter) ?? null;
  const walker = span.ownerDocument.createTreeWalker(blockOf(from) ?? span, 4);
  walker.currentNode = from;
  for (let node: Node | null = from; node; node = walker.nextNode()) {
    if (!(node as Text).parentElement?.classList.contains(NOTE_STRUT_CLASS) && hasLetter(node)) return node as Text;
    if (node === to) break;
  }
  return null;
}
