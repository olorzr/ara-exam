import { sanitizeConceptHTML } from '@/lib/sanitize-html';
import { OCR_HTML_MAX } from '@/lib/problem-ocr/constants';
import { normalizeBlankParagraphs } from '@/lib/problem-ocr/normalize-html';
import {
  finalizeYetHangul, hasUnconvertedNotation, hasYetHangul,
  UNCONVERTED_NOTATION_WARNING, yetHangulPageWarning,
} from '@/lib/yet-hangul';
import { PRINT_OCR_MAX_WARNINGS } from './constants';
import type { PrintOcrDraft, PrintPageDraft } from './schema';

/**
 * 모델 응답을 검증해 저장 직전 모양으로 (순수 함수).
 *
 * 스키마가 강제하는 것은 모양뿐이라 값이 말이 되는지는 여기서 다시 본다.
 * 무엇보다 **말없이 버리지 않는다** — 빠진 쪽도 잘린 본문도 반드시 경고로 남긴다.
 * 그래야 "AI 가 못 읽은 것" 과 "우리가 잘라낸 것" 을 선생님이 구분할 수 있다.
 */

/** 한 쪽에서 이 글자 수를 넘으면 자른다 (스키마 상한과 같은 값) */
const PAGE_HTML_MAX = OCR_HTML_MAX;

/**
 * 응답 JSON 을 검증한다.
 *
 * @param raw - 검증 전 JSON 문자열
 * @param ctx.pages - 이번에 **보낸** 쪽 (여기 없는 쪽은 버린다)
 * @returns 쪽별 본문과 경고. 모양이 깨졌으면 null
 */
export function parsePrintOcrDraft(
  raw: string,
  ctx: { pages: number[] },
): PrintOcrDraft | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object') return null;

  const value = parsed as Record<string, unknown>;
  if (!Array.isArray(value.pages)) return null;

  const warnings: string[] = Array.isArray(value.warnings)
    ? value.warnings.filter((w): w is string => typeof w === 'string' && w.trim() !== '')
    : [];

  const wanted = new Set(ctx.pages);
  const byPage = new Map<number, PrintPageDraft>();
  const unknownPages: number[] = [];

  for (const item of value.pages) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const page = typeof row.page === 'number' ? row.page : Number(row.page);
    if (!Number.isInteger(page)) continue;

    // 보내지 않은 쪽을 낸 것은 **버린다** — 그 쪽 이미지를 본 적이 없으니 지어낸 것이다.
    // 조용히 버리면 안 된다: 그 안에 진짜 내용이 섞여 있었을 수 있다
    if (!wanted.has(page)) {
      if (!unknownPages.includes(page)) unknownPages.push(page);
      continue;
    }
    // 같은 쪽이 두 번 오면 먼저 온 것을 쓴다 (스키마가 여유를 준 만큼 실제로 생긴다)
    if (byPage.has(page)) continue;

    const body = typeof row.html === 'string' ? row.html.trim() : '';
    // ⚠️ 자르면 **반드시 알린다.** 예전 기출 파이프라인의 말없는 slice 가
    //    "AI 가 안 읽었다" 와 "우리가 잘랐다" 를 구분할 수 없게 만들었다
    if (body.length > PAGE_HTML_MAX) {
      warnings.push(`${page}쪽 본문이 너무 길어 뒷부분이 잘렸어요. 원본과 대조해 채워 주세요.`);
    }
    // 옛한글을 **여기서 굳힌다** — 쪽 경고가 실체 참조·대체 표기가 풀린 글을 봐야 한다
    // (코덱스 리뷰 5R). 저장 직전 `finalizePrintHtml` 이 정화 뒤에 한 번 더 굳힌다(멱등)
    const html = normalizeBlankParagraphs(finalizeYetHangul(body.slice(0, PAGE_HTML_MAX)));
    // 옛 글자는 선생님이 눈으로 한 번 더 봐야 한다(비슷한 다른 자모로 읽어도 그럴듯해 보인다)
    if (hasUnconvertedNotation(html)) warnings.push(`${page}쪽 — ${UNCONVERTED_NOTATION_WARNING}`);
    else if (hasYetHangul(html)) warnings.push(yetHangulPageWarning(page));
    byPage.set(page, { page, html });
  }

  if (unknownPages.length > 0) {
    warnings.push(
      `보내지 않은 쪽(${unknownPages.sort((a, b) => a - b).join('·')}쪽)의 내용이 와서 버렸어요.`,
    );
  }

  // 보낸 쪽은 전부 자리를 만든다 — 빠진 쪽을 조용히 건너뛰면 시험지에서만 사라진다
  const missing: string[] = [];
  for (const page of ctx.pages) {
    if (byPage.has(page)) continue;
    byPage.set(page, { page, html: '', missing: true });
    missing.push(`${page}쪽 내용을 받지 못했어요. 원본을 확인해 주세요.`);
  }

  return {
    pages: [...byPage.values()].sort((a, b) => a.page - b.page),
    // ⚠️ 빠진 쪽 경고를 **맨 앞**에 둔다(코덱스 리뷰 2R). 모델이 낸 경고가 상한을 채우면
    //    뒤에 붙은 이 경고가 잘려 나가는데, 그 쪽은 뒤에서 다시 경고하지 않으므로
    //    **쪽 하나가 통째로 빠진 사실이 어디에도 안 남는다**
    warnings: [...missing, ...warnings].slice(0, PRINT_OCR_MAX_WARNINGS),
  };
}

/**
 * 여러 번에 나눠 읽은 결과를 **쪽 번호 순서로** 이어 붙인다.
 *
 * 모델이 낸 순서를 믿지 않는다 — 순서가 곧 시험지의 순서라, 한 번 어긋나면
 * 선생님이 글을 통째로 다시 배열해야 한다.
 * @param drafts - 읽기 결과들 (순서 무관)
 * @returns 이어 붙인 HTML (아직 정화 전)
 */
export function joinPageHtml(drafts: readonly PrintOcrDraft[]): string {
  const pages = drafts
    .flatMap((d) => d.pages)
    .filter((p) => p.html.trim() !== '')
    .sort((a, b) => a.page - b.page);
  return pages.map((p) => p.html).join('\n');
}

/**
 * 개념지에 넣기 직전의 마지막 관문.
 *
 * ⚠️ 옛한글 굳히기는 **정화 뒤**다(코덱스 리뷰 4R) — 정화가 HTML 실체 참조를 풀기 때문에,
 *    앞에서만 맞추면 `가&#x11EB;` 같은 입력이 섞인 모양으로 저장된다.
 *
 * ⚠️ **여기서만 정화한다고 믿지 말 것** — 편집기 로드 경로에도 `sanitizeConceptHTML` 이
 *    있다(공유 표라 Stored XSS 방어가 다층이다). 다만 저장되는 값은 여기서 이미 안전해야
 *    허용 밖 태그가 DB 에 쌓이지 않는다.
 * @param html - 이어 붙인 HTML
 * @returns 정화된 HTML
 */
export function finalizePrintHtml(html: string): string {
  return finalizeYetHangul(sanitizeConceptHTML(html));
}
