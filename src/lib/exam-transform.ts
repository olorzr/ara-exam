import { sanitizeConceptHTML } from './sanitize-html';

/** 초성 목록 (유니코드 순서) */
const CHOSUNG = [
  'ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ',
  'ㅅ','ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ',
] as const;

/** 유니코드 한글 음절 시작/끝 */
const HANGUL_START = 0xAC00;
const HANGUL_END = 0xD7A3;
const HANGUL_RANGE = 11172;
const CHOSUNG_FACTOR = 588;

/**
 * 1·2단계 박스 묶음 래퍼 클래스.
 * 줄바꿈 정책은 CSS 가 맡는다 — 본문에서는 한 단어의 박스를 붙여 두고(nowrap),
 * 표 셀 안에서는 박스 사이 줄바꿈을 허용해 표가 컬럼 폭을 뚫지 않게 한다.
 */
export const BLANK_RUN_CLASS = 'eb-blank-run';

/**
 * 한글 문자의 초성을 추출한다.
 * @returns 초성 문자열, 한글이 아니면 null
 */
export function getChosung(char: string): string | null {
  const code = char.charCodeAt(0) - HANGUL_START;
  if (code < 0 || code >= HANGUL_RANGE) return null;
  return CHOSUNG[Math.floor(code / CHOSUNG_FACTOR)];
}

/**
 * 한글 음절인지 판별한다.
 */
export function isKorean(char: string): boolean {
  const code = char.charCodeAt(0);
  return code >= HANGUL_START && code <= HANGUL_END;
}

/** 변환 모드 */
export type TransformMode =
  | 'concept'
  | 'concept-interactive'
  | 'stage1'
  | 'stage2'
  | 'stage3'
  | 'answer';

/**
 * 에디터 HTML에서 `<mark data-concept>` 태그를 찾아 모드별로 변환한다.
 * 브라우저 DOM API를 사용하므로 클라이언트에서만 호출 가능.
 */
export function transformHTML(editorHTML: string, mode: TransformMode): string {
  const div = document.createElement('div');
  div.innerHTML = sanitizeConceptHTML(editorHTML);

  const marks = div.querySelectorAll('mark[data-concept]');
  marks.forEach((mark) => {
    const text = mark.textContent ?? '';
    const replacement = buildReplacement(text, mode);
    mark.parentNode?.replaceChild(replacement, mark);
  });

  return div.innerHTML;
}

/** 블록으로 취급하는 태그들 */
const BLOCK_TAGS = new Set(['P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6']);

/**
 * 블록 요소가 시각적으로 "비었는지" 판정한다.
 * 텍스트가 공백/비파괴공백뿐이고, 자식은 없거나 `<br>` 만 있는 경우 true.
 */
function isVisuallyEmptyBlock(el: Element): boolean {
  if (!BLOCK_TAGS.has(el.tagName)) return false;
  const text = (el.textContent ?? '').replace(/\u00A0/g, ' ').trim();
  if (text !== '') return false;
  const hasNonBr = Array.from(el.children).some((c) => c.tagName !== 'BR');
  return !hasNonBr;
}

/**
 * TipTap 이 문서 끝에 자주 남기는 빈 `<p></p>` · `<p><br></p>` 등을
 * 재귀적으로 제거한다. 인쇄 시 trailing 빈 블록이 새 페이지로 밀려
 * 빈 페이지가 생기는 현상을 방지한다.
 */
export function stripTrailingEmpty(editorHTML: string): string {
  const div = document.createElement('div');
  div.innerHTML = sanitizeConceptHTML(editorHTML);

  let last = div.lastElementChild;
  while (last && isVisuallyEmptyBlock(last)) {
    last.remove();
    last = div.lastElementChild;
  }

  return div.innerHTML;
}

/** 마킹된 텍스트에서 개념 목록을 추출한다. */
export function extractMarkedWords(html: string): string[] {
  const div = document.createElement('div');
  div.innerHTML = sanitizeConceptHTML(html);
  const marks = div.querySelectorAll('mark[data-concept]');
  return Array.from(marks).map((m) => m.textContent ?? '');
}

function buildReplacement(text: string, mode: TransformMode): Node {
  switch (mode) {
    case 'concept':
      return makeSpan(text, 'eb-concept-highlight');

    case 'concept-interactive': {
      const span = makeSpan(text, 'eb-concept-preview-mark');
      span.setAttribute('data-original', text);
      span.setAttribute('data-concept-interactive', 'true');
      return span;
    }

    case 'stage1':
      return buildChosungBoxes(text);

    case 'stage2':
      return buildStage2Boxes(text);

    case 'stage3': {
      const span = document.createElement('span');
      span.className = 'eb-stage3-blank';
      span.innerHTML = '&nbsp;';
      return span;
    }

    case 'answer':
      return makeSpan(text, 'eb-answer-text');
  }
}

function makeSpan(text: string, className: string): HTMLSpanElement {
  const span = document.createElement('span');
  span.className = className;
  span.textContent = text;
  return span;
}

/** 1단계: 한글 → 초성 박스, 비한글 → 그대로 */
function buildChosungBoxes(text: string): HTMLSpanElement {
  const wrapper = document.createElement('span');
  wrapper.className = BLANK_RUN_CLASS;

  for (const char of text) {
    if (isKorean(char)) {
      const box = document.createElement('span');
      box.className = 'eb-chosung-box';
      const label = document.createElement('span');
      label.className = 'eb-cho-label';
      label.textContent = getChosung(char);
      box.appendChild(label);
      wrapper.appendChild(box);
    } else {
      wrapper.appendChild(document.createTextNode(char));
    }
  }
  return wrapper;
}

/** 2단계: 글자 수만큼 빈 핑크 박스 (공백은 박스 대신 띄어쓰기로 보존) */
function buildStage2Boxes(text: string): HTMLSpanElement {
  const wrapper = document.createElement('span');
  wrapper.className = BLANK_RUN_CLASS;

  for (const char of text) {
    if (char === ' ') {
      wrapper.appendChild(document.createTextNode(' '));
    } else {
      const box = document.createElement('span');
      box.className = 'eb-stage2-box';
      wrapper.appendChild(box);
    }
  }
  return wrapper;
}
