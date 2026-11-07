import { Mark } from '@tiptap/core';
import { isNoteKind, isNotePos, isPhraseNote, isShapeKind } from '@/lib/workbook-markup';

/**
 * 작품 전문 · 개념 편집기의 글자 표시 — 형광펜 · 작은 글씨 · 구절 풀이 · 표식 · 네모.
 *
 * ⚠️ 구절 풀이 · 표식은 **읽을 때 값을 본다.** 다른 표시는 정화기(`sanitizeReferenceHTML`)에 맡기지만, 붙여 넣은 HTML 은
 *    저장 전에 편집기 값으로 나가고 '평문으로 바꾸기' 가 그 값을 곧바로 평문으로 만든다. 꺾쇠가 든 풀이가 거기까지 가면
 *    태그가 끊겨 풀이 뒷글자가 원문이 된다(workbook-markup.ts 의 `PHRASE_NOTE`).
 */

/** 구절 풀이 마크 이름 — 툴바가 이 이름으로 읽고 고친다 */
export const PHRASE_NOTE_MARK = 'phraseNote';

/** 표식 마크 이름 */
export const SHAPE_MARK = 'shapeMark';

/** 네모 표시 마크 이름 — StarterKit `Code` 와 같아야 기존 본문의 `<code>` 가 그대로 읽힌다 */
export const CODE_MARK = 'code';

/**
 * 구절 풀이 · 표식의 우선순위 — StarterKit 마크(100)보다 높여 DOM 에서 `u`·`strong` 의 **바깥**에 둔다.
 * 안쪽에 들어가면 풀이(`::after`)가 `<u>` 의 후손이 되어 풀이 글자까지 밑줄이 번진다.
 */
const OUTER_MARK_PRIORITY = 110;

/**
 * 네모의 우선순위 — 풀이 · 표식의 안쪽, 굵게 · 밑줄의 바깥이다.
 * 일반 서식보다 안쪽이면 네모 안 일부를 굵게 할 때 네모가 셋으로 갈라진다(`excludes` 를 풀어 둘이 함께 있을 수 있다).
 */
const CODE_MARK_PRIORITY = 105;

/**
 * 한 속성을 읽고 쓰는 속성 정의 — `accept` 를 주면 그 값만 읽는다.
 * @param attr - HTML 속성 이름
 * @param accept - 받을 값인가(없으면 그대로 받는다)
 * @returns TipTap 속성 정의
 */
export function passThrough(attr: string, accept: (value: string) => boolean = () => true) {
  return {
    default: null,
    parseHTML: (element: HTMLElement) => {
      const value = element.getAttribute(attr);
      return value !== null && accept(value) ? value : null;
    },
    renderHTML: (attributes: Record<string, unknown>) => {
      const value = attributes[attr];
      return typeof value === 'string' && value ? { [attr]: value } : {};
    },
  };
}

/**
 * 핵심어 형광펜 `<mark>` — 개념지의 `ConceptMark`(`mark[data-concept]`, 빈칸 마킹)와 다른 것이다(속성 없음).
 * 새 패키지(`@tiptap/extension-highlight`)를 깔지 않는다.
 */
export const HighlightMark = Mark.create({
  name: 'highlight',
  parseHTML() {
    return [{ tag: 'mark' }];
  },
  renderHTML() {
    return ['mark', 0];
  },
  addKeyboardShortcuts() {
    return { 'Mod-Shift-h': () => this.editor.commands.toggleMark(this.name) };
  },
});

/** 작은 글씨 `<small>` — 어휘의 한자 풀이(話 말할 화, 者 사람 자) */
export const SmallMark = Mark.create({
  name: 'small',
  parseHTML() {
    return [{ tag: 'small' }];
  },
  renderHTML() {
    return ['small', 0];
  },
});

/**
 * 구절 풀이 `<span data-note>` — 구절 바로 밑(`data-note-pos="over"` 면 위)에 작은 글씨 해설. 밑줄은 따로 `<u>` 다.
 * `data-note-kind="vocab"` 이면 낱말 뜻풀이다 — 보기 화면이 ✦ 와 글 끝 어휘 목록으로 그린다.
 *
 * `inclusive: false` — 구절 끝에서 이어 쳐도 풀이가 늘어나지 않는다.
 * `consuming: false` — 붙여 넣은 span 에 `data-note`·`data-shape` 가 함께 있어도 두 마크로 읽힌다(글자는 한 번만 들어간다).
 */
export const PhraseNoteMark = Mark.create({
  name: PHRASE_NOTE_MARK,
  priority: OUTER_MARK_PRIORITY,
  inclusive: false,
  addAttributes() {
    return {
      'data-note': passThrough('data-note'),
      'data-note-pos': passThrough('data-note-pos', isNotePos),
      'data-note-kind': passThrough('data-note-kind', isNoteKind),
    };
  },
  parseHTML() {
    return [{
      tag: 'span[data-note]',
      consuming: false,
      getAttrs: (element) => (isPhraseNote(element.getAttribute('data-note') ?? '') ? null : false),
    }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['span', HTMLAttributes, 0];
  },
});

/** 표식 `<span data-shape>` — □ ○ △ ◇ ☆. 범례는 글로 적으므로 표식 자체는 뜻을 담지 않는다 */
export const ShapeMark = Mark.create({
  name: SHAPE_MARK,
  priority: OUTER_MARK_PRIORITY,
  inclusive: false,
  addAttributes() {
    return { 'data-shape': passThrough('data-shape') };
  },
  parseHTML() {
    return [{
      tag: 'span[data-shape]',
      consuming: false,
      getAttrs: (element) => (isShapeKind(element.getAttribute('data-shape') ?? '') ? null : false),
    }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['span', HTMLAttributes, 0];
  },
});

/**
 * 네모 표시 `<code>` — StarterKit 의 `Code` 대신 참고자료 편집기에만 얹는다.
 *
 * ⚠️ `Code` 는 `excludes: '_'` 라 다른 마크를 전부 밀어낸다. 그대로면 네모 친 낱말에 풀이를 달 때 조용히 실패하고,
 *    풀이 안 글자에 네모를 걸면 풀이가 사라진다. 이름이 같아 기존 본문의 `<code>` 는 그대로 읽힌다.
 *    `code`·`exitable` 은 `Code` 그대로다 — 문단 끝 네모에서 오른쪽 화살표로 빠져나와 이어 칠 수 있어야 한다.
 *    입력 규칙·단축키는 두지 않는다(참고자료 툴바에 단추도 없다).
 */
export const ReferenceCodeMark = Mark.create({
  name: CODE_MARK,
  priority: CODE_MARK_PRIORITY,
  excludes: '',
  code: true,
  exitable: true,
  parseHTML() {
    return [{ tag: 'code' }];
  },
  renderHTML() {
    return ['code', 0];
  },
});
