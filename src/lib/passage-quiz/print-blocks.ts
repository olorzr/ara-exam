import { PASSAGE_BLOCK_MAX_CHARS, PASSAGE_BLOCK_MAX_LINES } from './constants';

/**
 * 지문을 인쇄 블록으로 나눈다 (순수 함수).
 *
 * `A4Document` 는 블록 단위로 쪽을 채운다 — 지문을 한 덩어리로 주면 한 쪽에 못 담을 때
 * 통째로 **축소**돼 글씨가 작아진다. 그래서 두 가지로 쪼갠다:
 *  ① 빈 줄(문단·연 경계) — 쪽이 갈려도 읽는 자리가 자연스럽다
 *  ② 줄 수·글자 수 상한 — 비문학 지문은 줄바꿈 없이 몇천 자가 한 줄로 들어온다
 *
 * ⚠️ 줄바꿈을 **없애지 않는다.** 시는 행갈이가 곧 내용이라 문단 안의 줄바꿈이 사라지면
 *    연이 산문처럼 붙는다(인쇄 쪽은 `white-space: pre-wrap` 으로 그린다).
 * ⚠️ **문단이 새로 시작하는 조각인지 표시해 돌려준다.** 빈 줄은 나누면서 사라지는데,
 *    그것을 그리는 쪽에 알려 주지 않으면 연과 연 사이가 붙어 버린다 — 자리를 채우려고
 *    쪼갠 조각(②)과 진짜 연 경계(①)는 생긴 모양이 같아서 뒤에서는 구분할 수 없다.
 */

/** 인쇄 블록 하나 */
export interface PassageBlock {
  text: string;
  /** 새 문단·연이 여기서 시작하는가 (자리가 모자라 쪼갠 조각이면 false) */
  newParagraph: boolean;
}

/** 문장이 끝나는 자리 — 긴 한 줄을 쪼갤 때 여기서 끊는다 */
const SENTENCE_END = /(?<=[.!?。…]|다\.|요\.)\s+/;

/**
 * 너무 긴 한 줄을 문장 경계로 쪼갠다. 문장이 없으면 띄어쓰기, 그것도 없으면 글자 수로 끊는다.
 * @param line - 한 줄
 * @param maxChars - 조각 하나의 글자 수 상한
 * @returns 조각들 (상한 이하)
 */
function splitLongLine(line: string, maxChars: number): string[] {
  if (line.length <= maxChars) return [line];

  const out: string[] = [];
  let buffer = '';
  for (const piece of line.split(SENTENCE_END)) {
    const candidate = buffer ? `${buffer} ${piece}` : piece;
    if (candidate.length <= maxChars) {
      buffer = candidate;
      continue;
    }
    if (buffer) out.push(buffer);
    // 문장 하나가 상한을 넘으면 띄어쓰기로, 그것도 안 되면 글자 수로 끊는다
    buffer = '';
    let rest = piece;
    while (rest.length > maxChars) {
      const space = rest.lastIndexOf(' ', maxChars);
      const cut = space > maxChars / 2 ? space : maxChars;
      out.push(rest.slice(0, cut).trimEnd());
      rest = rest.slice(cut).trimStart();
    }
    buffer = rest;
  }
  if (buffer) out.push(buffer);
  return out;
}

/**
 * 빈 줄을 경계로 지문을 나누고, 너무 긴 덩어리는 다시 쪼갠다.
 * @param text - 지문 평문
 * @param maxLines - 블록 하나에 담을 줄 수 상한
 * @param maxChars - 블록 하나에 담을 글자 수 상한
 * @returns 인쇄 블록들 (빈 조각은 없다)
 */
export function splitPassageBlocks(
  text: string,
  maxLines: number = PASSAGE_BLOCK_MAX_LINES,
  maxChars: number = PASSAGE_BLOCK_MAX_CHARS,
): PassageBlock[] {
  const lineLimit = Math.max(1, maxLines);
  const charLimit = Math.max(1, maxChars);
  const out: PassageBlock[] = [];

  for (const chunk of text.replace(/\r\n?/g, '\n').split(/\n{2,}/)) {
    const lines = chunk.split('\n').map((line) => line.trimEnd());
    // 앞뒤의 빈 줄만 걷어낸다 — 가운데 빈 줄은 이미 경계로 쓰였다
    while (lines.length > 0 && lines[0].trim() === '') lines.shift();
    while (lines.length > 0 && lines[lines.length - 1].trim() === '') lines.pop();
    if (lines.length === 0) continue;

    const pieces = lines.flatMap((line) => splitLongLine(line, charLimit));
    let buffer: string[] = [];
    let chars = 0;
    let first = true;

    const flush = () => {
      if (buffer.length === 0) return;
      out.push({ text: buffer.join('\n'), newParagraph: first });
      first = false;
      buffer = [];
      chars = 0;
    };

    for (const piece of pieces) {
      // 한 조각이라도 들어 있는데 상한을 넘기게 되면 먼저 내보낸다
      if (buffer.length > 0 && (buffer.length >= lineLimit || chars + piece.length > charLimit)) {
        flush();
      }
      buffer.push(piece);
      chars += piece.length;
    }
    flush();
  }

  return out;
}

/**
 * 인쇄물 제목.
 * @param title - 작품명·글 제목 (비어 있을 수 있다)
 * @returns 시험지 머리말에 쓸 제목
 */
export function quizPaperTitle(title: string): string {
  const trimmed = title.trim();
  return trimmed ? `${trimmed} O,X·단답형` : 'O,X·단답형 문제';
}
