import { normalizeCategoryName } from '@/lib/category-name';
import { decodeHtmlEntities } from '@/lib/html-entities';
import type { ReferenceTextFormat } from '@/types/reference-text';
import { REFERENCE_SEQ_MAX, REFERENCE_TAG_MAX_LEN, REFERENCE_TAGS_MAX } from './constants';

/**
 * 작품 전문 · 개념 본문의 두 형식(평문 / HTML) 사이를 오가는 순수 함수와 칸 다듬기.
 *
 * ⚠️ 개념지 AI 의 `htmlToPlainText` 를 쓰지 않는다(코덱스 2R) — 그쪽은 모델에게 보낼 글이라 문단 경계를 줄바꿈 하나로
 *    납작하게 만들고 표·목록·제목에 `|`·`-`·`#` 표시를 덧붙인다. 여기서는 ① 문단 = 빈 줄(시의 연 구분)을 지켜야
 *    평문 → 서식 → 평문이 제자리로 돌아오고, ② 비었는지는 표시 없이 **보이는 글자만** 봐야 빈 표가 '본문' 이 안 된다.
 */

/** HTML 로 옮길 때 이스케이프할 글자 */
const HTML_ESCAPES: Readonly<Record<string, string>> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };

/**
 * 평문 한 줄을 HTML 글자로 — 태그로 읽히지 않게.
 * @param text - 평문
 * @returns 이스케이프한 글자
 */
function escapeHtml(text: string): string {
  return text.replace(/[&<>"]/g, (c) => HTML_ESCAPES[c] ?? c);
}

/**
 * 평문 본문을 HTML 로 — 빈 줄은 문단 경계, 줄바꿈은 `<br>`(시는 행갈이가 곧 내용이다).
 * @param text - 평문
 * @returns `<p>` 문단들 (빈 글이면 '')
 */
export function textToHtml(text: string): string {
  const paragraphs = text.replace(/\r\n?/g, '\n').split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  return paragraphs.map((p) => `<p>${p.split('\n').map(escapeHtml).join('<br>')}</p>`).join('');
}

/** 블록이 끝나는 태그 — 문단 경계(빈 줄)가 된다 */
const BLOCK_END = /<\/(p|h3|h4|blockquote|ul|ol|table|figure)>/gi;

/**
 * HTML 본문을 평문으로 — `textToHtml` 의 거꾸로다: 문단(블록)은 빈 줄, `<br>` 은 줄바꿈.
 * 표는 칸을 ` · ` 로, 줄을 줄바꿈으로, 목록 항목은 줄마다 `- ` 로 남긴다(서식을 버릴 때 글이 뭉치지 않게).
 * @param html - HTML
 * @returns 평문 (앱 normalizeBody 와 같은 모양 — 빈 줄은 둘까지)
 */
export function htmlToText(html: string): string {
  const text = html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(td|th)>\s*(?=<(td|th)\b)/gi, ' · ')
    .replace(/<\/tr>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '- ')
    .replace(/<\/li>/gi, '\n')
    .replace(BLOCK_END, '\n\n')
    .replace(/<[^>]+>/g, '');
  return decodeHtmlEntities(text)
    .split('\n').map((line) => line.replace(/[ \t]+$/, '')).join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * 본문의 **보이는 글자** — 빈 TipTap 문서는 `<p></p>`, 빈 표는 칸만 있어 글자열로는 비지 않았다.
 * 글자 수·비었는지 판단은 이것으로 한다(표시 기호를 덧붙이지 않는다 — 코덱스 2R).
 * @param body - 본문
 * @param format - 형식
 * @returns 보이는 글자 (html 이면 태그 자리는 공백)
 */
export function bodyPlainText(body: string, format: ReferenceTextFormat): string {
  if (format !== 'html') return body;
  // 줄 안 태그(굵게·밑줄 …)는 글자 사이에 끼어도 칸이 생기지 않는다 — 공백 없이 걷는다(코덱스 4R).
  // 그 밖의 태그(문단·칸·줄바꿈)는 글을 가르므로 공백 하나로
  const text = body.replace(INLINE_TAG, '').replace(/<[^>]+>/g, ' ');
  return decodeHtmlEntities(text).replace(/\s+/g, ' ').trim();
}

/**
 * 글자 사이에 끼는 줄 안 태그 — 정화기 인라인 프로필(`sanitizeInlineHTML`)의 태그 + 문제집 서식의 `mark`·`small`
 * (br 은 줄바꿈이라 뺀다)
 */
const INLINE_TAG = /<\/?(strong|em|u|s|code|span|mark|small)\b[^>]*>/gi;

/**
 * 태그 칸 — 다듬고(이름 정규화·길이), 겹침을 빼고, 상한까지.
 * @param tags - 입력
 * @returns 저장할 태그
 */
export function normalizeTags(tags: readonly string[]): string[] {
  const out: string[] = [];
  for (const raw of tags) {
    const tag = normalizeCategoryName(raw).slice(0, REFERENCE_TAG_MAX_LEN).trim();
    if (!tag || out.includes(tag)) continue;
    out.push(tag);
    if (out.length >= REFERENCE_TAGS_MAX) break;
  }
  return out;
}

/** 차례 칸의 결과 — 비었으면 null, 잘못 적었으면 'invalid' */
export type ParsedSeq = number | null | 'invalid';

/**
 * 차례 칸(글자)을 숫자로.
 * @param raw - 입력칸 글자
 * @returns 0~9999 정수 · 비었으면 null · 아니면 'invalid'
 */
export function parseSeq(raw: string): ParsedSeq {
  const text = raw.trim();
  if (text === '') return null;
  if (!/^\d+$/.test(text)) return 'invalid';
  const n = Number(text);
  return n <= REFERENCE_SEQ_MAX ? n : 'invalid';
}

/**
 * 본문 길이 — 상한(`REFERENCE_TEXT_BODY_MAX`)과 글자 수 표시가 **같은 잣대**로 잰다(코덱스 3R).
 * 서식 본문은 보이는 글자 수다 — 태그 길이로 재면 평문으로는 저장되던 글이 서식으로 바꾸기만 해도 막힌다.
 * @param body - 본문
 * @param format - 형식
 * @returns 글자 수
 */
export function bodyLength(body: string, format: ReferenceTextFormat): number {
  return format === 'html' ? bodyPlainText(body, format).length : body.length;
}
